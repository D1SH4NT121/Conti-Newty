import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api-client';

export const AuthCallback: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = params.get('token');
    const err = params.get('error');
    const inviteToken = params.get('invite');
    const joinCode = params.get('code');
    const githubToken = params.get('github_token');
    const githubConnect = params.get('github_connect') === '1';
    const returnTo = params.get('return_to');

    if (githubToken) {
      localStorage.setItem('anti_github_token', githubToken);
    }

    if (err) {
      setError(err);
      return;
    }
    if (!token) {
      setError('Missing token from OAuth provider.');
      return;
    }
    loginWithToken(token)
      .then(async (res) => {
        if (inviteToken) {
          try {
            const inviteRes = await api.acceptInvite(inviteToken);
            if (inviteRes.nextRoute) {
              navigate(inviteRes.nextRoute);
              return;
            }
          } catch (e: any) {
            console.error('OAuth invite accept error:', e);
          }
        }
        if (joinCode) {
          try {
            const redeemRes = await api.redeemJoinCode(joinCode);
            if (redeemRes.nextRoute) {
              navigate(redeemRes.nextRoute);
              return;
            }
          } catch (e: any) {
            console.error('OAuth join code redeem error:', e);
          }
        }
        // The GitHub repository picker uses /onboarding as a temporary return
        // target so it can receive the token. Do not send an existing user
        // back through workspace setup.
        if (returnTo && (githubConnect || !(returnTo === '/onboarding' && res.nextRoute !== '/onboarding'))) {
          navigate(returnTo);
          return;
        }
        navigate(res.nextRoute || '/onboarding');
      })
      .catch((e: any) => setError(e.message || 'Sign-in failed'));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
        <div className="font-mono text-xs text-destructive mb-4">{error}</div>
        <button onClick={() => navigate('/auth')} className="font-mono text-xs text-muted-foreground hover:text-foreground">
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="w-4 h-4 border border-foreground border-t-transparent rounded-full animate-spin mb-4" />
      <div className="font-mono text-xs text-muted-foreground">Signing you in...</div>
    </div>
  );
};
