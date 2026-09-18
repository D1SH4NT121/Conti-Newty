import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Landing } from './pages/Landing';
import { Auth } from './pages/Auth';
import { AuthCallback } from './pages/AuthCallback';
import { EnterWorkspace } from './pages/EnterWorkspace';
import { InviteRedirect } from './pages/InviteRedirect';
import { Onboarding } from './pages/Onboarding';
import { DriveCallback } from './pages/DriveCallback';
import { WorkspaceShell } from './components/WorkspaceShell';

// Workspace views
import { Home } from './pages/workspace/Home';
import { Ask } from './pages/workspace/Ask';
import { CompanyBrain } from './pages/workspace/CompanyBrain';
import { Work } from './pages/workspace/Work';
import { Agents } from './pages/workspace/Agents';
import { Software } from './pages/workspace/Software';
import { Members } from './pages/workspace/Members';
import { Activity } from './pages/workspace/Activity';
import { Security } from './pages/workspace/Security';
import { Settings } from './pages/workspace/Settings';
import { Archives } from './pages/workspace/Archives';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public & Institutional Entry Flow */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/invite/:token" element={<InviteRedirect />} />
            <Route path="/enter" element={<EnterWorkspace />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/w/drive/callback" element={<DriveCallback />} />

            {/* Living Knowledge Workspace Shell & Surfaces */}
            <Route path="/w/:workspaceId" element={<WorkspaceShell />}>
              <Route index element={<Home />} />
              <Route path="home" element={<Home />} />
              <Route path="ask" element={<Ask />} />
              <Route path="brain" element={<CompanyBrain />} />
              <Route path="work" element={<Work />} />
              <Route path="agents" element={<Agents />} />
              <Route path="software" element={<Software />} />
              <Route path="members" element={<Members />} />
              <Route path="activity" element={<Activity />} />
              <Route path="security" element={<Security />} />
              <Route path="settings" element={<Settings />} />
              <Route path="archives" element={<Archives />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
