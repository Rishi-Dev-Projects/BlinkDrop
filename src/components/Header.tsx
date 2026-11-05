import React from 'react';
import {
  Broadcast,
  Gear,
  WifiHigh,
  WifiSlash,
  ShieldCheck,
  ShieldWarning
} from '@phosphor-icons/react';
import { CandidateRouteType, SignalingMode, WebRTCConnectionState } from '../types';

interface HeaderProps {
  signalingMode: SignalingMode;
  connectionState: WebRTCConnectionState;
  routeType: CandidateRouteType;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  signalingMode,
  connectionState,
  routeType,
  onOpenSettings
}) => {
  return (
    <header className="w-full border-b border-midnight-border bg-midnight-void/90 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-midnight-raised border border-midnight-border flex items-center justify-center text-signal-cyan shadow-sm">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" className="opacity-30" />
              <path d="M12 2a10 10 0 0 1 10 10" className="text-signal-cyan-bright" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">BlinkDrop</span>
              <span className="text-xs px-2 py-0.5 rounded bg-midnight-raised border border-midnight-border text-slate-400 font-mono">
                P2P
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Direct Browser File Transfer</p>
          </div>
        </div>

        {/* Telemetry and Settings actions */}
        <div className="flex items-center gap-3">
          {/* Route Status Badge */}
          {connectionState === 'connected' && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono border ${
                routeType === 'relayed'
                  ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                  : routeType === 'direct'
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-midnight-raised border-midnight-border text-slate-300'
              }`}
            >
              {routeType === 'relayed' ? (
                <>
                  <ShieldWarning size={14} weight="bold" aria-hidden="true" />
                  <span>Relayed: TURN</span>
                </>
              ) : routeType === 'direct' ? (
                <>
                  <ShieldCheck size={14} weight="bold" aria-hidden="true" />
                  <span>Direct: P2P</span>
                </>
              ) : (
                <>
                  <WifiHigh size={14} weight="bold" aria-hidden="true" />
                  <span>Connected</span>
                </>
              )}
            </div>
          )}

          {connectionState === 'connecting' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-midnight-raised border border-midnight-border text-signal-cyan animate-pulse">
              <WifiHigh size={14} weight="bold" aria-hidden="true" />
              <span>Handshaking...</span>
            </div>
          )}

          {connectionState === 'disconnected' && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-midnight-raised border border-midnight-border text-slate-400">
              <WifiSlash size={14} weight="bold" aria-hidden="true" />
              <span>Standby</span>
            </div>
          )}

          {/* Signaling Mode Tag */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-midnight-raised border border-midnight-border text-slate-300">
            <Broadcast size={14} weight="bold" className="text-signal-violet-bright" aria-hidden="true" />
            <span>{signalingMode === 'broadcast' ? 'Local Channel' : 'Firebase Cloud'}</span>
          </div>

          {/* Settings Trigger */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-lg bg-midnight-raised hover:bg-midnight-highlight border border-midnight-border text-slate-300 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
            aria-label="Open Signaling & Network Settings"
          >
            <Gear size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
};

