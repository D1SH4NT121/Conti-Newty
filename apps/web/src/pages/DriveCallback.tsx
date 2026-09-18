/**
 * /w/drive/callback
 *
 * Google redirects here after the user consents to the drive.file scope.
 * This page:
 *   1. Parses the ?code= and ?error= from the URL
 *   2. Sends a postMessage to the opener (DrivePickerConnector)
 *   3. Closes itself
 *
 * The access_token is NOT available at this stage — the backend exchanges the
 * code for tokens. We pass the code to the opener which forwards it to the API.
 */

import React, { useEffect } from 'react';

export const DriveCallback: React.FC = () => {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'drive_oauth_code', code: code ?? null, error: error ?? null },
        window.location.origin
      );
    }

    // Auto-close after a short delay so the user sees the status
    const t = setTimeout(() => window.close(), 600);
    return () => clearTimeout(t);
  }, []);

  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');

  return (
    <div className="min-h-screen bg-[#0d0d0f] flex items-center justify-center">
      <div className="text-center font-mono text-sm text-white/60 space-y-2">
        {error ? (
          <>
            <div className="text-red-400">Drive authorisation failed: {error}</div>
            <div className="text-white/30 text-xs">You can close this window.</div>
          </>
        ) : (
          <>
            <div className="text-emerald-400">✓ Authorised — closing…</div>
          </>
        )}
      </div>
    </div>
  );
};

export default DriveCallback;
