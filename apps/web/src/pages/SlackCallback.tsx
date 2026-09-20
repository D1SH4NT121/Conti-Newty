/**
 * SlackCallback
 *
 * OAuth redirect target for Slack OAuth flow.
 * This page is opened in a popup by SlackConnector.tsx.
 * On load, it extracts the auth code from the URL and posts it back
 * to the parent window via postMessage, then closes the popup.
 *
 * URL pattern: /w/slack/callback?code=...&state=...&error=...
 */

import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const SlackCallback: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (code) {
      // Send code back to parent window
      window.opener?.postMessage(
        {
          type: 'slack_oauth_code',
          code,
        },
        window.location.origin
      );
    } else if (error) {
      // Send error back to parent window
      window.opener?.postMessage(
        {
          type: 'slack_oauth_error',
          error: error || 'Unknown Slack OAuth error',
        },
        window.location.origin
      );
    }

    // Close popup after a brief delay to ensure postMessage is received
    setTimeout(() => {
      window.close();
    }, 500);
  }, [searchParams]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#0d0d0f',
      fontFamily: 'monospace',
      color: '#a0a0a0',
      fontSize: '12px',
    }}>
      <div>Authenticating with Slack…</div>
    </div>
  );
};

export default SlackCallback;
