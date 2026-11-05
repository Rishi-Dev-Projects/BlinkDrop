import React, { useState } from 'react';
import {
  ChartLineUp,
  X,
  Copy,
  Check
} from '@phosphor-icons/react';
import { ConnectionDiagnostics, WebRTCConnectionState } from '../types';

interface DiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: ConnectionDiagnostics | null;
  connectionState: WebRTCConnectionState;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({
  isOpen,
  onClose,
  diagnostics,
  connectionState
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyDiagnostics = async () => {
    if (!diagnostics) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const formatTimestamp = (ts: number | null) => {
    if (!ts) return 'Not yet established';
    return new Date(ts).toLocaleTimeString();
  };

  const getStatusLabel = (state: WebRTCConnectionState) => {
    switch (state) {
      case 'ready':
        return 'Ready to transfer';
      case 'connected':
        return 'Connected: DataChannel negotiating';
      case 'connecting':
        return 'Establishing connection';
      case 'waiting':
        return 'Waiting for peer';
      case 'disconnected':
        return 'Disconnected';
      case 'failed':
        return 'Connection failed';
      default:
        return state;
    }
  };

  const getStatusBadgeStyle = (state: WebRTCConnectionState) => {
    switch (state) {
      case 'ready':
        return 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300';
      case 'connected':
        return 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300';
      case 'connecting':
        return 'bg-amber-950/60 border-amber-500/40 text-amber-300 animate-pulse';
      case 'failed':
        return 'bg-rose-950/60 border-rose-500/40 text-rose-300';
      default:
        return 'bg-midnight-raised border-midnight-border text-slate-400';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-xl bg-midnight-void border border-midnight-border rounded-xl shadow-2xl overflow-hidden p-5 relative space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-midnight-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <ChartLineUp size={20} weight="bold" className="text-signal-cyan" aria-hidden="true" />
            <h2 id="diagnostics-modal-title" className="text-base font-bold text-white">
              Connection Diagnostics
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyDiagnostics}
              disabled={!diagnostics}
              aria-label="Copy diagnostics JSON"
              className="px-2.5 py-1.5 rounded-lg bg-midnight-raised hover:bg-midnight-highlight border border-midnight-border text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-mono flex items-center gap-1.5 min-h-[36px]"
            >
              {copied ? (
                <>
                  <Check size={14} weight="bold" className="text-emerald-400" aria-hidden="true" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={14} weight="bold" aria-hidden="true" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close diagnostics dialog"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-midnight-raised transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
            >
              <X size={18} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Current Truthful State Banner */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-midnight-base/60 border-midnight-border flex-shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Transfer Readiness:</span>
            <span
              className={`text-xs px-2.5 py-1 rounded-md font-mono border font-semibold ${
                diagnostics?.isReadyToTransfer
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              }`}
            >
              {diagnostics?.isReadyToTransfer ? 'Ready to transfer' : 'Transfer blocked'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Connection:</span>
            <span
              className={`text-xs px-2.5 py-1 rounded-md font-mono border ${getStatusBadgeStyle(
                connectionState
              )}`}
            >
              {getStatusLabel(connectionState)}
            </span>
          </div>
        </div>

        {/* Diagnostics Table */}
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {diagnostics ? (
            <div className="divide-y divide-midnight-border border border-midnight-border rounded-lg bg-midnight-base/40 text-xs font-mono">
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">Local Peer ID</span>
                <span className="text-white truncate max-w-[240px]">{diagnostics.peerId}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">Remote Peer ID</span>
                <span className="text-white truncate max-w-[240px]">
                  {diagnostics.remotePeerId || 'Awaiting peer'}
                </span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">Active Room ID</span>
                <span className="text-signal-cyan font-bold">{diagnostics.roomId}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">Connection Role</span>
                <span className="text-slate-200 capitalize">{diagnostics.connectionRole}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">Signaling Mode</span>
                <span className="text-slate-200">
                  {diagnostics.signalingMode === 'firebase' ? 'Firebase Cloud' : 'Local Broadcast'}
                </span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">Signaling State</span>
                <span className="text-slate-200">{diagnostics.signalingState}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">Peer Connection State</span>
                <span
                  className={
                    diagnostics.peerConnectionState === 'connected'
                      ? 'text-emerald-400'
                      : diagnostics.peerConnectionState === 'connecting'
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }
                >
                  {diagnostics.peerConnectionState}
                </span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">ICE Connection State</span>
                <span
                  className={
                    diagnostics.iceConnectionState === 'connected' ||
                    diagnostics.iceConnectionState === 'completed'
                      ? 'text-emerald-400'
                      : diagnostics.iceConnectionState === 'checking'
                      ? 'text-amber-400'
                      : 'text-slate-300'
                  }
                >
                  {diagnostics.iceConnectionState}
                </span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">ICE Gathering State</span>
                <span className="text-slate-200">{diagnostics.iceGatheringState}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">DataChannel ReadyState</span>
                <span
                  className={
                    diagnostics.dataChannelReadyState === 'open'
                      ? 'text-emerald-400 font-bold'
                      : diagnostics.dataChannelReadyState === 'connecting'
                      ? 'text-amber-400'
                      : 'text-slate-400'
                  }
                >
                  {diagnostics.dataChannelReadyState}
                </span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">DataChannel Label</span>
                <span className="text-slate-200">{diagnostics.dataChannelLabel}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">Candidate Route</span>
                <span className="text-slate-200 capitalize">{diagnostics.routeType}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">PeerConnection Created</span>
                <span className="text-slate-300">{formatTimestamp(diagnostics.connectionCreatedAt)}</span>
              </div>
              <div className="p-2.5 flex items-center justify-between">
                <span className="text-slate-400">DataChannel Opened</span>
                <span className="text-slate-300">{formatTimestamp(diagnostics.dataChannelOpenedAt)}</span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-400 text-center py-6 font-mono">
              Diagnostics telemetry initializing...
            </p>
          )}
        </div>

        {/* Security / Privacy reassurance notice */}
        <div className="text-[11px] text-slate-500 font-mono text-center pt-2 border-t border-midnight-border flex-shrink-0">
          Signaling coordinates only: file payloads never pass through telemetry or signaling servers.
        </div>
      </div>
    </div>
  );
};
