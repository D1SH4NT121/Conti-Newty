# CONTI-NEWTY: Backend API & Realtime Reality Audit (P0.5)

This audit is derived from actual code in `src/` and verified with the Jest test suite (16 suites, 83 passing tests).

---

## 1. Authentication & Identity (`src/api/auth/auth-router.ts`)

| Endpoint | Method | Auth Req | Role Req | Handler / Service | Request Payload | Response Payload | Status | Test Coverage | Gaps / Actions Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | None | None | `AuthService.verifyPassword` | `{ email: string, password: string }` | `{ token: string, user: { id, email, name, role } }` | **VERIFIED** | `tests/auth.test.ts`, `tests/api.test.ts` | None for native login. |
| `/api/auth/register` | `POST` | None | None | `AuthService.hashPassword` + `prisma.user.create` | `{ email: string, password: string, name?: string, organizationId?: string }` | `{ token: string, user: { id, email, name, role } }` | **VERIFIED** | `tests/auth.test.ts` | Default org auto-creation if `organizationId` is omitted. |
| `/api/auth/me` | `GET` | Bearer JWT | None | `authMiddleware` | None | `{ user: { id, email, name, role } }` | **VERIFIED** | `tests/api.test.ts` | None. |
| `/api/auth/verify-session` | `POST` | None | None | *Identity Adapter* | `{ supabaseToken: string }` | `{ token: string, user: { id, email, name, role } }` | **MISSING** | None (New) | Implement Dual Identity Adapter endpoint to verify Supabase JWT & sync user. |

---

## 2. Workspaces & Membership (`src/api/workspaces/workspace-router.ts`)

| Endpoint | Method | Auth Req | Role Req | Handler / Service | Request Payload | Response Payload | Status | Test Coverage | Gaps / Actions Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/workspaces` | `GET` | Bearer JWT | User | `prisma.workspaceMember.findMany` | None | `[ { id, name, description, role, organizationId, createdAt, ... } ]` | **VERIFIED** | `tests/api.test.ts` | Returns all joined workspaces + user role. |
| `/api/workspaces` | `POST` | Bearer JWT | User | `prisma.workspace.create` + `WorkspaceMember(role: 'admin')` | `{ name: string, description?: string, organizationId?: string, template?: 'icm' }` | `201 Created: Workspace object` | **VERIFIED** | `tests/api.test.ts`, `tests/icm-archive.test.ts` | Auto-seeds founder ICM directory structure when `template: 'icm'`. |
| `/api/workspaces/:id` | `GET` | Bearer JWT | `viewer` | `prisma.workspace.findUnique` | None | `{ id, name, members: [...], readOnlyPaths: [...] }` | **VERIFIED** | `tests/prd-full-features.test.ts` | None. |
| `/api/workspaces/:id/download` | `GET` | Bearer JWT | `viewer` | `WorkspaceArchiveManager.exportZip` | None | Binary ZIP stream (`Content-Type: application/zip`) | **VERIFIED** | `tests/icm-archive.test.ts` | None. |
| `/api/workspaces/:id/upload` | `POST` | Bearer JWT | `member` | `WorkspaceArchiveManager.importZip` | `{ zipBase64?: string, files?: Array<{path, content}> }` | `{ success: true, importedCount: number, files: string[] }` | **VERIFIED** | `tests/icm-archive.test.ts` | Safe path traversal sanitization active. |
| `/api/workspaces/:id/members` | `POST` | Bearer JWT | `admin` | `prisma.workspaceMember.create` | `{ userId: string, role?: 'owner'\|'admin'\|'member'\|'viewer' }` | `201 Created: WorkspaceMember` | **VERIFIED** | `tests/prd-full-features.test.ts` | Add invite by email endpoint / token flow for Figma Members UI. |
| `/api/workspaces/:id/readonly-paths` | `POST` | Bearer JWT | `admin` | `prisma.readOnlyPath.create` | `{ path: string }` | `201 Created: ReadOnlyPath` | **VERIFIED** | `tests/storage.test.ts` | None. |
| `/api/workspaces/:id/anonymize` | `POST` | Bearer JWT | `viewer` | `DataAnonymizer.anonymize` | `{ filePath?: string, text?: string, customEntities?: string[] }` | `{ success: true, anonymizedText, entitiesMasked }` | **VERIFIED** | `tests/providers-anonymizer.test.ts` | None. |

---

## 3. Living Filesystem & Brain Storage (`src/api/files/file-router.ts`)

| Endpoint | Method | Auth Req | Role Req | Handler / Service | Request Payload | Response Payload | Status | Test Coverage | Gaps / Actions Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/workspaces/:id/files` | `GET` | Bearer JWT | `viewer` | `WorkspaceStorage.listDirectory('')` | None | `{ files: [ { name, path, isDirectory, size?, updatedAt? } ] }` | **VERIFIED** | `tests/api.test.ts`, `tests/storage.test.ts` | Lists root entries with directory flags. |
| `/api/workspaces/:id/files/*` | `GET` | Bearer JWT | `viewer` | `WorkspaceStorage.readFile` / `listDirectory` | None | `{ path: string, content: string }` OR `{ files: [...] }` | **VERIFIED** | `tests/api.test.ts`, `tests/storage.test.ts` | Supports subfolder navigation and `?download=true`. |
| `/api/workspaces/:id/files/*` | `PUT` | Bearer JWT | `member` | `WorkspaceStorage.writeFile` + `EventBroadcaster` | `{ content: string }` | `{ success: true, path: string }` | **VERIFIED** | `tests/api.test.ts`, `tests/storage.test.ts` | Path traversal guard active (`validateSafePath`). Read-only path guard enforced. |
| `/api/workspaces/:id/files/*` | `DELETE` | Bearer JWT | `member` | `WorkspaceStorage.deleteFile` + `EventBroadcaster` | None | `{ success: true, message: string }` | **VERIFIED** | `tests/storage.test.ts` | Read-only path guard enforced. |

