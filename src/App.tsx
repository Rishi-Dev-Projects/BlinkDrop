import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { DeviceRadar } from './components/DeviceRadar';
import { RoomControls } from './components/RoomControls';
import { FileStaging } from './components/FileStaging';
import { TransferConsole } from './components/TransferConsole';
import { SignalingSettingsModal } from './components/SignalingSettingsModal';
import { QrScannerModal } from './components/QrScannerModal';
import {
  SignalingMode,
  FirebaseConfig,
  PeerDevice,
  WebRTCConnectionState,
  CandidateRouteType,
  FileTransferItem
} from './types';
import { detectDevice, generateRoomCode } from './utils/device';
import {
  sanitizeFileName,
  inferMimeType,
  MAX_SAFE_FILE_SIZE,
  MOBILE_FILE_WARNING_THRESHOLD
} from './utils/file';
import {
  BroadcastSignalingChannel,
  FirebaseSignalingChannel,
  SignalingChannel
} from './services/signaling';
import { WebRTCManager } from './services/webrtc';
import { WarningCircle, CheckCircle, Info } from '@phosphor-icons/react';

export const App: React.FC = () => {
  // 1. Core State
  const [localDevice] = useState<PeerDevice>(() => detectDevice());
  const [remoteDevice, setRemoteDevice] = useState<PeerDevice | null>(null);

  // Room Key: parse from query (?room=CODE) or URL hash (#CODE) or generate clean code
  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryRoom = params.get('room');
      if (queryRoom && /^[A-Z0-9]{4,12}$/i.test(queryRoom.trim())) {
        return queryRoom.trim().toUpperCase();
      }
      const hash = window.location.hash.replace('#', '').trim().toUpperCase();
      if (hash && /^[A-Z0-9]{4,12}$/.test(hash)) {
        return hash;
      }
    }
    return generateRoomCode();
  });

  const [signalingMode, setSignalingMode] = useState<SignalingMode>(() => {
    const saved = localStorage.getItem('blinkdrop_signaling_mode');
    return saved === 'firebase' ? 'firebase' : 'broadcast';
  });

  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig | null>(() => {
    const saved = localStorage.getItem('blinkdrop_firebase_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    // Check if injected via environment
    if (import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID) {
      return {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
      };
    }
    return null;
  });

  const [connectionState, setConnectionState] = useState<WebRTCConnectionState>('disconnected');
  const [routeType, setRouteType] = useState<CandidateRouteType>('unknown');

  const [stagedFiles, setStagedFiles] = useState<FileTransferItem[]>([]);
  const [transfers, setTransfers] = useState<FileTransferItem[]>([]);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [bannerNotice, setBannerNotice] = useState<{ type: 'info' | 'error' | 'success'; text: string } | null>(null);

  const webrtcManagerRef = useRef<WebRTCManager | null>(null);

  // Sync Room ID with URL hash
  useEffect(() => {
    window.location.hash = roomId;
  }, [roomId]);

  const showBanner = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    setBannerNotice({ text, type });
    setTimeout(() => {
      setBannerNotice((prev) => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // 2. Initialize WebRTC and Signaling Session
  useEffect(() => {
    let signaling: SignalingChannel;

    if (signalingMode === 'firebase' && firebaseConfig) {
      try {
        signaling = new FirebaseSignalingChannel(firebaseConfig, roomId, localDevice.id);
      } catch (err) {
        console.error('Firebase signaling initialization error', err);
        showBanner('Firebase signaling error: falling back to Local Broadcast', 'error');
        signaling = new BroadcastSignalingChannel(roomId);
      }
    } else {
      signaling = new BroadcastSignalingChannel(roomId);
    }

    // Instantiating WebRTC manager
    const manager = new WebRTCManager(localDevice, roomId, signaling, {
      onConnectionStateChange: (state) => {
        if (state === 'connected') {
          setConnectionState('connected');
          showBanner('Peer WebRTC channel connected successfully', 'success');
        } else if (state === 'connecting') {
          setConnectionState('connecting');
        } else if (state === 'failed') {
          setConnectionState('failed');
          showBanner('WebRTC connection failed. Verify network or STUN/TURN access', 'error');
        } else {
          setConnectionState('disconnected');
        }
      },
      onRouteTypeChange: (route) => {
        setRouteType(route);
      },
      onFileOffered: (inboundItem) => {
        setTransfers((prev) => [inboundItem, ...prev]);
        showBanner(`Incoming file offered: ${inboundItem.name}`, 'info');
      },
      onTransferProgress: (fileId, bytesTransferred, speedBps, status) => {
        setTransfers((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, bytesTransferred, speedBps, status }
              : item
          )
        );
      },
      onTransferCompleted: (fileId, blobUrl) => {
        setTransfers((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? {
                  ...item,
                  status: 'completed',
                  blobUrl: blobUrl || item.blobUrl,
                  completedAt: Date.now()
                }
              : item
          )
        );
        showBanner('Transfer completed and verified with peer confirmation', 'success');
      },
      onTransferFailed: (fileId, reason) => {
        setTransfers((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? { ...item, status: 'failed', errorMessage: reason }
              : item
          )
        );
        showBanner(`Transfer error: ${reason}`, 'error');
      },
      onPeerLeft: () => {
        setRemoteDevice(null);
        setConnectionState('disconnected');
        setRouteType('unknown');
        showBanner('Remote peer disconnected from room', 'info');
      }
    });

    webrtcManagerRef.current = manager;

    // Listen for peer-join discovery via signaling
    const unreg = signaling.onMessage((msg) => {
      if (msg.roomId === roomId && msg.senderId !== localDevice.id) {
        if (msg.type === 'join' || msg.type === 'join-reply') {
          setRemoteDevice(
            msg.senderDevice || {
              id: msg.senderId,
              name: 'Remote Device',
              os: 'Unknown',
              browser: 'Browser',
              joinedAt: Date.now()
            }
          );
        }
      }
    });

    // Announce local device presence in room
    manager.announceJoin();

    return () => {
      unreg();
      manager.destroy();
      webrtcManagerRef.current = null;
    };
  }, [roomId, signalingMode, firebaseConfig, localDevice]);

  // Clean up blob URLs to prevent mobile memory leaks
  useEffect(() => {
    return () => {
      transfers.forEach((t) => {
        if (t.blobUrl) {
          try {
            URL.revokeObjectURL(t.blobUrl);
          } catch {
            // ignore
          }
        }
      });
    };
  }, [transfers]);

  // 3. Staging and Queue Handlers
  const handleAddFiles = (files: File[]) => {
    const newItems: FileTransferItem[] = [];

    for (const file of files) {
      if (file.size > MAX_SAFE_FILE_SIZE) {
        showBanner(`File "${file.name}" exceeds 1 GB limit and was skipped`, 'error');
        continue;
      }
      if (file.size > MOBILE_FILE_WARNING_THRESHOLD) {
        showBanner(
          `Large file "${file.name}" (${(file.size / (1024 * 1024)).toFixed(0)} MB). Backpressure throttling active.`,
          'info'
        );
      }
      const safeName = sanitizeFileName(file.name);
      const mime = inferMimeType(safeName, file.type);

      newItems.push({
        id: 'f_' + Math.random().toString(36).substring(2, 9),
        name: safeName,
        size: file.size,
        mimeType: mime,
        direction: 'send',
        status: 'staged',
        bytesTransferred: 0,
        speedBps: 0,
        file
      });
    }

    if (newItems.length > 0) {
      setStagedFiles((prev) => [...prev, ...newItems]);
    }
  };

  const handleRemoveStagedFile = (fileId: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleSendFile = async (fileId: string) => {
    const target = stagedFiles.find((f) => f.id === fileId);
    if (!target || !webrtcManagerRef.current) return;

    // Move to transfers list
    setStagedFiles((prev) => prev.filter((f) => f.id !== fileId));
    setTransfers((prev) => [target, ...prev]);

    try {
      await webrtcManagerRef.current.sendFile(target);
    } catch (err: any) {
      setTransfers((prev) =>
        prev.map((item) =>
          item.id === fileId
            ? { ...item, status: 'failed', errorMessage: err.message || 'Send failure' }
            : item
        )
      );
    }
  };

  const handleSendAll = async () => {
    const queue = [...stagedFiles];
    setStagedFiles([]);
    setTransfers((prev) => [...queue, ...prev]);

    for (const item of queue) {
      if (webrtcManagerRef.current) {
        try {
          await webrtcManagerRef.current.sendFile(item);
        } catch (err: any) {
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === item.id
                ? { ...t, status: 'failed', errorMessage: err.message || 'Send failure' }
                : t
            )
          );
        }
      }
    }
  };

  const handleAcceptFile = (fileId: string) => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.acceptInboundFile(fileId);
    }
  };

  const handleRejectFile = (fileId: string) => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.rejectInboundFile(fileId);
    }
  };

  const handleCancelTransfer = (fileId: string) => {
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.cancelTransfer(fileId);
    }
  };

  const handleDismissTransfer = (fileId: string) => {
    setTransfers((prev) => {
      const target = prev.find((t) => t.id === fileId);
      if (target?.blobUrl) {
        try {
          URL.revokeObjectURL(target.blobUrl);
        } catch {
          // ignore
        }
      }
      return prev.filter((t) => t.id !== fileId);
    });
  };

  const handleGenerateNewRoom = () => {
    const newCode = generateRoomCode();
    setRoomId(newCode);
    setRemoteDevice(null);
    setConnectionState('disconnected');
    setRouteType('unknown');
    showBanner(`Created new room: ${newCode}`, 'info');
  };

  const handleJoinRoom = (targetRoomId: string) => {
    const clean = targetRoomId.trim().toUpperCase();
    setRoomId(clean);
    setRemoteDevice(null);
    setConnectionState('disconnected');
    setRouteType('unknown');
    showBanner(`Joined room: ${clean}`, 'info');
  };

  const handleSaveSettings = (newMode: SignalingMode, newConfig: FirebaseConfig | null) => {
    setSignalingMode(newMode);
    localStorage.setItem('blinkdrop_signaling_mode', newMode);

    if (newConfig) {
      setFirebaseConfig(newConfig);
      localStorage.setItem('blinkdrop_firebase_config', JSON.stringify(newConfig));
    }
    showBanner(`Switched to ${newMode === 'firebase' ? 'Firebase Cloud' : 'Local Channel'} mode`, 'success');
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-midnight-base text-slate-100">
      {/* 1. Header Landmark */}
      <Header
        signalingMode={signalingMode}
        connectionState={connectionState}
        routeType={routeType}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Floating Status Notification Banner */}
      {bannerNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-40 max-w-md w-full px-4"
        >
          <div
            className={`px-4 py-3 rounded-lg border text-xs font-mono shadow-xl flex items-center justify-between gap-3 ${
              bannerNotice.type === 'error'
                ? 'bg-rose-950/90 border-rose-800 text-rose-200'
                : bannerNotice.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
                : 'bg-midnight-raised/95 border-midnight-border text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {bannerNotice.type === 'error' ? (
                <WarningCircle size={16} weight="bold" className="text-rose-400" aria-hidden="true" />
              ) : bannerNotice.type === 'success' ? (
                <CheckCircle size={16} weight="bold" className="text-emerald-400" aria-hidden="true" />
              ) : (
                <Info size={16} weight="bold" className="text-signal-cyan" aria-hidden="true" />
              )}
              <span>{bannerNotice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerNotice(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
              aria-label="Dismiss banner"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Content Landmark */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-5 sm:space-y-6">
        {/* Primary Page Heading */}
        <div className="space-y-1">
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white">
            Peer-to-Peer File Transfer Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Direct browser-to-browser data transfer using WebRTC DataChannels. Binary payloads travel directly between devices without cloud intermediaries.
          </p>
        </div>

        {/* Device Pairing Radar Stage */}
        <section aria-labelledby="radar-heading">
          <h2 id="radar-heading" className="sr-only">Device Pairing Stage</h2>
          <DeviceRadar
            localDevice={localDevice}
            remoteDevice={remoteDevice}
            connectionState={connectionState}
            routeType={routeType}
          />
        </section>

        {/* Room Rendezvous Controls */}
        <section aria-labelledby="room-controls-heading">
          <h2 id="room-controls-heading" className="sr-only">Room Coordination Controls</h2>
          <RoomControls
            roomId={roomId}
            onGenerateNewRoom={handleGenerateNewRoom}
            onJoinRoom={handleJoinRoom}
            onOpenScanner={() => setScannerOpen(true)}
          />
        </section>

        {/* Operational Split: File Staging & Transfer Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6 items-start">
          <section aria-labelledby="staging-heading">
            <h2 id="staging-heading" className="sr-only">File Staging Zone</h2>
            <FileStaging
              stagedFiles={stagedFiles}
              connectionState={connectionState}
              onAddFiles={handleAddFiles}
              onRemoveFile={handleRemoveStagedFile}
              onSendFile={handleSendFile}
              onSendAll={handleSendAll}
            />
          </section>

          <section aria-labelledby="transfer-heading">
            <h2 id="transfer-heading" className="sr-only">Live Transfer Stream</h2>
            <TransferConsole
              transfers={transfers}
              onAcceptFile={handleAcceptFile}
              onRejectFile={handleRejectFile}
              onCancelTransfer={handleCancelTransfer}
              onDismissTransfer={handleDismissTransfer}
            />
          </section>
        </div>
      </main>

      {/* 3. Footer Landmark */}
      <footer className="border-t border-midnight-border bg-midnight-void py-5 mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-slate-500 text-center sm:text-left">
          <div>
            <span className="text-slate-400 font-medium">BlinkDrop</span>: Direct WebRTC Transfer Engine
          </div>
          <div className="flex items-center gap-3">
            <span>RTCDataChannel Adaptive Chunk Protocol</span>
            <span>•</span>
            <span>Zero Payload Storage</span>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
      <SignalingSettingsModal
        isOpen={settingsOpen}
        currentMode={signalingMode}
        currentFirebaseConfig={firebaseConfig}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />

      {/* Camera QR Scanner Modal */}
      <QrScannerModal
        isOpen={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanSuccess={handleJoinRoom}
      />
    </div>
  );
};
