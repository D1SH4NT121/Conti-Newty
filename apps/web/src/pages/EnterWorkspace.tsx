import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, InviteInfo } from '../lib/api-client';
import { useAuth } from '../context/AuthContext';

export const EnterWorkspace: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // URL Params
  const rawInviteParam = searchParams.get('invite') || sessionStorage.getItem('pending_invite_token') || '';
  const rawCodeParam = searchParams.get('code') || '';
  const isManualIntent = searchParams.get('manual') === 'true' || Boolean(rawCodeParam);

  // Invite state
  const [inviteToken, setInviteToken] = useState(rawInviteParam);
  const [inviteDetails, setInviteDetails] = useState<InviteInfo | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(Boolean(rawInviteParam));
  const [actionLoading, setActionLoading] = useState(false);

  // Join code state
  const [joinCodeInput, setJoinCodeInput] = useState(rawCodeParam);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  // 1. Safety net for Case 9: If authenticated with no invite and no manual join intent, auto-route
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (rawInviteParam) {
        navigate(`/auth?invite=${encodeURIComponent(rawInviteParam)}`, { replace: true });
      } else if (rawCodeParam) {
        navigate(`/auth?code=${encodeURIComponent(rawCodeParam)}`, { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
      return;
    }

    // Authenticated user with no invite and no manual join intent
    if (!rawInviteParam && !isManualIntent) {
      api.getMe().then(({ nextRoute }) => {
        if (nextRoute && nextRoute !== '/enter') {
          navigate(nextRoute, { replace: true });
        } else {
          navigate('/onboarding', { replace: true });
        }
      }).catch(() => {
        navigate('/onboarding', { replace: true });
      });
    }
  }, [user, authLoading, rawInviteParam, isManualIntent, rawCodeParam, navigate]);

  // 2. Case 5: Validate pending invite
  useEffect(() => {
    if (!inviteToken) {
      setInviteLoading(false);
      return;
    }

    setInviteLoading(true);
    setInviteError('');

    api.validateInvite(inviteToken)
      .then((res) => {
        setInviteDetails(res.invite);
      })
      .catch((err) => {
        setInviteError(err.message || 'This invitation link is no longer valid or has expired.');
      })
      .finally(() => {
        setInviteLoading(false);
      });
  }, [inviteToken]);

  // Handle Accept Invite (Case 5)
  async function handleAcceptInvite() {
    if (!inviteToken || actionLoading) return;
    setActionLoading(true);
    setInviteError('');

    try {
      const res = await api.acceptInvite(inviteToken);
      sessionStorage.removeItem('pending_invite_token');
      navigate(res.nextRoute || '/onboarding', { replace: true });
    } catch (err: any) {
      setInviteError(err.message || 'Failed to accept invitation');
      setActionLoading(false);
    }
  }

  // Handle Decline Invite (Case 5)
  async function handleDeclineInvite() {
    if (!inviteToken || actionLoading) return;
    setActionLoading(true);
    setInviteError('');

    try {
      const res = await api.declineInvite(inviteToken);
      sessionStorage.removeItem('pending_invite_token');
      navigate(res.nextRoute || '/onboarding', { replace: true });
    } catch (err: any) {
      setInviteError(err.message || 'Failed to decline invitation');
      setActionLoading(false);
    }
  }

  // Handle Manual Join Code Submit (Case 8)
  async function handleJoinCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      setJoinError('Please enter a team join code (e.g. CN-XXXXXX)');
      return;
    }

    setJoinLoading(true);
    setJoinError('');

    try {
      const res = await api.redeemJoinCode(code);
      navigate(res.nextRoute || '/onboarding', { replace: true });
    } catch (err: any) {
      setJoinError(err.message || 'Invalid or expired join code. Please verify the code.');
      setJoinLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <button
          onClick={() => navigate('/')}
          className="font-mono text-xs tracking-widest text-foreground hover:text-muted-foreground transition-colors cursor-pointer"
        >
          CONTI-NEWTY
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Loading Indicator */}
          {inviteLoading && (
            <div className="p-8 border border-border bg-card rounded-lg text-center font-mono text-xs text-muted-foreground animate-fade-in flex flex-col items-center gap-3">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Validating workspace invitation...
            </div>
          )}

          {/* CASE 5: Render ONLY the invite-acceptance card */}
          {inviteDetails && !inviteLoading && (
            <div className="p-7 border border-border bg-card rounded-xl shadow-2xl animate-fade-in space-y-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs text-emerald-400 font-semibold tracking-wider uppercase">
                  Pending Workspace Invitation
                </span>
              </div>

              <div>
                <h2 className="font-serif text-2xl font-light text-foreground mb-2">
                  You&rsquo;ve been invited to join
                </h2>
                <div className="text-xl font-bold text-foreground mb-1">
                  {inviteDetails.organizationName}
                </div>
                {inviteDetails.workspaceName && (
                  <div className="text-sm text-muted-foreground">
                    Workspace: <strong className="text-foreground font-mono">{inviteDetails.workspaceName}</strong>
                  </div>
                )}
                <div className="mt-2 text-xs text-muted-foreground">
                  Role: <span className="font-mono text-xs uppercase bg-secondary px-2 py-0.5 rounded text-foreground font-semibold">{inviteDetails.role}</span>
                </div>
              </div>

              {inviteError && (
                <div className="p-3 bg-red-950/40 border border-red-500/30 text-xs font-mono text-red-400 rounded">
                  {inviteError}
                </div>
              )}

              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handleAcceptInvite}
                  disabled={actionLoading}
                  className="w-full py-3 px-4 bg-foreground text-background font-mono text-xs font-bold tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-md rounded-md"
                >
                  {actionLoading ? 'JOINING WORKSPACE...' : 'ACCEPT INVITATION & ENTER →'}
                </button>

                <button
                  onClick={handleDeclineInvite}
                  disabled={actionLoading}
                  className="w-full py-2.5 px-4 bg-transparent border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/30 font-mono text-xs transition-colors cursor-pointer rounded-md"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Invalid / Expired Invite Error State */}
          {inviteError && !inviteDetails && !inviteLoading && (
            <div className="p-6 border border-destructive/30 bg-destructive/5 rounded-xl text-center space-y-4 animate-fade-in">
              <div className="font-mono text-xs text-destructive font-semibold uppercase tracking-wider">
                Invitation Error
              </div>
              <p className="text-sm text-foreground">
                {inviteError}
              </p>
              <button
                onClick={() => navigate('/onboarding')}
                className="py-2.5 px-5 bg-foreground text-background font-mono text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer rounded-md"
              >
                Go to Workspace Setup →
              </button>
            </div>
          )}

          {/* CASE 8: Manual Join Code Card */}
          {isManualIntent && !inviteToken && !inviteLoading && (
            <div className="p-7 border border-border bg-card rounded-xl shadow-2xl animate-fade-in space-y-6">
              <div>
                <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Workspace Access
                </div>
                <h2 className="font-serif text-2xl font-light text-foreground">
                  Enter Join Code
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your team&rsquo;s 6-character code (e.g. CN-XXXXXX) to join.
                </p>
              </div>

              <form onSubmit={handleJoinCodeSubmit} className="space-y-4">
                <div>
                  <label className="block font-mono text-xs text-muted-foreground mb-1.5 uppercase">
                    Team Join Code
                  </label>
                  <input
                    type="text"
                    placeholder="CN-XXXXXX"
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-background border border-border font-mono text-sm text-foreground uppercase placeholder:text-muted-foreground focus:outline-none focus:border-foreground rounded"
                    autoFocus
                  />
                </div>

                {joinError && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 font-mono text-xs text-red-400 rounded">
                    {joinError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={joinLoading || !joinCodeInput.trim()}
                  className="w-full py-3 px-4 bg-foreground text-background font-mono text-xs font-bold tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer rounded-md"
                >
                  {joinLoading ? 'VERIFYING CODE...' : 'JOIN WORKSPACE →'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnterWorkspace;