---

## 4. AI Brain Agent & Grounded Provenance (`src/api/tasks/task-router.ts`)

| Endpoint | Method | Auth Req | Role Req | Handler / Service | Request Payload | Response Payload | Status | Test Coverage | Gaps / Actions Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/workspaces/:id/tasks` | `POST` | Bearer JWT | `member` | `AgentRunner.runTask` + `BrainTools` | `{ title?: string, prompt: string }` | `{ taskId: string, status: 'COMPLETED'\|'FAILED', answer: string, citations: SourceCitation[] }` | **VERIFIED** | `tests/brain-agent.test.ts`, `tests/api.test.ts` | Citations currently provide `{ filePath, startLine, endLine }`. Must be enhanced with `contentHash` (SHA-256) and `retrievedAt`. |
| `/api/workspaces/:id/tasks/:taskId` | `GET` | Bearer JWT | `viewer` | `prisma.agentTask.findUnique` | None | `{ id, title, description, status, events: AgentEvent[], executions: ToolExecution[] }` | **VERIFIED** | `tests/brain-agent.test.ts` | Returns deterministic event timeline of tool operations. |
| `/api/workspaces/:id/tasks/:taskId/cancel` | `POST` | Bearer JWT | `member` | `prisma.agentTask.update` | None | `{ id, status: 'CANCELLED' }` | **VERIFIED** | `tests/prd-full-features.test.ts` | None. |

---

## 5. Changes & Diff Approval Engine (`src/api/changes/change-router.ts`)

| Endpoint | Method | Auth Req | Role Req | Handler / Service | Request Payload | Response Payload | Status | Test Coverage | Gaps / Actions Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/workspaces/:id/changes` | `POST` | Bearer JWT | `member` | `ChangeService.proposeChange` | `{ targetPath, originalContent, proposedContent, description }` | `{ id, targetPath, diff, status: 'PENDING', ... }` | **VERIFIED** | `tests/changes.test.ts` | Unified diff calculated server-side. |
| `/api/workspaces/:id/changes` | `GET` | Bearer JWT | `viewer` | `ChangeService.getPendingChanges` | None | `[ { id, targetPath, diff, status, ... } ]` | **VERIFIED** | `tests/changes.test.ts` | None. |
| `/api/workspaces/:id/changes/:id/approve` | `POST` | Bearer JWT | `admin` | `ChangeService.applyChange` | None | `{ id, status: 'APPROVED', applied: true }` | **VERIFIED** | `tests/changes.test.ts` | Atomic write to `WorkspaceStorage`. |
| `/api/workspaces/:id/changes/:id/reject` | `POST` | Bearer JWT | `admin` | `ChangeService.rejectChange` | None | `{ id, status: 'REJECTED' }` | **VERIFIED** | `tests/changes.test.ts` | None. |

