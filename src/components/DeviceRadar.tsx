import React from 'react';
import {
  Desktop,
  DeviceMobile,
  WifiHigh,
  WifiSlash,
  CheckCircle
} from '@phosphor-icons/react';
import { PeerDevice, WebRTCConnectionState, CandidateRouteType } from '../types';

interface DeviceRadarProps {
  localDevice: PeerDevice;
  remoteDevice: PeerDevice | null;
  connectionState: WebRTCConnectionState;
  routeType: CandidateRouteType;
}

export const DeviceRadar: React.FC<DeviceRadarProps> = ({
  localDevice,
  remoteDevice,
  connectionState,
  routeType
}) => {
  const isMobile = (os: string) => /iOS|Android/i.test(os);

  return (
    <div className="w-full bg-midnight-void border border-midnight-border rounded-xl p-4 sm:p-6 relative overflow-hidden">
      {/* Structural background visual */}
      <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
        <div className="w-64 h-64 sm:w-96 sm:h-96 rounded-full border border-midnight-highlight border-dashed" />
        <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full border border-midnight-highlight absolute" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-8">
        {/* Local Node */}
        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-midnight-raised border border-signal-cyan/40 flex items-center justify-center text-signal-cyan-bright shadow-lg shadow-cyan-950/20 flex-shrink-0">
            {isMobile(localDevice.os) ? (
              <DeviceMobile size={24} weight="bold" aria-hidden="true" />
            ) : (
              <Desktop size={24} weight="bold" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm sm:text-base truncate">{localDevice.name}</span>
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-signal-cyan/10 border border-signal-cyan/30 text-signal-cyan font-mono">
                This Device
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">ID: {localDevice.id}</p>
          </div>
        </div>

        {/* Link / Channel Visualization */}
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-xs my-1 md:my-0">
          <div className="w-full flex items-center justify-center gap-2 relative">
            <div
              className={`h-0.5 flex-1 transition-all duration-500 ${
                connectionState === 'connected'
                  ? 'bg-gradient-to-r from-signal-cyan to-signal-violet'
                  : connectionState === 'connecting'
                  ? 'bg-signal-cyan/40 animate-pulse'
                  : 'bg-midnight-highlight border-t border-dashed border-slate-700'
              }`}
            />
            <div
              className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 ${
                connectionState === 'connected'
                  ? 'bg-midnight-raised border-signal-cyan text-signal-cyan-bright'
                  : connectionState === 'connecting'
                  ? 'bg-midnight-raised border-amber-500/50 text-amber-400 animate-pulse'
                  : 'bg-midnight-raised border-midnight-border text-slate-500'
              }`}
            >
              {connectionState === 'connected' ? (
                <CheckCircle size={16} weight="bold" aria-hidden="true" />
              ) : connectionState === 'connecting' ? (
                <WifiHigh size={16} weight="bold" aria-hidden="true" />
              ) : (
                <WifiSlash size={16} weight="bold" aria-hidden="true" />
              )}
            </div>
            <div
              className={`h-0.5 flex-1 transition-all duration-500 ${
                connectionState === 'connected'
                  ? 'bg-gradient-to-r from-signal-cyan to-signal-violet'
                  : connectionState === 'connecting'
                  ? 'bg-signal-cyan/40 animate-pulse'
                  : 'bg-midnight-highlight border-t border-dashed border-slate-700'
              }`}
            />
          </div>

          <div className="mt-1.5 text-center">
            {connectionState === 'connected' ? (
              <span className="text-xs font-mono text-emerald-400">
                WebRTC DataChannel Active ({routeType === 'relayed' ? 'Relay' : 'Direct'})
              </span>
            ) : connectionState === 'connecting' ? (
              <span className="text-xs font-mono text-amber-400">Exchanging Coordinates</span>
            ) : (
              <span className="text-xs font-mono text-slate-400">Awaiting Peer in Room</span>
            )}
          </div>
        </div>

        {/* Remote Peer Node */}
        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto justify-start md:justify-end">
          {remoteDevice ? (
            <>
              <div className="text-left md:text-right order-2 md:order-1 min-w-0">
                <div className="flex items-center md:justify-end gap-2 flex-wrap">
                  <span className="font-semibold text-white text-sm sm:text-base truncate">{remoteDevice.name}</span>
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-signal-violet/10 border border-signal-violet/30 text-signal-violet-bright font-mono">
                    Remote Peer
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">ID: {remoteDevice.id}</p>
              </div>
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-midnight-raised border border-signal-violet/40 flex items-center justify-center text-signal-violet-bright shadow-lg shadow-violet-950/20 flex-shrink-0 order-1 md:order-2">
                {isMobile(remoteDevice.os) ? (
                  <DeviceMobile size={24} weight="bold" aria-hidden="true" />
                ) : (
                  <Desktop size={24} weight="bold" aria-hidden="true" />
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 border border-dashed border-midnight-highlight rounded-xl p-2.5 sm:p-3 bg-midnight-base/40 w-full md:w-auto">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-midnight-raised border border-midnight-border flex items-center justify-center text-slate-500 flex-shrink-0">
                <WifiSlash size={18} weight="bold" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-medium text-slate-300">No Peer Connected</p>
                <p className="text-[11px] sm:text-xs text-slate-400">Share or scan room key</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
