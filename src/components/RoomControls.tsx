import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, QrCode, ArrowsClockwise, LinkSimple, Camera } from '@phosphor-icons/react';
import QRCode from 'qrcode';

interface RoomControlsProps {
  roomId: string;
  onGenerateNewRoom: () => void;
  onJoinRoom: (targetRoomId: string) => void;
  onOpenScanner?: () => void;
}

export const RoomControls: React.FC<RoomControlsProps> = ({
  roomId,
  onGenerateNewRoom,
  onJoinRoom,
  onOpenScanner
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [joinInput, setJoinInput] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [joinError, setJoinError] = useState('');
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const roomUrl = `${window.location.origin}${window.location.pathname}#${roomId}`;

  useEffect(() => {
    if (showQr && qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        roomUrl,
        {
          width: 200,
          margin: 1,
          color: {
            dark: '#F8FAFC',
            light: '#0D1322'
          }
        },
        (error) => {
          if (error) console.error('QR code render error', error);
        }
      );
    }
  }, [showQr, roomUrl]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // ignore clipboard error
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = joinInput.trim().toUpperCase();
    if (!cleanId) {
      setJoinError('Please enter a room code');
      return;
    }
    if (!/^[A-Z0-9]{4,12}$/.test(cleanId)) {
      setJoinError('Room code must be 4 to 12 alphanumeric characters');
      return;
    }
    if (cleanId === roomId) {
      setJoinError('You are already in this room');
      return;
    }
    setJoinError('');
    onJoinRoom(cleanId);
    setJoinInput('');
  };

  return (
    <div className="w-full bg-midnight-void border border-midnight-border rounded-xl p-4 sm:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Current Room & Sharing */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono tracking-wider text-slate-400">
              Active Room Key
            </span>
            <button
              type="button"
              onClick={onGenerateNewRoom}
              className="text-xs text-signal-cyan hover:text-signal-cyan-bright flex items-center gap-1 font-mono transition-colors cursor-pointer min-h-[44px] px-2 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
            >
              <ArrowsClockwise size={14} weight="bold" aria-hidden="true" />
              <span>New Room</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-midnight-base border border-midnight-border rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between min-w-0">
              <span className="font-mono text-lg sm:text-2xl font-bold tracking-widest text-signal-cyan-bright truncate">
                {roomId}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                aria-label="Copy room key"
                className="p-2 rounded hover:bg-midnight-raised text-slate-400 hover:text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan flex-shrink-0"
              >
                {copiedCode ? (
                  <Check size={18} weight="bold" className="text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy size={18} weight="bold" aria-hidden="true" />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              title="Copy direct join link"
              aria-label="Copy direct pairing link"
              className="px-3 py-2.5 sm:py-3 rounded-lg bg-midnight-raised hover:bg-midnight-highlight border border-midnight-border text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan flex-shrink-0"
            >
              {copiedLink ? (
                <Check size={18} weight="bold" className="text-emerald-400" aria-hidden="true" />
              ) : (
                <LinkSimple size={18} weight="bold" aria-hidden="true" />
              )}
              <span className="text-xs font-mono hidden sm:inline">
                {copiedLink ? 'Copied' : 'Link'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              title="Toggle QR code for camera pairing"
              aria-label={showQr ? 'Hide pairing QR code' : 'Show pairing QR code'}
              className={`p-2.5 sm:p-3 rounded-lg border transition-colors flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan flex-shrink-0 ${
                showQr
                  ? 'bg-signal-cyan/20 border-signal-cyan text-signal-cyan-bright'
                  : 'bg-midnight-raised hover:bg-midnight-highlight border-midnight-border text-slate-300 hover:text-white'
              }`}
            >
              <QrCode size={18} weight="bold" aria-hidden="true" />
            </button>

            {onOpenScanner && (
              <button
                type="button"
                onClick={onOpenScanner}
                title="Scan QR Code with camera"
                aria-label="Scan QR Code with camera"
                className="p-2.5 sm:p-3 rounded-lg bg-midnight-raised hover:bg-midnight-highlight border border-midnight-border text-signal-cyan-bright hover:text-white transition-colors flex items-center justify-center cursor-pointer min-h-[44px] min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan flex-shrink-0"
              >
                <Camera size={18} weight="bold" aria-hidden="true" />
              </button>
            )}
          </div>

          {/* QR Code Canvas Tray */}
          {showQr && (
            <div className="p-4 bg-midnight-base border border-midnight-highlight rounded-lg flex flex-col items-center justify-center gap-2">
              <canvas ref={qrCanvasRef} className="rounded" />
              <p className="text-xs text-slate-400 font-mono text-center">
                Scan with phone camera to connect instantly
              </p>
            </div>
          )}
        </div>

        {/* Right: Join Another Room */}
        <div className="space-y-3">
          <span className="text-xs uppercase font-mono tracking-wider text-slate-400 block">
            Join Existing Room
          </span>

          <form onSubmit={handleJoinSubmit} className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <label htmlFor="join-room-input" className="sr-only">
                  Enter 6-character room code
                </label>
                <input
                  id="join-room-input"
                  type="text"
                  value={joinInput}
                  onChange={(e) => {
                    setJoinInput(e.target.value);
                    if (joinError) setJoinError('');
                  }}
                  placeholder="Enter Room Code (e.g. 7KX92M)"
                  maxLength={12}
                  className="w-full bg-midnight-base border border-midnight-border rounded-lg px-4 py-3 text-white placeholder-slate-500 font-mono text-sm focus:border-signal-cyan focus:outline-none min-h-[44px]"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-3 rounded-lg bg-midnight-raised hover:bg-midnight-highlight border border-midnight-border text-white text-sm font-semibold transition-colors cursor-pointer min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
              >
                Connect
              </button>
            </div>
            {joinError && (
              <p className="text-xs text-rose-400 font-mono pl-1">{joinError}</p>
            )}
          </form>
          <p className="text-xs text-slate-500">
            Both devices must be in the same room to discover each other.
          </p>
        </div>
      </div>
    </div>
  );
};

