import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Demo: React.FC = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/demo/session', { method: 'POST' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Demo is unavailable');
        await loginWithToken(data.token);
        navigate(data.nextRoute, { replace: true });
      })
      .catch((err: any) => setError(err.message || 'Demo is unavailable'));
  }, [loginWithToken, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      {error ? (
        <div className="font-mono text-xs text-destructive">{error}</div>
      ) : (
        <div className="font-mono text-xs text-muted-foreground">Preparing Company Brain demo...</div>
      )}
    </div>
  );
};

export default Demo;