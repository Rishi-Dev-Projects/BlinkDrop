import React, { useRef, useState } from 'react';
import {
  UploadSimple,
  FileText,
  FileImage,
  FileArchive,
  FileVideo,
  FileAudio,
  Trash,
  PaperPlaneTilt
} from '@phosphor-icons/react';
import { FileTransferItem, WebRTCConnectionState } from '../types';
import { formatBytes } from '../utils/format';

interface FileStagingProps {
  stagedFiles: FileTransferItem[];
  connectionState: WebRTCConnectionState;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (fileId: string) => void;
  onSendFile: (fileId: string) => void;
  onSendAll: () => void;
}

export const FileStaging: React.FC<FileStagingProps> = ({
  stagedFiles,
  connectionState,
  onAddFiles,
  onRemoveFile,
  onSendFile,
  onSendAll
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(Array.from(e.target.files));
      e.target.value = ''; // Reset input to allow selecting same file again
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <FileImage size={24} weight="bold" className="text-signal-cyan" aria-hidden="true" />;
    if (mimeType.startsWith('video/')) return <FileVideo size={24} weight="bold" className="text-signal-violet-bright" aria-hidden="true" />;
    if (mimeType.startsWith('audio/')) return <FileAudio size={24} weight="bold" className="text-amber-400" aria-hidden="true" />;
    if (/zip|tar|gz|rar|7z/i.test(mimeType)) return <FileArchive size={24} weight="bold" className="text-emerald-400" aria-hidden="true" />;
    return <FileText size={24} weight="bold" className="text-slate-300" aria-hidden="true" />;
  };

  const isReadyToTransfer = connectionState === 'ready';

  const getStatusNotice = () => {
    switch (connectionState) {
      case 'waiting':
        return 'Notice: Waiting for remote peer to join room.';
      case 'connecting':
        return 'Notice: Establishing WebRTC connection...';
      case 'connected':
        return 'Notice: WebRTC peer connected, opening secure DataChannel...';
      case 'disconnected':
        return 'Notice: Remote peer disconnected.';
      case 'failed':
        return 'Notice: WebRTC connection failed. Check STUN/TURN or network connection.';
      default:
        return '';
    }
  };

  return (
    <div className="w-full bg-midnight-void border border-midnight-border rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-white">Send Files</h2>
          <p className="text-xs text-slate-400 mt-0.5">Files stream directly over peer DataChannel</p>
        </div>
        {stagedFiles.length > 1 && (
          <button
            type="button"
            onClick={onSendAll}
            disabled={!isReadyToTransfer}
            title={isReadyToTransfer ? 'Send all staged files' : 'WebRTC DataChannel must be open to transfer files'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium min-h-[44px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan ${
              isReadyToTransfer
                ? 'bg-signal-cyan hover:bg-signal-cyan-bright text-midnight-base font-semibold shadow-sm'
                : 'bg-midnight-raised border border-midnight-border text-slate-500 cursor-not-allowed'
            }`}
          >
            <PaperPlaneTilt size={16} weight="bold" aria-hidden="true" />
            <span>Send All ({stagedFiles.length})</span>
          </button>
        )}
      </div>

      {/* Accessible Drag & Drop / Mobile File Picker Trigger */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="Select files to send or drag and drop files here"
        className={`w-full border-2 border-dashed rounded-xl p-5 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan ${
          isDragging
            ? 'border-signal-cyan bg-signal-cyan/5 text-signal-cyan'
            : 'border-midnight-highlight hover:border-slate-500 bg-midnight-base/50 text-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
        <div className="w-12 h-12 rounded-full bg-midnight-raised border border-midnight-border flex items-center justify-center text-slate-300 mb-3">
          <UploadSimple size={24} weight="bold" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-slate-200">
          <span className="sm:hidden">Tap to choose files</span>
          <span className="hidden sm:inline">Drop files here or <span className="text-signal-cyan underline underline-offset-2">browse files</span></span>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Photos, videos, documents, direct peer-to-peer
        </p>
      </div>

      {/* Staged Files List */}
      {stagedFiles.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
            <span>Staged Queue ({stagedFiles.length})</span>
            <span>{formatBytes(stagedFiles.reduce((acc, f) => acc + f.size, 0))} Total</span>
          </div>

          <div className="divide-y divide-midnight-border border border-midnight-border rounded-lg bg-midnight-base/40 overflow-hidden">
            {stagedFiles.map((file) => (
              <div
                key={file.id}
                className="p-3 flex items-center justify-between gap-3 hover:bg-midnight-raised/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">{getFileIcon(file.mimeType)}</div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 font-medium truncate">{file.name}</p>
                    <p className="text-xs text-slate-400 font-mono">{formatBytes(file.size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendFile(file.id);
                    }}
                    disabled={!isReadyToTransfer}
                    title={isReadyToTransfer ? `Send ${file.name}` : 'WebRTC DataChannel must be open to transfer files'}
                    aria-label={`Send ${file.name}`}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium min-h-[44px] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan ${
                      isReadyToTransfer
                        ? 'bg-signal-cyan hover:bg-signal-cyan-bright text-midnight-base font-semibold'
                        : 'bg-midnight-raised border border-midnight-border text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <PaperPlaneTilt size={14} weight="bold" aria-hidden="true" />
                    <span>Send</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(file.id);
                    }}
                    aria-label={`Remove ${file.name} from queue`}
                    className="p-2 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                  >
                    <Trash size={16} weight="bold" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!isReadyToTransfer && (
            <p className="text-xs text-amber-400 font-mono mt-2 flex items-center gap-1.5">
              <span>{getStatusNotice()}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

