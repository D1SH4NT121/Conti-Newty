# Workbench Full System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully functional, production-ready Workbench (AI Workspace for Knowledge, Collaboration & Software) covering Company Brain, Multiplayer AI, and Small Software Cloud with complete backend, database, AI agent harness, real-time WebSockets, sandbox runner, REST APIs, and an interactive frontend UI.

**Architecture:** Modular monolith built with Node.js and TypeScript. Clean domain modules for Storage, Auth & Authorization, AI Agent Harness (with server-side tool authorization & source grounding), Change Review, Real-time WebSocket engine, App Generation & Isolated Sandbox Runtime, comprehensive REST APIs, and an interactive web interface.

**Tech Stack:** Node.js 18+, TypeScript 5+, Express.js, Socket.io, Prisma ORM, SQLite/PostgreSQL, Anthropic Claude SDK (@anthropic-ai/sdk), Zod, Jest, Supertest, HTML5/Tailwind/React frontend client.

**Spec:** `docs/superpowers/specs/2026-09-11-workbench-design.md`

## Global Constraints

- Platform: Windows/Linux/macOS compatible (cross-platform path resolution using path.resolve and forward-slash normalization).
- Path traversal prevention: Every path-taking tool must strictly resolve against the workspace root and verify `resolved.startsWith(workspaceRoot)` server-side.
- Authorization chain: Every tool execution checks Human identity -> Workspace permissions -> Thread/task context -> Requested tool -> Target resource -> Allow/Deny.
- Approval enforcement: Sensitive file modifications require Propose -> Review -> Server-side Approve -> Execute.
- App isolation: Generated apps execute in isolated sandboxes with strict resource and path boundaries.
- No placeholders: All code, types, endpoints, and test cases must be fully written and functional.

---

### Task 1: Project Scaffolding, Package Setup & TypeScript Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `.env.example`
- Create: `src/config/index.ts`
- Create: `src/types/index.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Produces: Configuration singleton (`config`) and core TypeScript interfaces (`UserRole`, `WorkspaceKind`, `ToolName`, `AgentTaskStatus`, `AppAccessMode`, etc.).

- [x] **Step 1: Write failing test for configuration loader**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement package.json, tsconfig.json, jest.config.js, src/types/index.ts, and src/config/index.ts**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit changes**

---

### Task 2: Prisma Schema, Database Setup & Repository Layer

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/db/client.ts`
- Create: `src/db/seed.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: `src/config/index.ts`, `src/types/index.ts`
- Produces: `prisma` client instance, database models for Organization, User, Membership, Workspace, WorkspaceMember, ReadOnlyPath, Thread, Message, AgentTask, AgentEvent, ToolExecution, AppWorkspace, AppDeployment, AppAccess, UsageLog, AuditLog.

- [x] **Step 1: Write test verifying database connectivity and basic model CRUD operations**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Create Prisma schema with SQLite/Postgres support and DB client singleton**
- [x] **Step 4: Run Prisma migrations / db push and seed script**
- [x] **Step 5: Run tests to verify all DB queries pass**

---

### Task 3: Storage Module & Workspace Security Sandbox

**Files:**
- Create: `src/modules/storage/workspace-storage.ts`
- Create: `src/modules/storage/path-validator.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Consumes: `src/config/index.ts`
- Produces: `WorkspaceStorage` class with `resolveSafePath`, `listDirectory`, `readFile`, `writeFile`, `createFile`, `deleteFile`, `isReadOnlyPath`.

- [x] **Step 1: Write test for path traversal rejection and file operations**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement path-validator with strict boundaries and WorkspaceStorage**
- [x] **Step 4: Run test to verify security and file operations pass**
- [x] **Step 5: Commit changes**

---

### Task 4: Auth, Authorization & Tool Execution Chain

