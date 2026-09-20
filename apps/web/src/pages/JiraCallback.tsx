/**
 * JiraCallback
 *
 * OAuth redirect target for Atlassian OAuth flow.
 * This page is opened in a popup by JiraConnector.tsx.
 * On load, it extracts the auth code from the URL and posts it back
 * to the parent window via postMessage, then closes the popup.
 *
 * URL pattern: /w/jira/callback?code=...&state=...&error=...
 */

import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export const JiraCallback: React.FC = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (code) {
      // Send code back to parent window
      window.opener?.postMessage(
        {
          type: 'jira_oauth_code',
          code,
        },
        window.location.origin
      );
    } else if (error) {
      // Send error back to parent window
      window.opener?.postMessage(
        {
          type: 'jira_oauth_error',
          error: `${error}: ${errorDescription || ''}`.trim(),
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
      <div>Authenticating with Atlassian…</div>
    </div>
  );
};

export default JiraCallback;
