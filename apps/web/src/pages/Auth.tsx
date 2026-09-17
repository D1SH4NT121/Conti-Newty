import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api-client';

export const Auth: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailMode, setEmailMode] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const inviteToken = searchParams.get('invite');
  const joinCode = searchParams.get('code');

  async function handleOAuth(provider: 'google' | 'github') {
    const qs = new URLSearchParams();
    if (inviteToken) qs.set('invite', inviteToken);
    if (joinCode) qs.set('code', joinCode);
    const qsStr = qs.toString() ? `?${qs.toString()}` : '';
    window.location.href = `/api/auth/${provider}${qsStr}`;
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Email is required.'); return; }
    if (forgot) {
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setForgotSent(true);
      }, 500);
      return;
    }
    if (!password) { setError('Password is required.'); return; }
    setLoading(true);
    setError('');

    try {
      let authRes;
      if (mode === 'login') {
        authRes = await login(email, password);
      } else {
        authRes = await register(email, password, name || undefined);
      }

      // If an invite token was provided in the URL, accept it immediately
      if (inviteToken) {
        try {
          const inviteRes = await api.acceptInvite(inviteToken);
          if (inviteRes.nextRoute) {
            navigate(inviteRes.nextRoute);
            return;
          }
        } catch (inviteErr: any) {
          console.error('Auto-accept invite error:', inviteErr);
        }
      }

      // If a join code was provided in the URL, redeem it immediately
      if (joinCode) {
        try {
          const redeemRes = await api.redeemJoinCode(joinCode);
          if (redeemRes.nextRoute) {
            navigate(redeemRes.nextRoute);
            return;
          }
        } catch (codeErr: any) {
          console.error('Auto-redeem join code error:', codeErr);
        }
      }

      // Route server-side dynamically computed destination
      navigate(authRes.nextRoute || '/onboarding');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  if (forgotSent) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="font-mono text-xs text-accent mb-6">RESET LINK SENT</div>
          <p className="text-sm text-muted-foreground mb-8">
            Check your email at <span className="text-foreground font-semibold">{email}</span> for a link to reset your password.
          </p>
          <button
            onClick={() => { setForgot(false); setForgotSent(false); }}
            className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex items-center justify-between px-8 py-5 border-b border-border">
        <button
          onClick={() => navigate('/')}
          className="font-mono text-xs tracking-widest text-foreground hover:opacity-70 transition-opacity"
        >
          CONTI-NEWTY
        </button>
        <button
          onClick={() => navigate('/')}
          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <h1 className="font-serif text-3xl font-light text-foreground mb-2">
              {forgot ? 'Reset password' : mode === 'login' ? <><em>Welcome</em> back.</> : <>Create your<br /><em>account.</em></>}
            </h1>
            {!forgot && (
              <p className="text-sm text-muted-foreground">
                {mode === 'login' ? 'Sign in to access your workspace.' : 'Start your workspace. No credit card required.'}
              </p>
            )}
          </div>

          {loading && (
            <div className="mb-6 p-3 bg-card border border-border animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 border border-foreground border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-xs text-muted-foreground">
                  {forgot ? 'Sending reset link...' : mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-destructive/5 border border-destructive/20 animate-fade-in">
              <span className="font-mono text-xs text-destructive">{error}</span>
            </div>
          )}

          {!emailMode && !forgot && (
            <div className="space-y-3 mb-6">
              <button
                onClick={() => handleOAuth('google')}
                disabled={loading}
                className="w-full flex items-center gap-3 border border-border bg-background hover:border-foreground hover:bg-card transition-all px-4 py-3 disabled:opacity-50"
              >
                <span className="font-mono text-sm font-semibold text-muted-foreground w-6 text-center">G</span>
                <span className="font-mono text-xs text-foreground">CONTINUE WITH GOOGLE</span>
              </button>
              <button
                onClick={() => handleOAuth('github')}
                disabled={loading}
                className="w-full flex items-center gap-3 border border-border bg-background hover:border-foreground hover:bg-card transition-all px-4 py-3 disabled:opacity-50"
              >
                <span className="font-mono text-sm font-semibold text-muted-foreground w-6 text-center">⌥</span>
                <span className="font-mono text-xs text-foreground">CONTINUE WITH GITHUB</span>
              </button>
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="font-mono text-xs text-muted-foreground">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <button
                onClick={() => setEmailMode(true)}
                className="w-full border border-border bg-background hover:border-foreground hover:bg-card transition-all px-4 py-3 font-mono text-xs text-foreground"
              >
                CONTINUE WITH EMAIL
              </button>
            </div>
          )}

          {(emailMode || forgot) && (
            <form onSubmit={handleEmail} className="space-y-4 mb-6">
              {mode === 'signup' && !forgot && (
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-1.5">
                    NAME <span className="font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => { setName(e.target.value); setError(''); }}
                    placeholder="Your name"
                    className="w-full px-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
                  />
                </div>
              )}
              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-1.5">EMAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(''); }}
                  placeholder="you@company.com"
                  className="w-full px-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
                  autoFocus
                />
              </div>
              {!forgot && (
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-1.5">PASSWORD</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 bg-background border border-border text-foreground text-sm focus:outline-none focus:border-foreground transition-colors placeholder-muted-foreground"
                  />
                  {mode === 'signup' && (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">At least 6 characters</p>
                  )}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-foreground text-background font-mono text-xs tracking-wider hover:bg-primary hover:text-primary-foreground transition-colors disabled:opacity-50"
              >
                {forgot ? 'SEND RESET LINK' : mode === 'login' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
              </button>
              {mode === 'login' && !forgot && (
                <button
                  type="button"
                  onClick={() => setForgot(true)}
                  className="w-full font-mono text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Forgot password?
                </button>
              )}
              {forgot && (
                <button
                  type="button"
                  onClick={() => setForgot(false)}
                  className="w-full font-mono text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  ← Back
                </button>
              )}
              {emailMode && !forgot && (
                <button
                  type="button"
                  onClick={() => setEmailMode(false)}
                  className="w-full font-mono text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  ← Other options
                </button>
              )}
            </form>
          )}

          {!forgot && (
            <div className="text-center">
              <span className="text-xs text-muted-foreground">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              </span>
              <button
                onClick={() => {
                  setMode(m => m === 'login' ? 'signup' : 'login');
                  setError('');
                }}
                className="text-xs text-foreground font-semibold hover:text-primary transition-colors"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
