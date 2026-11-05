import React from 'react';
import {
  DownloadSimple,
  UploadSimple,
  WarningCircle,
  XCircle,
  Clock,
  ShieldCheck,
  FileArrowDown,
  X
} from '@phosphor-icons/react';
import { FileTransferItem } from '../types';
import { formatBytes, formatSpeed, formatEta } from '../utils/format';

interface TransferConsoleProps {
  transfers: FileTransferItem[];
  onAcceptFile: (fileId: string) => void;
  onRejectFile: (fileId: string) => void;
  onCancelTransfer: (fileId: string) => void;
  onDismissTransfer: (fileId: string) => void;
}

export const TransferConsole: React.FC<TransferConsoleProps> = ({
  transfers,
  onAcceptFile,
  onRejectFile,
  onCancelTransfer,
  onDismissTransfer
}) => {
  if (transfers.length === 0) {
    return (
      <div className="w-full bg-midnight-void border border-midnight-border rounded-xl p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-midnight-raised border border-midnight-border mx-auto flex items-center justify-center text-slate-500 mb-3">
          <FileArrowDown size={24} weight="bold" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-slate-300">No Active Transfers</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Files sent or received over the peer connection will appear here with live speed and verification telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-midnight-void border border-midnight-border rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Transfer Activity</h2>
          <p className="text-xs text-slate-400 mt-0.5">Real-time WebRTC DataChannel stream</p>
        </div>
        <span className="text-xs font-mono text-slate-400 px-2 py-1 rounded bg-midnight-raised border border-midnight-border">
          {transfers.length} {transfers.length === 1 ? 'Item' : 'Items'}
        </span>
      </div>

      <div className="space-y-3">
        {transfers.map((item) => {
          const percent = item.size > 0 ? Math.min(100, Math.floor((item.bytesTransferred / item.size) * 100)) : 0;
          const bytesRemaining = Math.max(0, item.size - item.bytesTransferred);

          return (
            <div
              key={item.id}
              className="bg-midnight-base border border-midnight-border rounded-xl p-4 space-y-3"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.direction === 'send'
                        ? 'bg-signal-cyan/10 border border-signal-cyan/30 text-signal-cyan'
                        : 'bg-signal-violet/10 border border-signal-violet/30 text-signal-violet-bright'
                    }`}
                  >
                    {item.direction === 'send' ? (
                      <UploadSimple size={18} weight="bold" aria-hidden="true" />
                    ) : (
                      <DownloadSimple size={18} weight="bold" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                      <span>{item.direction === 'send' ? 'Outbound' : 'Inbound'}</span>
                      <span>•</span>
                      <span>{formatBytes(item.size)}</span>
                    </div>
                  </div>
                </div>

                {/* Status Badge & Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {item.status === 'awaiting_approval' && (
                    item.direction === 'receive' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onAcceptFile(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-signal-cyan hover:bg-signal-cyan-bright text-midnight-base text-xs font-semibold min-h-[44px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectFile(item.id)}
                          className="px-3 py-1.5 rounded-lg bg-midnight-raised hover:bg-rose-950/40 border border-midnight-border hover:border-rose-800 text-slate-300 hover:text-rose-300 text-xs font-medium min-h-[44px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          Decline
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-amber-300 animate-pulse">
                          Awaiting Approval
                        </span>
                        <button
                          type="button"
                          onClick={() => onCancelTransfer(item.id)}
                          aria-label={`Cancel transfer for ${item.name}`}
                          className="p-2 rounded hover:bg-midnight-raised text-slate-400 hover:text-rose-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        >
                          <X size={16} weight="bold" aria-hidden="true" />
                        </button>
                      </div>
                    )
                  )}

                  {item.status === 'transferring' && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-signal-cyan animate-pulse">
                        Transferring
                      </span>
                      <button
                        type="button"
                        onClick={() => onCancelTransfer(item.id)}
                        aria-label={`Cancel transfer for ${item.name}`}
                        className="p-2 rounded hover:bg-midnight-raised text-slate-400 hover:text-rose-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <X size={16} weight="bold" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {item.status === 'verifying' && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/40 border border-amber-800 text-amber-300 text-xs font-mono">
                      <Clock size={14} weight="bold" className="animate-spin" aria-hidden="true" />
                      <span>Verifying ACK</span>
                    </div>
                  )}

                  {item.status === 'completed' && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800">
                        <ShieldCheck size={14} weight="bold" aria-hidden="true" />
                        <span>Verified</span>
                      </span>

                      {item.direction === 'receive' && item.blobUrl && (
                        <a
                          href={item.blobUrl}
                          download={item.name}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-signal-cyan hover:bg-signal-cyan-bright text-midnight-base text-xs font-semibold min-h-[44px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
                        >
                          <DownloadSimple size={14} weight="bold" aria-hidden="true" />
                          <span>Save File</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => onDismissTransfer(item.id)}
                        aria-label="Dismiss completed transfer"
                        className="p-2 rounded text-slate-400 hover:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        <X size={16} weight="bold" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {(item.status === 'failed' || item.status === 'rejected' || item.status === 'cancelled') && (
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs font-mono text-rose-400 px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800">
                        <XCircle size={14} weight="bold" aria-hidden="true" />
                        <span>
                          {item.status === 'rejected'
                            ? 'Declined'
                            : item.status === 'cancelled'
                            ? 'Cancelled'
                            : 'Failed'}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onDismissTransfer(item.id)}
                        aria-label="Dismiss error notification"
                        className="p-2 rounded text-slate-400 hover:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      >
                        <X size={16} weight="bold" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Bar & Telemetry */}
              {(item.status === 'transferring' || item.status === 'verifying') && (
                <div className="space-y-1.5">
                  <div className="w-full bg-midnight-raised rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${
                        item.status === 'verifying'
                          ? 'bg-amber-400'
                          : 'bg-gradient-to-r from-signal-cyan to-signal-cyan-bright'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-mono text-slate-400">
                    <span>
                      {formatBytes(item.bytesTransferred)} / {formatBytes(item.size)} ({percent}%)
                    </span>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span>Rate: {formatSpeed(item.speedBps)}</span>
                      <span>ETA: {formatEta(bytesRemaining, item.speedBps)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Inline Failure Reason */}
              {item.errorMessage && (
                <p className="text-xs text-rose-400 font-mono flex items-center gap-1.5">
                  <WarningCircle size={14} weight="bold" aria-hidden="true" />
                  <span>{item.errorMessage}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