---

## 6. Small Software Cloud (`src/api/apps/app-router.ts`)

| Endpoint | Method | Auth Req | Role Req | Handler / Service | Request Payload | Response Payload | Status | Test Coverage | Gaps / Actions Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/workspaces/:id/apps` | `POST` | Bearer JWT | `member` | `AppGeneratorService.generateApp` | `{ name: string, prompt: string, template?: string }` | `{ appId, deploymentId, code, status, deploymentUrl }` | **VERIFIED** | `tests/app-generator.test.ts`, `tests/api.test.ts` | Generates validated JS/HTML in DB. |
| `/api/workspaces/:id/apps/:appId` | `GET` | Bearer JWT | `viewer` | `prisma.appWorkspace.findUnique` | None | `{ id, name, description, deployments: [...] }` | **VERIFIED** | `tests/app-generator.test.ts` | None. |
| `/api/workspaces/:id/apps/:appId/run` | `GET` | Bearer JWT | `viewer` | `SandboxRunner.execute` | None | `{ result: any, logs: string[], durationMs: number }` | **VERIFIED** | `tests/app-generator.test.ts` | Runs sandboxed Node VM execution. |

---

## 7. Realtime Gateway & Sockets (`src/realtime/socket-server.ts`)

| Event Name | Direction | Payload | Server Handler | Broadcast Target | Status | Test Coverage | Gaps / Actions Needed |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `join_workspace` | Client $\rightarrow$ Server | `{ workspaceId: string, userId: string, userName: string }` | `PresenceManager.userJoined` | `presence:update` to room `workspace:<id>` | **VERIFIED** | `tests/realtime.test.ts` | Room is named `workspace:<id>`. |
| `leave_workspace` | Client $\rightarrow$ Server | `{ workspaceId: string, userId: string }` | `PresenceManager.userLeft` | `presence:update` to room `workspace:<id>` | **VERIFIED** | `tests/realtime.test.ts` | None. |
| `heartbeat` | Client $\rightarrow$ Server | `{ workspaceId: string, userId: string }` | `PresenceManager.recordHeartbeat` | None | **VERIFIED** | `tests/realtime.test.ts` | Stale timeout: 30s. |
| `task:event` | Server $\rightarrow$ Client | `{ taskId, type, payload }` | `EventBroadcaster.broadcastAgentEvent` | Room `workspace:<id>` | **VERIFIED** | `tests/realtime.test.ts` | Emits live traversal tool executions. |
| `file:changed` | Server $\rightarrow$ Client | `{ filePath, action, updatedBy }` | `EventBroadcaster.broadcastFileChanged` | Room `workspace:<id>` | **VERIFIED** | `tests/realtime.test.ts` | Emitted upon PUT/DELETE files. |
| `message:chunk` | Server $\rightarrow$ Client | `{ threadId, chunk, isLast }` | `EventBroadcaster.broadcastMessageChunk` | Room `workspace:<id>` | **VERIFIED** | `tests/realtime.test.ts` | Emitted during AI response streaming. |
