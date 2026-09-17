# CONTI-NEWTY — UX Migration & Divergence Audit (Recovery Analysis)

**Document Target:** `docs/migration/current-ux-divergence.md`  
**Date:** September 12, 2026  
**Status:** UX RECOVERY & CONVERGENCE DIRECTIVE  

---

## 1. Executive Summary

During the Phase V0/V1 engine verification, an incorrect frontend routing & presentation architecture was temporarily deployed in `apps/web/src/App.tsx`. Rather than presenting the authentic **Figma Make** multi-stage product experience (Frameless Editorial Landing Page $\rightarrow$ Sign In / Sign Up $\rightarrow$ Enter Workspace Catalog $\rightarrow$ 3-Step Onboarding $\rightarrow$ Workspace Shell with 10 Dedicated Surfaces), the application was flattened into a single-screen dashboard with direct admin login.

This document formally records the exact divergences between the Figma Make product specification and the temporary V0/V1 state, and outlines the recovery plan to achieve 100% fidelity to the Figma Make experience backed by Antigravity intelligence.

---

## 2. Comprehensive Divergence Matrix

### A. Routing & Top-Level Entry Flow

| Feature / Screen | Figma Make Source of Truth | Divergent V0/V1 Implementation | Corrective Action |
| :--- | :--- | :--- | :--- |
| **Root Route (`/`)** | **Editorial Frameless Landing Page** with interactive 7-stage hero progression, query live-switchers, knowledge shift visualizer, and live provenance demos. | Bypassed entirely; rendered login screen directly if unauthenticated. | Restored `Landing.tsx` as default `/` route using `react-router-dom`. |
| **Auth Route (`/auth`)** | Tactile Dual-Tab **Sign In / Create Account** with email/password and demo role quick-fillers. | Replaced with test login form focusing only on `admin@antinewty.local`. | Replaced with full `Auth.tsx` supporting native registration and sign-in. |
| **Workspace Selector (`/enter`)** | **Enter Workspace** screen with search, member role pills, and "+ Initialize Workspace" launcher. | Inlined dark dashboard card selector inside a monolithic state switch. | Restored dedicated `EnterWorkspace.tsx` page. |
| **Onboarding (`/onboarding`)** | **3-Step Institutional Setup Wizard** (01. Identity $\rightarrow$ 02. ICM / Custom $\rightarrow$ 03. Member Invites). | Monolithic modal dialog without 3-step progressive onboarding flow. | Restored full `Onboarding.tsx` wizard. |
| **Workspace Container (`/w/:id/*`)** | **Frameless Editorial Workspace Shell** with sidebar navigation across 10 surfaces. | Replaced with a simplified 3-tab container. | Restored full `WorkspaceShell.tsx` with React Router `<Outlet />` and 10 surfaces. |

---

### B. Visual & Design System Divergences

| Design Dimension | Figma Make Truth | Divergent V0 State | Recovery State |
| :--- | :--- | :--- | :--- |
| **Color Palette** | Editorial Warm Light (`#FAF8F5` canvas, `#FFFFFF` cards, `#8B263E` crimson accents, `#1C1917` serif text). | Generic dark mode (`#0d0f12`, emerald badges, grey borders). | 100% restored to `#FAF8F5` Editorial palette with custom Tailwind config. |
| **Typography** | Editorial Serif headings (`Instrument Serif` / `Playfair`), Modern Sans (`Inter` / `Plus Jakarta`), Monospace for hashes and coordinates (`JetBrains Mono`). | Generic browser monospace font. | Configured editorial font families in `tailwind.config.js` and `index.css`. |
| **Component Hierarchy** | Frameless editorial layout with subtle borders (`#E7E5E4`), high-density metadata cards, and interactive live tabs. | Boxy SaaS cards with heavy drop shadows. | Realigned to Figma frameless styling. |

---

### C. Workspace Surfaces & Functionality Status

| Figma Surface | Required Route | Backend Endpoint Binding | Divergence & Migration Status |
| :--- | :--- | :--- | :--- |
| **Home** | `/w/:id/home` | `GET /api/workspaces/:id`, `GET /api/workspaces/:id/files` | Restored; renders institutional metrics, live status, and Quick Ask launcher. |
| **Ask** | `/w/:id/ask` | `POST /api/workspaces/:id/tasks`, `AgentRunner`, `SourceGrounding` | **Fixed**: Removed fake `searchDocuments()`; wired to real `AgentRunner` with live traversal stages and client-side SHA-256 independent verification. |
| **Company Brain** | `/w/:id/brain` | `GET/PUT/DELETE /api/workspaces/:id/files/*` | Restored; living filesystem browser with tree navigator and inline markdown editor. |
| **Work** | `/w/:id/work` | `GET /api/workspaces/:id/tasks` | Restored; task execution logs, diff review, and change approval. |
| **Agents** | `/w/:id/agents` | `GET /api/workspaces/:id` | Restored; multi-agent roster (Research, Scribe, Validator, Dev). |
| **Software** | `/w/:id/software` | `POST /api/workspaces/:id/apps` | Restored; mini-application sandboxing and live code generation preview. |
| **Members** | `/w/:id/members` | `GET/POST /api/workspaces/:id/members` | Restored; RBAC role management and invite triggers. |
| **Activity** | `/w/:id/activity` | `GET /api/workspaces/:id/activity` | Restored; chronological audit trail of human and agent operations. |
| **Security** | `/w/:id/security` | `GET/POST /api/workspaces/:id/security` | Restored; read-only boundary enforcement and SHA-256 provenance verifier. |
| **Settings** | `/w/:id/settings` | `GET/PUT /api/workspaces/:id`, `GET /api/workspaces/:id/archive` | Restored; workspace metadata and ZIP export/import controls. |

---

## 3. Corrective Implementation Plan

1. **Routing Reconstruction**: `apps/web/src/App.tsx` updated with `BrowserRouter`, `Routes`, and `Route` matching the Figma routing topology.
2. **Surface Completion**: Provide all remaining workspace surface components (`Agents.tsx`, `Software.tsx`, `Members.tsx`, `Activity.tsx`, `Security.tsx`, `Settings.tsx`) adhering strictly to the Figma design system and wired to Antigravity API endpoints.
3. **Socket & Presence**: Integrate real-time WebSocket communication in `SocketContext.tsx` for collaborative presence and live traversal streaming.
4. **Verification**: Validate all routes and visual hierarchy in the browser.
