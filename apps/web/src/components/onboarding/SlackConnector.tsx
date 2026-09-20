/**
 * SlackConnector
 *
 * Handles Slack OAuth + persistent connection management:
 *   1. Fetches the Slack OAuth URL from the backend
 *   2. Opens a popup window for Slack consent
 *   3. Receives the auth code via postMessage from the callback page
 *   4. Shows form to select channels and archive format
 *   5. Calls connectSlack() to exchange code and create persistent connection
 *   6. Lists existing connections and allows manual sync or disconnect
 *
 * Usage:
 *   <SlackConnector workspaceId={workspace.id} />
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../lib/api-client';

export interface SlackConnectionInfo {
  id: string;
  slackWorkspaceId: string;
  slackTeamName: string;
  channels: string[];
  archiveFormat: 'raw' | 'threaded';
  lastSyncedAt: string | null;
  syncStatus: 'active' | 'sync_failed' | 'auth_failed';
  lastError: string | null;
}

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_general: boolean;
  num_members?: number;
}

interface Props {
  workspaceId: string;
  onConnected?: (connection: SlackConnectionInfo) => void;
  onError?: (error: string) => void;
}

type Step = 'idle' | 'auth' | 'config' | 'connecting' | 'connected' | 'error';

export const SlackConnector: React.FC<Props> = ({ workspaceId, onConnected, onError }) => {
  const [step, setStep] = useState<Step>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [oauthCode, setOauthCode] = useState<string | null>(null);
  const [connections, setConnections] = useState<SlackConnectionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [availableChannels, setAvailableChannels] = useState<SlackChannel[]>([]);
  const [fetchingChannels, setFetchingChannels] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const workspaceInfoRef = useRef<{ slackWorkspaceId: string; slackTeamName: string } | null>(null);

  // Form state for Slack configuration
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());
  const [archiveFormat, setArchiveFormat] = useState<'raw' | 'threaded'>('raw');

  // Load existing connections on mount
  useEffect(() => {
    refreshConnections();
  }, [workspaceId]);

  // Listen for postMessage from the OAuth callback popup
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'slack_oauth_code') {
        const { code } = event.data;
        setOauthCode(code);
        setStep('config');
        void (async () => {
          try {
            setFetchingChannels(true);
            const prepared = await api.prepareSlackOAuth(workspaceId, code);
            accessTokenRef.current = prepared.accessToken;
            workspaceInfoRef.current = {
              slackWorkspaceId: prepared.slackWorkspaceId,
              slackTeamName: prepared.slackTeamName,
            };
            setAvailableChannels(prepared.channels);
          } catch (e: any) {
            setErrorMsg(`Failed to load Slack channels: ${e.message}`);
            setStep('error');
          } finally {
            setFetchingChannels(false);
          }
        })();
        popupRef.current?.close();
      } else if (event.data?.type === 'slack_oauth_error') {
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
      const conns = await api.listSlackConnections(workspaceId);
      setConnections(conns);
    } catch (e: any) {
      console.error('Failed to load Slack connections:', e.message);
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const startAuth = useCallback(async () => {
    try {
      setStep('auth');
      setErrorMsg('');
      setAvailableChannels([]);
      setSelectedChannels(new Set());
      const { url } = await api.getSlackAuthUrl(workspaceId);
      const popup = window.open(url, 'slack_oauth', 'width=600,height=700,left=200,top=100');
      popupRef.current = popup;
    } catch (e: any) {
      setErrorMsg(e.message);
      setStep('error');
      onError?.(e.message);
    }
  }, [workspaceId, onError]);

  const toggleChannel = useCallback((channelId: string) => {
    setSelectedChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channelId)) {
        next.delete(channelId);
      } else {
        next.add(channelId);
      }
      return next;
    });
  }, []);

  const handleConnect = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!oauthCode || !accessTokenRef.current || !workspaceInfoRef.current) return;

      if (selectedChannels.size === 0) {
        setErrorMsg('Please select at least one channel');
        return;
      }

      try {
        setStep('connecting');
        setErrorMsg('');

        const result = await api.connectSlack(workspaceId, {
          accessToken: accessTokenRef.current,
          slackWorkspaceId: workspaceInfoRef.current.slackWorkspaceId,
          slackTeamName: workspaceInfoRef.current.slackTeamName,
          channels: Array.from(selectedChannels),
          archiveFormat,
        });

        // Create connection object to display
        const newConnection: SlackConnectionInfo = {
          id: result.connectionId,
          slackWorkspaceId: workspaceInfoRef.current.slackWorkspaceId,
          slackTeamName: workspaceInfoRef.current.slackTeamName,
          channels: Array.from(selectedChannels),
          archiveFormat,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'active',
          lastError: null,
        };

        setStep('connected');
        setOauthCode(null);
        setSelectedChannels(new Set());
        setArchiveFormat('raw');
        setAvailableChannels([]);
        accessTokenRef.current = null;
        workspaceInfoRef.current = null;
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
    [oauthCode, selectedChannels, archiveFormat, workspaceId, onConnected, onError]
  );

  const handleSync = useCallback(
    async (connectionId: string) => {
      try {
        setSyncing(connectionId);
        await api.syncSlackConnections(workspaceId, { connectionId });
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
      if (!window.confirm('Disconnect this Slack workspace?')) return;
      try {
        await api.disconnectSlackConnection(workspaceId, connectionId);
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
        <span>Slack connected</span>
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
        <div className="font-mono text-xs text-white/60">Select channels to archive</div>

        {/* Channel selection */}
        <div>
          <label className="block font-mono text-[10px] text-white/40 mb-2">Channels</label>
          <div className="space-y-1 max-h-48 overflow-y-auto border border-white/10 rounded p-2 bg-white/5">
            {fetchingChannels ? (
              <div className="font-mono text-[10px] text-white/40">Loading channels…</div>
            ) : availableChannels.length > 0 ? (
              availableChannels.map((ch) => (
                <label key={ch.id} className="flex items-center gap-2 cursor-pointer font-mono text-[10px] text-white/70 hover:text-white">
                  <input
                    type="checkbox"
                    checked={selectedChannels.has(ch.id)}
                    onChange={() => toggleChannel(ch.id)}
                    className="w-3 h-3"
                  />
                  <span>
                    #{ch.name}
                    {ch.is_private && <span className="text-white/40"> (private)</span>}
                  </span>
                </label>
              ))
            ) : (
              <div className="font-mono text-[10px] text-white/40">No channels available</div>
            )}
          </div>
          {selectedChannels.size > 0 && (
            <div className="font-mono text-[9px] text-emerald-400 mt-1">
              {selectedChannels.size} channel{selectedChannels.size !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* Archive format selection */}
        <div>
          <label className="block font-mono text-[10px] text-white/40 mb-2">Archive Format</label>
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer font-mono text-[10px] text-white/70 hover:text-white">
              <input
                type="radio"
                name="archiveFormat"
                value="raw"
                checked={archiveFormat === 'raw'}
                onChange={() => setArchiveFormat('raw')}
                className="w-3 h-3"
              />
              <span>Raw (all messages in order)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-mono text-[10px] text-white/70 hover:text-white">
              <input
                type="radio"
                name="archiveFormat"
                value="threaded"
                checked={archiveFormat === 'threaded'}
                onChange={() => setArchiveFormat('threaded')}
                className="w-3 h-3"
              />
              <span>Threaded (organize by conversation)</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={step === 'connecting' || selectedChannels.size === 0 || fetchingChannels}
          className="w-full font-mono text-[10px] px-3 py-1.5 bg-white/10 border border-white/20 hover:border-white/40 text-white rounded transition-colors cursor-pointer disabled:opacity-40"
        >
          {step === 'connecting' ? 'CONNECTING…' : 'CONNECT SLACK →'}
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
        {step === 'auth' ? 'Waiting for Slack…' : 'Connect Slack'}
      </button>

      {/* Existing connections */}
      {connections.length > 0 && (
        <div className="space-y-2">
          <div className="font-mono text-[10px] text-white/40 uppercase">Connected workspaces</div>
          {connections.map((conn) => (
            <div key={conn.id} className="border border-white/10 bg-white/5 p-3 rounded space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs text-white">{conn.slackTeamName}</div>
                  <div className="font-mono text-[10px] text-white/50">{conn.channels.length} channel{conn.channels.length !== 1 ? 's' : ''} · {conn.archiveFormat}</div>
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
        <div className="font-mono text-[10px] text-white/30">No Slack workspaces connected yet</div>
      )}

      {errorMsg && step === 'idle' && (
        <div className="text-red-400 font-mono text-[10px] bg-red-500/10 p-2 rounded">
          {errorMsg}
        </div>
      )}
    </div>
  );
};

export default SlackConnector;
