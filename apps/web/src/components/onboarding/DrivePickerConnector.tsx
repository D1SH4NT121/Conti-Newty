/**
 * DrivePickerConnector
 *
 * Handles the full Google Drive Picker connection flow:
 *   1. Fetches the drive.file OAuth URL from the backend
 *   2. Opens a popup window for Google consent
 *   3. Receives the auth code via postMessage from the callback page
 *   4. Calls connectDriveFiles() with the auth code + Picker selection
 *
 * The Google Picker API requires the gapi/picker JS SDK loaded from CDN.
 * We inject the script lazily on mount.
 *
 * Usage:
 *   <DrivePickerConnector
 *     workspaceId={workspace.id}
 *     onConnected={(result) => console.log(result)}
 *   />
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../lib/api-client';

declare global {
  interface Window {
    gapi?: any;
    google?: any;
    onDrivePickerLoaded?: () => void;
  }
}

export interface DriveConnectResult {
  connected: Array<{ connectionId: string; brainPath: string; externalName: string }>;
  errors: Array<{ fileId: string; name: string; error: string }>;
}

interface Props {
  workspaceId: string;
  onConnected?: (result: DriveConnectResult) => void;
  onError?: (error: string) => void;
}

type Step = 'idle' | 'auth' | 'picker' | 'importing' | 'done' | 'error';

const PICKER_API_URL = 'https://apis.google.com/js/api.js';
const GAPI_PICKER_SCOPE = 'https://www.googleapis.com/auth/drive.file';

function loadGapiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById('gapi-script')) { resolve(); return; }
    const script = document.createElement('script');
    script.id = 'gapi-script';
    script.src = PICKER_API_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Picker SDK'));
    document.head.appendChild(script);
  });
}

export const DrivePickerConnector: React.FC<Props> = ({ workspaceId, onConnected, onError }) => {
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [pickerReady, setPickerReady] = useState(false);
  const [oauthCode, setOauthCode] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Load the gapi Picker SDK
  useEffect(() => {
    loadGapiScript()
      .then(() => {
        window.gapi?.load('picker', () => setPickerReady(true));
      })
      .catch((e) => {
        console.warn('Google Picker SDK load failed:', e.message);
        // Still allow the flow — picker will be skipped if SDK absent
        setPickerReady(false);
      });
  }, []);

  // Listen for postMessage from the OAuth callback popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'drive_oauth_code') {
        const { code, accessToken: at } = event.data;
        setOauthCode(code ?? null);
        if (at) setAccessToken(at);
        popupRef.current?.close();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // When we have an OAuth code, open the Picker
  useEffect(() => {
    if (!oauthCode) return;
    if (!pickerReady || !accessToken) {
      // Picker SDK not available — fall back to a minimal file ID input
      openManualFallback(oauthCode);
    } else {
      openPicker(oauthCode, accessToken);
    }
  }, [oauthCode, accessToken, pickerReady]);

  const startAuth = useCallback(async () => {
    try {
      setStep('auth');
      setErrorMsg('');
      const { url } = await api.getDriveAuthUrl(workspaceId);
      const popup = window.open(url, 'drive_oauth', 'width=540,height=640,left=200,top=100');
      popupRef.current = popup;
    } catch (e: any) {
      setErrorMsg(e.message);
      setStep('error');
      onError?.(e.message);
    }
  }, [workspaceId, onError]);

  const openPicker = useCallback(
    (code: string, token: string) => {
      if (!window.google?.picker) {
        openManualFallback(code);
        return;
      }

      setStep('picker');
      const docsView = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);

      const picker = new window.google.picker.PickerBuilder()
        .addView(docsView)
        .setOAuthToken(token)
        .setCallback(async (data: any) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const files = data.docs.map((d: any) => ({
              id: d.id,
              name: d.name,
              mimeType: d.mimeType,
            }));
            await importFiles(code, files);
          } else if (data.action === window.google.picker.Action.CANCEL) {
            setStep('idle');
            setOauthCode(null);
            setAccessToken(null);
          }
        })
        .setMaxItems(20)
        .build();

      picker.setVisible(true);
    },
    []
  );

  /** Fallback when Picker SDK is not available: user pastes file IDs manually */
  const openManualFallback = useCallback((_code: string) => {
    setStep('picker');
    // The UI will render the manual input panel in this state
  }, []);

  const importFiles = useCallback(
    async (code: string, files: Array<{ id: string; name: string; mimeType: string }>) => {
      setStep('importing');
      try {
        const result = await api.connectDriveFiles(workspaceId, { code, pickerFiles: files });
        setStep('done');
        setOauthCode(null);
        setAccessToken(null);
        onConnected?.(result);
      } catch (e: any) {
        setErrorMsg(e.message);
        setStep('error');
        onError?.(e.message);
      }
    },
    [workspaceId, onConnected, onError]
  );

  // ── Manual fallback state (when Picker SDK unavailable) ─────────────────
  const [manualFileId, setManualFileId] = useState('');
  const [manualFileName, setManualFileName] = useState('');

  const handleManualImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthCode || !manualFileId.trim()) return;
    const files = [{ id: manualFileId.trim(), name: manualFileName.trim() || manualFileId.trim(), mimeType: 'application/octet-stream' }];
    await importFiles(oauthCode, files);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs">
        <span>✓</span>
        <span>Drive files connected to Company Brain</span>
        <button
          onClick={() => { setStep('idle'); setOauthCode(null); setAccessToken(null); }}
          className="ml-2 text-white/40 hover:text-white/70 transition-colors cursor-pointer underline"
        >
          connect more
        </button>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="space-y-2">
        <div className="text-red-400 font-mono text-xs">Error: {errorMsg}</div>
        <button
          onClick={() => { setStep('idle'); setErrorMsg(''); setOauthCode(null); setAccessToken(null); }}
          className="font-mono text-[10px] text-white/40 hover:text-white/70 transition-colors cursor-pointer underline"
        >
          try again
        </button>
      </div>
    );
  }

  if (step === 'picker' && !accessToken) {
    // Manual fallback
    return (
      <form onSubmit={handleManualImport} className="space-y-2">
        <div className="font-mono text-[10px] text-white/40">
          Google Picker SDK unavailable — paste a Drive file ID:
        </div>
        <input
          value={manualFileId}
          onChange={(e) => setManualFileId(e.target.value)}
          placeholder="Drive file ID"
          className="w-full bg-transparent border border-white/15 text-white font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-white/40"
        />
        <input
          value={manualFileName}
          onChange={(e) => setManualFileName(e.target.value)}
          placeholder="Display name (optional)"
          className="w-full bg-transparent border border-white/15 text-white font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-white/40"
        />
        <button
          type="submit"
          disabled={!manualFileId.trim()}
          className="font-mono text-[10px] px-3 py-1.5 bg-white/10 border border-white/20 hover:border-white/40 text-white rounded transition-colors cursor-pointer disabled:opacity-40"
        >
          IMPORT →
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={startAuth}
      disabled={step === 'auth' || step === 'importing' || step === 'picker'}
      className="flex items-center gap-2 font-mono text-xs px-4 py-2 bg-white/10 border border-white/20 hover:border-white/40 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path d="M6 2H14L20 8V22H6V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M14 2V8H20" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
      {step === 'auth' && 'Waiting for Google…'}
      {step === 'picker' && 'Select files in Picker…'}
      {step === 'importing' && 'Importing…'}
      {step === 'idle' && 'Connect Google Drive files'}
    </button>
  );
};

export default DrivePickerConnector;
