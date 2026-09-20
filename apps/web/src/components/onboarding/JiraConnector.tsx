/**
 * JiraConnector
 *
 * Handles Jira OAuth + persistent connection management:
 *   1. Fetches the Atlassian OAuth URL from the backend
 *   2. Opens a popup window for Atlassian consent
 *   3. Receives the auth code via postMessage from the callback page
 *   4. Shows form to configure Jira instance (baseUrl, email, JQL)
 *   5. Calls connectJira() to exchange code and create persistent connection
 *   6. Lists existing connections and allows manual sync or disconnect
 *
 * Usage:
 *   <JiraConnector workspaceId={workspace.id} />
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../lib/api-client';

export interface JiraConnection {
  id: string;
  baseUrl: string;
  email: string;
  jql: string;
  lastSyncedAt: string | null;
  syncStatus: 'active' | 'sync_failed' | 'auth_failed';
  lastError: string | null;
}

interface Props {
  workspaceId: string;
  onConnected?: (connection: JiraConnection) => void;
  onError?: (error: string) => void;
}

type Step = 'idle' | 'auth' | 'config' | 'connecting' | 'connected' | 'error';

export const JiraConnector: React.FC<Props> = ({ workspaceId, onConnected, onError }) => {
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [oauthCode, setOauthCode] = useState<string | null>(null);
  const [connections, setConnections] = useState<JiraConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  // Form state for Jira configuration
  const [baseUrl, setBaseUrl] = useState('');
  const [email, setEmail] = useState('');
  const [jql, setJql] = useState('ORDER BY updated DESC');

  // Load existing connections on mount
  useEffect(() => {
    refreshConnections();
  }, [workspaceId]);

  // Listen for postMessage from the OAuth callback popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'jira_oauth_code') {
        const { code } = event.data;
        setOauthCode(code);
        setStep('config');
        popupRef.current?.close();
      } else if (event.data?.type === 'jira_oauth_error') {
        const { error } = event.data;
        setErrorMsg(error || 'OAuth error');
        setStep('error');
        popupRef.current?.close();
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const refreshConnections = useCallback(async () => {
    try {
      setLoading(true);
      const conns = await api.listJiraConnections(workspaceId);
      setConnections(conns);
    } catch (e: any) {
      console.error('Failed to load Jira connections:', e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const startAuth = useCallback(async () => {
    try {
      setStep('auth');
      setErrorMsg('');
      const { url } = await api.getJiraAuthUrl(workspaceId);
      const popup = window.open(url, 'jira_oauth', 'width=600,height=700,left=200,top=100');
      popupRef.current = popup;
    } catch (e: any) {
      setErrorMsg(e.message);
      setStep('error');
      onError?.(e.message);
    }
  }, [workspaceId, onError]);

  const handleConnect = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!oauthCode) return;

      if (!baseUrl.trim()) {
        setErrorMsg('Jira base URL is required');
        return;
      }
      if (!email.trim()) {
        setErrorMsg('Email is required');
        return;
      }

      try {
        setStep('connecting');
        setErrorMsg('');

        const result = await api.connectJira(workspaceId, {
          code: oauthCode,
          baseUrl: baseUrl.trim(),
          email: email.trim(),
          jql: jql.trim() || undefined,
        });

        // Create connection object to display
        const newConnection: JiraConnection = {
          id: result.connectionId,
          baseUrl: baseUrl.trim(),
          email: email.trim(),
          jql: jql.trim(),
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'active',
          lastError: null,
        };

        setStep('connected');
        setOauthCode(null);
        setBaseUrl('');
        setEmail('');
        setJql('ORDER BY updated DESC');
        onConnected?.(newConnection);

        // Refresh list
        setTimeout(() => {
          refreshConnections();
          setStep('idle');
        }, 2000);
      } catch (e: any) {
        setErrorMsg(e.message);
        setStep('error');
        onError?.(e.message);
      }
    },
    [oauthCode, baseUrl, email, jql, workspaceId, onConnected, onError]
  );

  const handleSync = useCallback(
    async (connectionId: string) => {
      try {
        setSyncing(connectionId);
        await api.syncJiraConnections(workspaceId, { connectionId });
        // Refresh list to show updated lastSyncedAt
        await refreshConnections();
      } catch (e: any) {
        setErrorMsg(`Sync failed: ${e.message}`);
      } finally {
        setSyncing(null);
      }
    },
    [workspaceId]
  );

  const handleDisconnect = useCallback(
    async (connectionId: string) => {
      if (!window.confirm('Disconnect this Jira instance?')) return;
      try {
        await api.disconnectJiraConnection(workspaceId, connectionId);
        await refreshConnections();
      } catch (e: any) {
        setErrorMsg(`Disconnect failed: ${e.message}`);
      }
    },
    [workspaceId]
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (step === 'connected') {
    return (
      <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs">
        <span>✓</span>
        <span>Jira connected</span>
        <button
          onClick={() => { setStep('idle'); setOauthCode(null); }}
          className="ml-2 text-white/40 hover:text-white/70 transition-colors cursor-pointer underline"
        >
          connect another
        </button>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="space-y-2">
        <div className="text-red-400 font-mono text-xs">Error: {errorMsg}</div>
        <button
          onClick={() => {
            setStep('idle');
            setErrorMsg('');
            setOauthCode(null);
          }}
          className="font-mono text-[10px] text-white/40 hover:text-white/70 transition-colors cursor-pointer underline"
        >
          try again
        </button>
      </div>
    );
  }

  if (step === 'config' && oauthCode) {
    return (
      <form onSubmit={handleConnect} className="space-y-3 bg-white/5 border border-white/10 p-4 rounded-lg">
        <div className="font-mono text-xs text-white/60">Configure Jira instance</div>

        <div>
          <label className="block font-mono text-[10px] text-white/40 mb-1">Jira Base URL</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://company.atlassian.net"
            className="w-full bg-transparent border border-white/15 text-white font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-white/40"
            required
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] text-white/40 mb-1">Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            type="email"
            className="w-full bg-transparent border border-white/15 text-white font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-white/40"
            required
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] text-white/40 mb-1">JQL Query (optional)</label>
          <input
            value={jql}
            onChange={(e) => setJql(e.target.value)}
            placeholder="ORDER BY updated DESC"
            className="w-full bg-transparent border border-white/15 text-white font-mono text-xs px-2 py-1 rounded focus:outline-none focus:border-white/40"
          />
          <div className="font-mono text-[9px] text-white/30 mt-1">
            Leave blank for: ORDER BY updated DESC
          </div>
        </div>

        <button
          type="submit"
          disabled={step === 'connecting' || !baseUrl.trim() || !email.trim()}
          className="w-full font-mono text-[10px] px-3 py-1.5 bg-white/10 border border-white/20 hover:border-white/40 text-white rounded transition-colors cursor-pointer disabled:opacity-40"
        >
          {step === 'connecting' ? 'CONNECTING…' : 'CONNECT JIRA →'}
        </button>
      </form>
    );
  }

  // ── List existing connections ────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <button
        onClick={startAuth}
        disabled={step === 'auth' || loading}
        className="flex items-center gap-2 font-mono text-xs px-4 py-2 bg-white/10 border border-white/20 hover:border-white/40 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        {step === 'auth' ? 'Waiting for Atlassian…' : 'Connect Jira'}
      </button>

      {/* Existing connections */}
      {connections.length > 0 && (
        <div className="space-y-2">
          <div className="font-mono text-[10px] text-white/40 uppercase">Connected instances</div>
          {connections.map((conn) => (
            <div key={conn.id} className="border border-white/10 bg-white/5 p-3 rounded space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs text-white">{conn.baseUrl}</div>
                  <div className="font-mono text-[10px] text-white/50">{conn.email}</div>
                </div>
                <div
                  className={`font-mono text-[9px] px-2 py-0.5 rounded ${
                    conn.syncStatus === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {conn.syncStatus}
                </div>
              </div>

              {conn.lastError && (
                <div className="font-mono text-[9px] text-red-300 bg-red-500/10 p-1 rounded">
                  {conn.lastError}
                </div>
              )}

              <div className="font-mono text-[9px] text-white/40">
                {conn.lastSyncedAt
                  ? `Last synced: ${new Date(conn.lastSyncedAt).toLocaleString()}`
                  : 'Never synced'}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleSync(conn.id)}
                  disabled={syncing === conn.id}
                  className="flex-1 font-mono text-[9px] px-2 py-1 bg-white/5 border border-white/15 hover:border-white/30 text-white rounded transition-colors cursor-pointer disabled:opacity-40"
                >
                  {syncing === conn.id ? 'SYNCING…' : 'SYNC NOW'}
                </button>
                <button
                  onClick={() => handleDisconnect(conn.id)}
                  className="flex-1 font-mono text-[9px] px-2 py-1 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 text-red-300 rounded transition-colors cursor-pointer"
                >
                  DISCONNECT
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="font-mono text-[10px] text-white/40">Loading connections…</div>
      )}

      {!loading && connections.length === 0 && (
        <div className="font-mono text-[10px] text-white/30">No Jira instances connected yet</div>
      )}

      {errorMsg && step === 'idle' && (
        <div className="text-red-400 font-mono text-[10px] bg-red-500/10 p-2 rounded">
          {errorMsg}
        </div>
      )}
    </div>
  );
};

export default JiraConnector;
