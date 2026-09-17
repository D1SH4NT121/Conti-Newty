# CONTI-NEWTY: Component Migration Map (P0.5)

This document maps all frontend components from the Figma Make project (`C:\Users\LENOVO\Downloads\App Builder`) to their new locations in `apps/web/`, identifying their backend bindings and migration status.

---

## 1. Application Shell & Context

| Figma Make Source File | Target Location in Monorepo | Backend Bindings / REST / Sockets | Migration Status | Notes / Removals |
| :--- | :--- | :--- | :--- | :--- |
| `src/App.tsx` | `apps/web/src/App.tsx` | `GET /api/workspaces` | P0.5 Mapped | Remove Supabase table check; use `/api/auth/me` and `/api/workspaces`. |
| `src/context/AuthContext.tsx` | `apps/web/src/context/AuthContext.tsx` | `POST /api/auth/login`<br>`POST /api/auth/register`<br>`GET /api/auth/me`<br>`POST /api/auth/verify-session` | P0.5 Mapped | Dual Identity Adapter: handles both native JWT and Supabase OAuth. |
| `src/context/WorkspaceContext.tsx` | `apps/web/src/context/WorkspaceContext.tsx` | `/api/workspaces/*`<br>`/api/workspaces/:id/files/*`<br>`/api/workspaces/:id/tasks/*` | P0.5 Mapped | Remove client Supabase queries. Bind all state to Antigravity REST APIs. |
| *(New)* | `apps/web/src/context/SocketContext.tsx` | Antigravity Socket.IO gateway (`ws://localhost:3000`) | P0.5 Mapped | Receives `presence:update`, `task:event`, `file:changed`. |
| `src/components/WorkspaceShell.tsx` | `apps/web/src/components/WorkspaceShell.tsx` | Navigation state & command palette | P0.5 Mapped | Preserves frameless sidebar, topbar search, notifications panel. |

---

## 2. Public & Entry Pages

| Figma Make Source File | Target Location in Monorepo | Backend Bindings / REST | Migration Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `src/pages/Landing.tsx` | `apps/web/src/pages/Landing.tsx` | None (Static / Interactive Hero) | P0.5 Mapped | Preserves editorial typography and interactive 7-state hero. |
| `src/pages/Auth.tsx` | `apps/web/src/pages/Auth.tsx` | `POST /api/auth/login`<br>`POST /api/auth/register` | P0.5 Mapped | Tactile tabs for Sign In / Create Account with error banners. |
| `src/pages/EnterWorkspace.tsx` | `apps/web/src/pages/EnterWorkspace.tsx` | `GET /api/workspaces` | P0.5 Mapped | Router between create workspace and joined workspaces. |
| `src/pages/Onboarding.tsx` | `apps/web/src/pages/Onboarding.tsx` | `POST /api/workspaces` (with `{ template: 'icm' }`)<br>`POST /api/workspaces/:id/upload` | P0.5 Mapped | 3-step setup wizard: Workspace $\rightarrow$ Knowledge $\rightarrow$ Team. |

---

## 3. Workspace Views

| Figma Make Source File | Target Location in Monorepo | Backend Bindings / REST / Sockets | Migration Status | Critical Requirements |
| :--- | :--- | :--- | :--- | :--- |
| `src/pages/workspace/Home.tsx` | `apps/web/src/pages/workspace/Home.tsx` | `GET /api/workspaces/:id`<br>`GET /api/workspaces/:id/files`<br>`GET /api/workspaces/:id/tasks` | P0.5 Mapped | Renders workspace pulse, recent documents, quick Ask launcher. |
| `src/pages/workspace/Ask.tsx` | `apps/web/src/pages/workspace/Ask.tsx` | `POST /api/workspaces/:id/tasks`<br>`GET /api/workspaces/:id/tasks/:taskId`<br>`ws: task:event` | P0.5 Mapped | **DELETE `searchDocuments()` mock**. Bind directly to `AgentRunner`. Render real traversal timeline and SHA-256 verified provenance card. |
| `src/pages/workspace/CompanyBrain.tsx` | `apps/web/src/pages/workspace/CompanyBrain.tsx` | `GET /api/workspaces/:id/files`<br>`GET/PUT/DELETE /api/workspaces/:id/files/*` | P0.5 Mapped | Living filesystem browser with line-numbered markdown preview and safe editor. |
| `src/pages/workspace/Work.tsx` | `apps/web/src/pages/workspace/Work.tsx` | `GET /api/workspaces/:id/tasks`<br>`POST /api/workspaces/:id/changes`<br>`POST /api/workspaces/:id/changes/:id/approve` | P0.5 Mapped | Task detail view, visual diff viewer, approval buttons, record to brain. |
| `src/pages/workspace/Agents.tsx` | `apps/web/src/pages/workspace/Agents.tsx` | Multi-provider config & agent telemetry | P0.5 Mapped | Displays AI agent roster (Research, Scribe, Validator, Dev). |
| `src/pages/workspace/Software.tsx` | `apps/web/src/pages/workspace/Software.tsx` | `POST /api/workspaces/:id/apps`<br>`GET /api/workspaces/:id/apps/:id/run` | P0.5 Mapped | Generates small apps and displays live sandboxed Node VM preview. |
| `src/pages/workspace/Members.tsx` | `apps/web/src/pages/workspace/Members.tsx` | `GET /api/workspaces/:id`<br>`POST /api/workspaces/:id/members` | P0.5 Mapped | RBAC member table, role pills, invitation trigger. |
| `src/pages/workspace/Activity.tsx` | `apps/web/src/pages/workspace/Activity.tsx` | Audit logs & task event stream | P0.5 Mapped | Chronological workspace timeline of human and agent actions. |
| `src/pages/workspace/Security.tsx` | `apps/web/src/pages/workspace/Security.tsx` | `GET /api/workspaces/:id`<br>`POST /api/workspaces/:id/readonly-paths`<br>`POST /api/workspaces/:id/anonymize` | P0.5 Mapped | Read-only path manager and data sanitization tool. |
| `src/pages/workspace/Settings.tsx` | `apps/web/src/pages/workspace/Settings.tsx` | `GET /api/workspaces/:id/download` | P0.5 Mapped | Workspace metadata editor and ZIP export download. |
