import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const InviteRedirect: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!token) {
      navigate('/auth', { replace: true });
      return;
    }

    // Persist token across sessions / OAuth redirects
    sessionStorage.setItem('pending_invite_token', token);

    if (user) {
      navigate(`/enter?invite=${encodeURIComponent(token)}`, { replace: true });
    } else {
      navigate(`/auth?invite=${encodeURIComponent(token)}`, { replace: true });
    }
  }, [token, user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
        <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Processing invitation link...
      </div>
    </div>
  );
};

export default InviteRedirect;
