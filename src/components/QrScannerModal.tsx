import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CameraSlash,
  X,
  WarningCircle,
  Keyboard,
  CircleNotch
} from '@phosphor-icons/react';
import jsQR from 'jsqr';
import { CameraState } from '../types';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedRoomId: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess
}) => {
  const [cameraState, setCameraState] = useState<CameraState>('requesting_permission');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [manualError, setManualError] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stop all camera tracks and animation cleanly
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore
      }
      videoRef.current.srcObject = null;
    }
  };

  // Start camera stream when modal opens
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setErrorMessage('');
      setCameraState('requesting_permission');
      return;
    }

    let isMounted = true;

    const handleCameraError = (err: any) => {
      if (!isMounted) return;
      console.warn('Camera initialization error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraState('denied');
        setErrorMessage(
          'Camera permission was denied. Allow camera permissions in your browser or device settings, or enter the room code manually below.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraState('unavailable');
        setErrorMessage('No camera device was detected on this hardware.');
      } else {
        setCameraState('failed');
        setErrorMessage(err.message || 'Unable to access camera feed.');
      }
    };

    // Check secure context requirement
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setCameraState('unavailable');
      setErrorMessage(
        'Camera access requires a Secure Context (HTTPS or localhost). On local networks, serve via HTTPS or enter the room code manually.'
      );
      return;
    }

    // Check mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraState('unavailable');
      setErrorMessage(
        'Camera access is not supported by this browser. Please use manual room entry.'
      );
      return;
    }

    async function startCamera() {
      setCameraState('requesting_permission');
      setErrorMessage('');

      let stream: MediaStream;

      // Prefer rear camera on mobile devices with fallback to standard camera
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err: any) {
        if (
          err.name === 'OverconstrainedError' ||
          err.name === 'ConstraintNotSatisfiedError'
        ) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
          } catch (fallbackErr: any) {
            handleCameraError(fallbackErr);
            return;
          }
        } else {
          handleCameraError(err);
          return;
        }
      }

      if (!isMounted) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      setCameraState('initializing');

      const video = videoRef.current;
      if (!video) {
        setCameraState('failed');
        setErrorMessage('Video presentation element could not be initialized.');
        return;
      }

      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('autoplay', 'true');
      video.setAttribute('muted', 'true');

      // Await video metadata to guarantee frame dimensions are ready
      try {
        if (video.readyState < video.HAVE_METADATA) {
          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
              video.removeEventListener('loadedmetadata', onLoaded);
              video.removeEventListener('error', onError);
              resolve();
            };
            const onError = () => {
              video.removeEventListener('loadedmetadata', onLoaded);
              video.removeEventListener('error', onError);
              reject(new Error('Failed loading video stream metadata.'));
            };
            video.addEventListener('loadedmetadata', onLoaded);
            video.addEventListener('error', onError);
          });
        }

        if (!isMounted) return;
        await video.play();
        if (!isMounted) return;

        setCameraState('ready');
        startScanningLoop();
      } catch (playErr: any) {
        if (!isMounted) return;
        console.warn('Video play execution failed:', playErr);
        setCameraState('failed');
        setErrorMessage('Failed to start camera video playback. Please enter room code manually.');
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Extract clean room code from scanned string
  const parseRoomCode = (rawText: string): string | null => {
    if (!rawText) return null;
    const text = rawText.trim();
    // Check for URL hash (e.g., https://domain/#ROOMID)
    const hashIndex = text.indexOf('#');
    if (hashIndex !== -1 && hashIndex < text.length - 1) {
      const code = text.substring(hashIndex + 1).trim().toUpperCase();
      if (/^[A-Z0-9]{4,12}$/.test(code)) return code;
    }
    // Check for query param (?room=ROOMID)
    const match = text.match(/[?&]room=([A-Z0-9]{4,12})/i);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
    // Plain room code
    const clean = text.toUpperCase();
    if (/^[A-Z0-9]{4,12}$/.test(clean)) {
      return clean;
    }
    return null;
  };

  const handleDetectedCode = (code: string) => {
    stopCamera();
    onScanSuccess(code);
    onClose();
  };

  // Frame scanning loop
  const startScanningLoop = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Native BarcodeDetector if available
    const hasBarcodeDetector = 'BarcodeDetector' in window;
    let nativeDetector: any = null;
    if (hasBarcodeDetector) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch {
        nativeDetector = null;
      }
    }

    const scanFrame = async () => {
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animationFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // 1. Try Native BarcodeDetector
      if (nativeDetector) {
        try {
          const barcodes = await nativeDetector.detect(video);
          if (barcodes && barcodes.length > 0) {
            for (const barcode of barcodes) {
              const code = parseRoomCode(barcode.rawValue);
              if (code) {
                handleDetectedCode(code);
                return;
              }
            }
          }
        } catch {
          // Fall back to jsQR
        }
      }

      // 2. jsQR Fallback
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (qrResult && qrResult.data) {
          const code = parseRoomCode(qrResult.data);
          if (code) {
            handleDetectedCode(code);
            return;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animationFrameRef.current = requestAnimationFrame(scanFrame);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim().toUpperCase();
    if (!clean || !/^[A-Z0-9]{4,12}$/.test(clean)) {
      setManualError('Enter a valid 4 to 12 character room code');
      return;
    }
    setManualError('');
    handleDetectedCode(clean);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-scanner-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div className="w-full max-w-md bg-midnight-void border border-midnight-border rounded-xl shadow-2xl overflow-hidden p-5 relative space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-midnight-border">
          <div className="flex items-center gap-2">
            <Camera size={20} weight="bold" className="text-signal-cyan" aria-hidden="true" />
            <h2 id="qr-scanner-title" className="text-base font-bold text-white">
              Scan Room QR Code
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR scanner dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-midnight-raised transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
          >
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>

        {/* Video Camera Viewport: Video element is ALWAYS mounted to prevent React ref race conditions */}
        <div className="relative w-full aspect-square max-h-72 bg-midnight-base rounded-lg overflow-hidden border border-midnight-highlight flex items-center justify-center">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${cameraState === 'ready' ? 'block' : 'opacity-0 absolute inset-0 pointer-events-none'}`}
            muted
            autoPlay
            playsInline
          />

          {/* Active Scanner View: Visible only when cameraState is ready */}
          {cameraState === 'ready' && (
            <>
              {/* Aiming Reticle */}
              <div className="absolute inset-8 border-2 border-signal-cyan/60 rounded-lg pointer-events-none flex items-center justify-center shadow-sm">
                <div className="w-full h-0.5 bg-signal-cyan/40 animate-pulse" />
              </div>
              <p className="absolute bottom-2 text-[11px] font-mono text-slate-300 bg-midnight-base/80 px-2 py-0.5 rounded">
                Point camera at desktop screen QR code
              </p>
            </>
          )}

          {/* Overlay States for non-ready states */}
          {cameraState !== 'ready' && (
            <div className="p-4 text-center space-y-3 z-10 max-w-xs">
              {cameraState === 'requesting_permission' && (
                <>
                  <div className="w-12 h-12 rounded-full bg-midnight-raised border border-midnight-border mx-auto flex items-center justify-center text-signal-cyan animate-pulse">
                    <Camera size={24} weight="bold" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-white font-medium">Requesting camera permission</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Please allow camera access in the browser prompt</p>
                  </div>
                </>
              )}

              {cameraState === 'initializing' && (
                <>
                  <div className="w-12 h-12 rounded-full bg-midnight-raised border border-midnight-border mx-auto flex items-center justify-center text-signal-cyan">
                    <CircleNotch size={24} weight="bold" className="animate-spin" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-white font-medium">Initialising camera feed</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Starting video streaming...</p>
                  </div>
                </>
              )}

              {cameraState === 'denied' && (
                <>
                  <div className="w-12 h-12 rounded-full bg-midnight-raised border border-rose-500/30 mx-auto flex items-center justify-center text-rose-400">
                    <CameraSlash size={24} weight="bold" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-rose-300 font-medium">Permission denied</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Camera access was blocked by the browser</p>
                  </div>
                </>
              )}

              {cameraState === 'unavailable' && (
                <>
                  <div className="w-12 h-12 rounded-full bg-midnight-raised border border-midnight-border mx-auto flex items-center justify-center text-slate-400">
                    <CameraSlash size={24} weight="bold" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-300 font-medium">Camera unavailable</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Secure context or camera hardware required</p>
                  </div>
                </>
              )}

              {cameraState === 'failed' && (
                <>
                  <div className="w-12 h-12 rounded-full bg-midnight-raised border border-amber-500/30 mx-auto flex items-center justify-center text-amber-400">
                    <WarningCircle size={24} weight="bold" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs text-amber-300 font-medium">Scanner failed</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Could not start video stream</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Detailed Status / Error Notice */}
        {errorMessage && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-lg text-xs text-amber-200 flex items-start gap-2">
            <WarningCircle size={16} weight="bold" className="text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Manual Room Entry Fallback: Always Available in all camera states */}
        <div className="pt-2 border-t border-midnight-border space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Keyboard size={14} weight="bold" aria-hidden="true" />
            <span>Manual Code Fallback</span>
          </div>

          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <label htmlFor="modal-room-input" className="sr-only">
                Enter room code manually
              </label>
              <input
                id="modal-room-input"
                type="text"
                value={manualCode}
                onChange={(e) => {
                  setManualCode(e.target.value);
                  if (manualError) setManualError('');
                }}
                placeholder="4 to 12 character Room Key"
                maxLength={12}
                className="w-full bg-midnight-base border border-midnight-border rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-signal-cyan focus:outline-none min-h-[44px]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-signal-cyan hover:bg-signal-cyan-bright text-midnight-base font-semibold text-xs min-h-[44px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
            >
              Join
            </button>
          </form>
          {manualError && (
            <p className="text-xs text-rose-400 font-mono">{manualError}</p>
          )}
        </div>
      </div>
    </div>
  );
};