**Files:**
- Create: `src/modules/auth/auth-service.ts`
- Create: `src/modules/auth/authorization-guard.ts`
- Create: `src/middleware/auth-middleware.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `src/db/client.ts`, `src/types/index.ts`
- Produces: `evaluateToolAuthorization(user, workspaceId, toolName, resourcePath, db)`, `authenticateUser`, `requireWorkspaceRole`.

- [x] **Step 1: Write tests for RBAC, workspace roles, and AI tool authorization evaluations**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement auth service, JWT/token parsing, and tool authorization engine**
- [x] **Step 4: Run test to verify authorization correctly permits/denies operations**
- [x] **Step 5: Commit changes**

---

### Task 5: AI Agent Harness & Brain Tools with Source Grounding

**Files:**
- Create: `src/modules/brain/ai-client.ts`
- Create: `src/modules/brain/brain-tools.ts`
- Create: `src/modules/brain/agent-runner.ts`
- Create: `src/modules/brain/source-grounding.ts`
- Test: `tests/brain-agent.test.ts`

**Interfaces:**
- Consumes: `src/modules/storage/workspace-storage.ts`, `src/modules/auth/authorization-guard.ts`, `src/db/client.ts`
- Produces: `runAgentTask(taskId, workspaceId, userId, userPrompt, callbacks)` executing the agent loop with `list_directory`, `read_file`, `write_file`, `create_file`, `propose_change`, `search_files`.

- [x] **Step 1: Write tests for tool execution, source citation tracking, and agent lifecycle**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement Brain tools, Anthropic Claude SDK harness (with deterministic mock fallback), and agent runner**
- [x] **Step 4: Run tests to verify tool invocation, source grounding, and task completion**
- [x] **Step 5: Commit changes**

---

### Task 6: Change Review & Server-Side Approval Engine

**Files:**
- Create: `src/modules/changes/change-service.ts`
- Test: `tests/changes.test.ts`

**Interfaces:**
- Consumes: `src/modules/storage/workspace-storage.ts`, `src/db/client.ts`
- Produces: `createProposedChange`, `getProposedChange`, `approveChange`, `rejectChange`.

- [x] **Step 1: Write tests for diff computation, proposed change storage, approval application, and rejection**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement change-service with server-side validation and file patching**
- [x] **Step 4: Run tests to verify approval workflow functions correctly**
- [x] **Step 5: Commit changes**

---

### Task 7: App Generation Engine & Isolated Sandbox Cloud

**Files:**
- Create: `src/modules/app-generator/generator-service.ts`
- Create: `src/modules/app-generator/templates.ts`
- Create: `src/modules/app-generator/sandbox-runner.ts`
- Create: `src/modules/app-generator/validator.ts`
- Test: `tests/app-generator.test.ts`

**Interfaces:**
- Consumes: `src/modules/storage/workspace-storage.ts`, `src/db/client.ts`
- Produces: `generateAppFromKnowledge(workspaceId, prompt, userId)`, `deployAppSandbox(appWorkspaceId)`, `stopAppSandbox(appWorkspaceId)`, `getAppSandboxUrl(slug)`.

- [x] **Step 1: Write tests for code generation from context, security validation, and sandbox server execution**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement templates (HTML/JS, React, Node API, Flask, Dashboard), code generator, vulnerability validator, and isolated express/static sandbox runner**
- [x] **Step 4: Run tests to verify generated apps build, deploy, and serve live requests correctly**
- [x] **Step 5: Commit changes**

---

### Task 8: Real-Time Engine (WebSockets & Multiplayer Sync)

**Files:**
- Create: `src/realtime/socket-server.ts`
- Create: `src/realtime/presence-manager.ts`
- Create: `src/realtime/event-broadcaster.ts`
- Test: `tests/realtime.test.ts`

**Interfaces:**
- Consumes: `src/db/client.ts`
- Produces: Socket.io server with `workspace.join`, `presence.changed`, `message.chunk`, `agent.tool.started`, `agent.tool.completed`, `file.changed`, `task.updated`.

- [x] **Step 1: Write test for client connections, room joining, presence broadcasting, and streaming chunks**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement Socket.io server, presence manager, and event broadcaster**
- [x] **Step 4: Run tests to verify real-time events and presence updates**
- [x] **Step 5: Commit changes**

---

### Task 9: REST API Routes & Controllers

**Files:**
- Create: `src/api/workspaces/workspace-router.ts`
- Create: `src/api/files/file-router.ts`
- Create: `src/api/threads/thread-router.ts`
- Create: `src/api/tasks/task-router.ts`
- Create: `src/api/changes/change-router.ts`
- Create: `src/api/apps/app-router.ts`
- Create: `src/api/orgs/org-router.ts`
- Create: `src/api/app.ts`
- Create: `src/server.ts`
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: All modules (Brain, Storage, Auth, Changes, App Generator, Realtime)
- Produces: Complete Express application with all PRD Section 14 endpoints and error handling middleware.

- [x] **Step 1: Write integration tests for all REST API endpoints**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement all routers, controllers, validation schemas, and Express app entrypoint**
- [x] **Step 4: Run tests to verify all endpoints respond with correct status codes and JSON payloads**
- [x] **Step 5: Commit changes**

---

### Task 10: Interactive Web Frontend (Workbench UI)

**Files:**
- Create: `public/index.html`
- Create: `public/css/styles.css`
- Create: `public/js/app.js`
- Create: `public/js/brain-view.js`
- Create: `public/js/multiplayer-view.js`
- Create: `public/js/apps-view.js`
- Create: `public/js/changes-view.js`
- Test: `tests/frontend.test.ts`

**Interfaces:**
- Consumes: REST APIs and Socket.io endpoints
- Produces: Full modern responsive single-page web application featuring:
  1. Workspace selector and creation
  2. File explorer, file viewer, editor, and uploader
  3. AI chat with streaming responses, source-grounded citations, and tool activity logs
  4. Real-time multiplayer presence indicators, active collaborators, and intent badges
  5. Interactive Change Review drawer with diff view and Approve/Reject buttons
  6. Small Software Cloud tab: generate apps from workspace knowledge, live preview sandbox iframe, deployment status, and link sharing controls.

- [x] **Step 1: Write test verifying static asset serving and UI routing**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Implement full responsive frontend with rich styling, Socket.io client integration, and real-time tabs**
- [x] **Step 4: Run tests to verify frontend assets load and interact correctly with backend**
- [x] **Step 5: Commit changes**

---

### Task 11: End-to-End System Verification & Demo Suite

**Files:**
- Create: `tests/e2e/workbench-e2e.test.ts`
- Create: `scripts/demo-seed.ts`
- Create: `README.md`

**Interfaces:**
- Verifies complete loop: Upload knowledge files -> Ask AI questions with citations -> Multiplayer collaboration -> AI proposes changes -> Server-side review & approval -> Generate full app from workspace knowledge -> Deploy app to isolated sandbox -> Access live running app.

- [x] **Step 1: Write comprehensive end-to-end integration test suite**
- [x] **Step 2: Run test to verify all flows pass**
- [x] **Step 3: Create demo seed data (SOPs, customer feedback, sales data) and quickstart README**
- [x] **Step 4: Perform final verification of all test suites**
- [x] **Step 5: Final commit and summary**
