import React, { useState, useEffect } from 'react';
import { X, Broadcast, Fire, Check, ShieldCheck } from '@phosphor-icons/react';
import { SignalingMode, FirebaseConfig } from '../types';

interface SignalingSettingsModalProps {
  isOpen: boolean;
  currentMode: SignalingMode;
  currentFirebaseConfig: FirebaseConfig | null;
  onClose: () => void;
  onSave: (mode: SignalingMode, config: FirebaseConfig | null) => void;
}

export const SignalingSettingsModal: React.FC<SignalingSettingsModalProps> = ({
  isOpen,
  currentMode,
  currentFirebaseConfig,
  onClose,
  onSave
}) => {
  const [mode, setMode] = useState<SignalingMode>(currentMode);
  const [apiKey, setApiKey] = useState(currentFirebaseConfig?.apiKey || '');
  const [projectId, setProjectId] = useState(currentFirebaseConfig?.projectId || '');
  const [appId, setAppId] = useState(currentFirebaseConfig?.appId || '');
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setMode(currentMode);
    if (currentFirebaseConfig) {
      setApiKey(currentFirebaseConfig.apiKey || '');
      setProjectId(currentFirebaseConfig.projectId || '');
      setAppId(currentFirebaseConfig.appId || '');
    }
  }, [currentMode, currentFirebaseConfig, isOpen]);

  // Handle Escape key to close dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'firebase') {
      if (!apiKey.trim() || !projectId.trim() || !appId.trim()) {
        setValidationError('Please complete the API Key, Project ID, and App ID fields');
        return;
      }
      setValidationError('');
      const config: FirebaseConfig = {
        apiKey: apiKey.trim(),
        projectId: projectId.trim(),
        appId: appId.trim(),
        authDomain: `${projectId.trim()}.firebaseapp.com`
      };
      onSave('firebase', config);
    } else {
      setValidationError('');
      onSave('broadcast', null);
    }
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 1000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg bg-midnight-void border border-midnight-border rounded-xl shadow-2xl overflow-hidden p-6 relative">
        <div className="flex items-center justify-between pb-4 border-b border-midnight-border">
          <div className="flex items-center gap-2">
            <h2 id="modal-title" className="text-lg font-bold text-white">
              Signaling Network Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings dialog"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-midnight-raised transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
          >
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          {/* Channel Selector */}
          <div className="space-y-2">
            <label className="text-xs uppercase font-mono tracking-wider text-slate-400 block">
              Signaling Rendezvous Channel
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('broadcast')}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan ${
                  mode === 'broadcast'
                    ? 'border-signal-cyan bg-signal-cyan/10 text-white'
                    : 'border-midnight-border hover:border-slate-600 bg-midnight-base text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-white">
                  <Broadcast size={18} weight="bold" className="text-signal-cyan" aria-hidden="true" />
                  <span>Local Broadcast</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Zero setup. Immediate testing across browser tabs or windows on this machine.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode('firebase')}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan ${
                  mode === 'firebase'
                    ? 'border-signal-violet bg-signal-violet/10 text-white'
                    : 'border-midnight-border hover:border-slate-600 bg-midnight-base text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-white">
                  <Fire size={18} weight="bold" className="text-signal-violet-bright" aria-hidden="true" />
                  <span>Firebase Cloud</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Cross-device and cross-network pairing via Firestore document exchange.
                </p>
              </button>
            </div>
          </div>

          {/* Firebase Configuration Form (if selected) */}
          {mode === 'firebase' && (
            <div className="space-y-3 p-4 bg-midnight-base border border-midnight-border rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-300 font-semibold">
                  Firebase Project Credentials
                </span>
                <span className="text-[11px] font-mono text-slate-500">Stored locally in browser</span>
              </div>

              <div>
                <label htmlFor="fb-api-key" className="text-xs text-slate-400 font-mono block mb-1">
                  API Key
                </label>
                <input
                  id="fb-api-key"
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-midnight-void border border-midnight-border rounded px-3 py-2 text-sm text-white font-mono focus:border-signal-cyan focus:outline-none min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="fb-project-id" className="text-xs text-slate-400 font-mono block mb-1">
                    Project ID
                  </label>
                  <input
                    id="fb-project-id"
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    placeholder="my-blinkdrop-app"
                    className="w-full bg-midnight-void border border-midnight-border rounded px-3 py-2 text-sm text-white font-mono focus:border-signal-cyan focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label htmlFor="fb-app-id" className="text-xs text-slate-400 font-mono block mb-1">
                    App ID
                  </label>
                  <input
                    id="fb-app-id"
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="1:123456789:web:abcdef"
                    className="w-full bg-midnight-void border border-midnight-border rounded px-3 py-2 text-sm text-white font-mono focus:border-signal-cyan focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {validationError && (
                <p className="text-xs text-rose-400 font-mono">{validationError}</p>
              )}
            </div>
          )}

          {/* Privacy & Signaling Integrity Guarantee */}
          <div className="p-3 bg-midnight-raised/50 border border-midnight-border rounded-lg flex items-start gap-2.5">
            <ShieldCheck size={18} weight="bold" className="text-emerald-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-200">Integrity Architecture:</strong> Signaling channels only exchange WebRTC session descriptions (SDP) and network routing coordinates (ICE). File binary data is never transmitted to or stored on signaling servers.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-white text-xs font-mono min-h-[44px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-signal-cyan hover:bg-signal-cyan-bright text-midnight-base text-sm font-semibold min-h-[44px] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
            >
              {savedFeedback ? (
                <>
                  <Check size={16} weight="bold" aria-hidden="true" />
                  <span>Applied</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

