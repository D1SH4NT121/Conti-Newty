# Live Agent Learning Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the thesis-critical Conti-Newty loop in which teams run a live agent session together, redirect it, review the resulting Skill Entry, and see confirmed skills reused in later sessions.

**Architecture:** Add a persisted `LiveSession` boundary around existing `AgentTask` execution. A server-authoritative session service owns participants, Driver/Observer control, redirects, replay events, and asynchronous execution; a correction/skill service distills redirects into versioned, reviewable Skill Entries and injects only confirmed skills into later agent context. The frontend replaces task-only collaboration with a Live Work dashboard, session control room, correction review, and Brain skills views while retaining existing source connectors as context providers.

**Tech Stack:** TypeScript, Express, Prisma/SQLite, Socket.IO, Jest/ts-jest, React, React Router, Vite, existing AI provider and workspace authorization services.

**Spec:** `docs/superpowers/specs/2026-09-18-live-agent-learning-product-design.md`

## Global Constraints

- One Driver can control the agent; observers can watch and request control.
- Redirect authority defaults to the current Driver; a workspace Admin or Owner can force-interrupt when necessary.
- Driver disconnect or abandonment pauses the session; an Observer is not promoted automatically.
- Observer control requests require explicit approval from the current Driver.
- New Skill Entries start as `tentative`; runtime retrieval uses confirmed entries only.
- Contradictory rules supersede earlier entries instead of overwriting history.
- Socket events never grant permissions; server-side authorization is required for every state change.
- Existing backend and frontend builds must continue to pass at every phase.
- Do not read, modify, or commit `.env`; environment values remain deployment configuration.
- Do not introduce CRDT editing, automatic Skill confirmation, billing, SSO/SCIM, compliance certification, or broad autonomous writes in the core implementation.

---

## File and module map

The implementation should follow these boundaries:

- `prisma/schema.prisma`: persisted sessions, participants, redirects, skills, and version relationships.
- `src/modules/sessions/session-service.ts`: transactional session lifecycle, participant roles, driver handoff, and authorization decisions.
- `src/modules/sessions/session-events.ts`: event names, payload types, persistence, and replay reconstruction.
- `src/modules/sessions/session-runner.ts`: asynchronous bridge between a Live Session and `AgentRunner`.
- `src/modules/skills/skill-service.ts`: candidate creation, review, confirmation, rejection, superseding, and confirmed retrieval.
- `src/modules/skills/skill-distiller.ts`: schema-validated AI distillation from a correction.
- `src/api/sessions/session-router.ts`: authenticated REST endpoints for sessions, control, redirects, replay, and skills.
- `src/realtime/socket-server.ts`: authenticated session room membership and server-originated session events.
- `src/api/app.ts`: mount the session router.
- `src/modules/brain/agent-runner.ts`: accept applied skills, emit interruptible session events, and check cancellation/redirect state.
- `apps/web/src/lib/api-client.ts`: typed session, redirect, replay, and skill calls.
- `apps/web/src/lib/socket.ts`: session room and event helpers.
- `apps/web/src/pages/workspace/LiveWork.tsx`: active-session homepage.
- `apps/web/src/pages/workspace/Session.tsx`: control room.
- `apps/web/src/pages/workspace/Corrections.tsx`: candidate review queue.
- `apps/web/src/pages/workspace/Brain.tsx`: confirmed skills and source files.
- `apps/web/src/components/workspace/SessionTimeline.tsx`: shared replay/timeline rendering.
- `apps/web/src/components/workspace/RedirectComposer.tsx`: Driver/admin redirect interaction.
- `apps/web/src/components/WorkspaceShell.tsx`: product navigation and route labels.
- `tests/sessions.test.ts`: service and API behavior.
- `tests/skills.test.ts`: Skill Entry lifecycle and retrieval.
- `tests/session-realtime.test.ts`: socket authorization, ordering, and replay.
- `tests/core-loop.test.ts`: end-to-end correction-to-reuse behavior.

---

### Task 1: Add persisted session and Skill Entry schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_live_agent_learning/migration.sql` via Prisma migration
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces `LiveSession`, `SessionParticipant`, `SessionEvent`, `AgentRedirect`, `SkillEntry`, and `SkillReview` Prisma models.
- `AgentTask` gains a nullable `sessionId` relation so existing tasks remain compatible.
- Later tasks consume statuses `CREATED`, `RUNNING`, `PAUSED`, `COMPLETED`, `FAILED`, `CANCELLED` for sessions; participant roles `DRIVER`, `OBSERVER`; skill statuses `TENTATIVE`, `CONFIRMED`, `REJECTED`, `SUPERSEDED`.

- [ ] **Step 1: Write schema assertions**

```ts
it('exposes session, redirect, and skill models', async () => {
  const session = await prisma.liveSession.create({
    data: { workspaceId, createdById: userId, title: 'Refund review', goal: 'Review refund policy', status: 'CREATED' },
  });
  await expect(prisma.sessionParticipant.create({
    data: { sessionId: session.id, userId, role: 'DRIVER', status: 'CONNECTED' },
  })).resolves.toMatchObject({ role: 'DRIVER' });
});
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx jest tests/db.test.ts --runInBand`

Expected: FAIL because the new Prisma models do not exist.

- [ ] **Step 3: Add the models and relations**

Use workspace/user foreign keys with cascade-safe relations. Add unique constraints for one participant per user/session and one active Driver per session. Store event payloads, correction context, evidence, and Skill Entry structured fields as JSON strings with indexed workspace/session/status fields.

- [ ] **Step 4: Generate and migrate**

Run: `npx prisma migrate dev --name live_agent_learning`

Then run: `npx prisma generate`

- [ ] **Step 5: Run the focused test**

Run: `npx jest tests/db.test.ts --runInBand`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prisma tests/db.test.ts
git commit -m "feat: add live session learning schema"
```

### Task 2: Implement session lifecycle and authorization service

**Files:**
- Create: `src/modules/sessions/session-events.ts`
- Create: `src/modules/sessions/session-service.ts`
- Test: `tests/sessions.test.ts`

**Interfaces:**
- `createSession(input: { workspaceId: string; userId: string; title: string; goal: string; agents?: AgentConfig[] }): Promise<LiveSessionDto>`
- `getSession(workspaceId: string, sessionId: string, userId: string): Promise<LiveSessionDto>`
- `joinSession(workspaceId: string, sessionId: string, userId: string): Promise<SessionParticipantDto>`
- `requestDriver(workspaceId: string, sessionId: string, userId: string): Promise<void>`
- `approveDriverRequest(workspaceId: string, sessionId: string, driverId: string, requesterId: string): Promise<void>`
- `handoffDriver(workspaceId: string, sessionId: string, driverId: string, nextDriverId: string): Promise<void>`
- `pauseForDisconnect(sessionId: string, driverId: string): Promise<void>`
- `assertCanRedirect(session: LiveSessionDto, userId: string, force: boolean): void`
- `appendSessionEvent(input: { sessionId: string; type: SessionEventType; actorId?: string; payload: unknown }): Promise<SessionEventDto>`

- [ ] **Step 1: Write failing lifecycle tests**

Cover creation assigning the creator as Driver, observer joins, explicit handoff approval, rejection of observer redirects, Admin/Owner force interrupt, and Driver disconnect pausing without promotion.

- [ ] **Step 2: Run the tests**

Run: `npx jest tests/sessions.test.ts --runInBand`

Expected: FAIL on missing service functions.

- [ ] **Step 3: Implement transaction-safe lifecycle methods**

Every method must verify workspace membership using existing authorization patterns, update the session and event record in one Prisma transaction, and reject stale driver/request IDs. Use a unique active-driver constraint or a transaction recheck to prevent two Drivers.

- [ ] **Step 4: Add replay reconstruction**

Implement `getReplay(sessionId, userId)` by loading ordered events and returning the immutable event sequence; reject access across workspaces.

- [ ] **Step 5: Run tests and type-check**

Run: `npx jest tests/sessions.test.ts --runInBand`

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/modules/sessions tests/sessions.test.ts
git commit -m "feat: add live session lifecycle service"
```

### Task 3: Add asynchronous session API and execution bridge

**Files:**
- Create: `src/modules/sessions/session-runner.ts`
- Create: `src/api/sessions/session-router.ts`
- Modify: `src/api/app.ts`
- Modify: `src/modules/brain/agent-runner.ts`
- Test: `tests/sessions.test.ts`
- Test: `tests/brain-agent.test.ts`

**Interfaces:**
- `POST /api/workspaces/:id/sessions` returns `202` with `{ sessionId, status: 'CREATED' }`.
- `GET /api/workspaces/:id/sessions` lists active/recent sessions.
- `GET /api/workspaces/:id/sessions/:sessionId` returns session, participants, applied skills, and ordered events.
- `POST /api/workspaces/:id/sessions/:sessionId/start` starts execution.
- `POST /api/workspaces/:id/sessions/:sessionId/redirect` accepts `{ instruction: string; evidence?: string; force?: boolean }`.
- `POST .../request-driver`, `POST .../approve-driver`, `POST .../handoff`, `POST .../pause`, and `POST .../cancel`.
- `POST /api/workspaces/:id/sessions/:sessionId/skills/distill` creates candidate skills for completed redirects.

- [ ] **Step 1: Write API tests**

Assert creation returns before model execution completes, cross-workspace access returns `403`/`404` according to existing conventions, redirects require the Driver unless `force` is used by Admin/Owner, and duplicate redirect IDs are idempotent.

- [ ] **Step 2: Refactor task execution entry point**

Extract the existing `AgentRunner.runTask` invocation into `SessionRunner.start(sessionId)`. Create or reuse an `AgentTask`, associate it with the session, and execute in a detached promise after returning `202`. Persist failures as session events and mark the session `FAILED`; do not swallow errors.

- [ ] **Step 3: Add redirect coordination**

Implement an in-memory per-session control registry backed by persisted redirect records. The runner checks for pending redirects before each model/tool step, pauses when one arrives, records `AGENT_STEP_INTERRUPTED`, appends the instruction, and resumes or cancels according to the request. Persist enough state to show the transition after reconnect.

- [ ] **Step 4: Mount the router**

Add `app.use('/api/workspaces/:id/sessions', createSessionRouter(...))` without changing existing task routes.

- [ ] **Step 5: Run targeted tests**

Run: `npx jest tests/sessions.test.ts tests/brain-agent.test.ts --runInBand`

- [ ] **Step 6: Commit**

```bash
git add src/api src/modules/sessions src/modules/brain tests
git commit -m "feat: add asynchronous live session execution"
```

### Task 4: Add authenticated realtime session control

**Files:**
- Modify: `src/realtime/socket-server.ts`
- Modify: `apps/web/src/lib/socket.ts`
- Create: `tests/session-realtime.test.ts`

**Interfaces:**
- Client events: `session.join`, `session.leave`, `session.request_driver`, `session.approve_driver`, `session.handoff`, `session.redirect`.
- Server events: `session.snapshot`, `session.participant_changed`, `session.driver_changed`, `session.event`, `session.paused`, `session.error`.
- `broadcastSessionEvent(io, sessionId, event)` emits only to `session:<sessionId>` after the service persists it.

- [ ] **Step 1: Write socket authorization tests**

Test authenticated workspace member joins, non-member rejection, observer redirect rejection, Driver redirect acceptance, Admin force redirect, ordered event delivery, and disconnect pause.

- [ ] **Step 2: Implement session room handlers**

Authenticate from the existing token middleware, resolve the socket user only from the token, verify session access through `SessionService`, join the room, and emit a snapshot from persisted state. Do not trust user identity supplied in event payloads.

- [ ] **Step 3: Wire service events**

Use the app-level Socket.IO instance for server-originated broadcasts. Every event payload includes `sessionId`, `type`, `eventId`, and `createdAt`; clients can deduplicate by `eventId`.

- [ ] **Step 4: Run tests**

Run: `npx jest tests/session-realtime.test.ts tests/realtime.test.ts --runInBand`

- [ ] **Step 5: Commit**

```bash
git add src/realtime apps/web/src/lib/socket.ts tests/session-realtime.test.ts
git commit -m "feat: add authenticated live session realtime control"
```

### Task 5: Implement correction distillation and Skill Entry lifecycle

**Files:**
- Create: `src/modules/skills/skill-service.ts`
- Create: `src/modules/skills/skill-distiller.ts`
- Create: `src/api/skills/skill-router.ts`
- Modify: `src/api/app.ts`
- Modify: `src/modules/brain/agent-runner.ts`
- Test: `tests/skills.test.ts`

**Interfaces:**
- `distillRedirect(redirectId: string, reviewerContext?: string): Promise<SkillCandidate>`
- `listSkills(workspaceId: string, status?: SkillStatus): Promise<SkillEntryDto[]>`
- `updateCandidate(workspaceId: string, skillId: string, input: SkillEditInput, userId: string): Promise<SkillEntryDto>`
- `confirmSkill(workspaceId: string, skillId: string, userId: string): Promise<SkillEntryDto>`
- `rejectSkill(workspaceId: string, skillId: string, userId: string): Promise<SkillEntryDto>`
- `supersedeSkill(workspaceId: string, skillId: string, input: SkillEditInput, userId: string): Promise<SkillEntryDto>`
- `retrieveConfirmedSkills(workspaceId: string, query: string, limit?: number): Promise<SkillEntryDto[]>`

- [ ] **Step 1: Write failing Skill Entry tests**

Cover strict candidate shape validation, tentative default status, authorized confirmation, rejection, immutable confirmed versioning, superseding, workspace isolation, and retrieval excluding tentative/rejected entries.

- [ ] **Step 2: Implement schema-validated distillation**

Use the configured AI provider through the existing `AIClient`, request JSON with title, category, rule, rationale, trigger, example, and confidence, validate with Zod, and return an explicit error for malformed output. The distiller receives redirect text plus bounded session evidence; it must not read `.env` or unrelated workspaces.

- [ ] **Step 3: Implement review transitions**

Use transactions for confirm/reject/supersede. Confirmed entries cannot be edited in place; edits create a new entry with `supersedes`. Record `SkillReview` and `AuditLog` data for every review decision.

- [ ] **Step 4: Inject confirmed skills**

Before `AgentRunner` builds its user message, call `retrieveConfirmedSkills` using the task prompt and add a clearly delimited `CONFIRMED COMPANY SKILLS` block. Emit `SKILLS_APPLIED` with skill IDs and titles.

- [ ] **Step 5: Add REST routes and tests**

Mount `/api/workspaces/:id/skills`, enforce viewer/member/admin roles for list, edit, and review operations, and run:

`npx jest tests/skills.test.ts tests/brain-agent.test.ts --runInBand`

- [ ] **Step 6: Commit**

```bash
git add src/modules/skills src/api/skills src/api/app.ts src/modules/brain tests
git commit -m "feat: turn corrections into confirmed company skills"
```

### Task 6: Build the core product UI

**Files:**
- Modify: `apps/web/src/lib/api-client.ts`
- Modify: `apps/web/src/lib/socket.ts`
- Modify: `apps/web/src/components/WorkspaceShell.tsx`
- Create: `apps/web/src/pages/workspace/LiveWork.tsx`
- Create: `apps/web/src/pages/workspace/Session.tsx`
- Create: `apps/web/src/pages/workspace/Corrections.tsx`
- Create: `apps/web/src/components/workspace/SessionTimeline.tsx`
- Create: `apps/web/src/components/workspace/RedirectComposer.tsx`
- Modify: `apps/web/src/pages/workspace/Home.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/frontend.test.ts`

**Interfaces:**
- API client methods mirror the session and skill REST endpoints with typed DTOs.
- Session screen consumes `session.snapshot` and `session.event` and renders Driver/Observer state, applied skills, agent step, redirect form, handoff request, pause/error state, and replay timeline.
- Redirect composer disables submission for observers and displays the explicit Admin force-interrupt affordance only when authorized.

- [ ] **Step 1: Add typed client contracts**

Define `LiveSession`, `SessionParticipant`, `SessionEvent`, `SkillEntry`, and `SkillCandidate` interfaces. Add methods for create/start/get/list sessions, join/request/approve/handoff/redirect, replay, and skill review.

- [ ] **Step 2: Write frontend route and behavior tests**

Test the session route renders a Driver redirect composer, an Observer sees request-control instead, timeline events append by event ID, and confirmed skills display their source session.

- [ ] **Step 3: Implement session timeline and redirect composer**

Use existing design tokens and dark editorial styling. Show human-readable event labels, actor identity, timestamps, current agent step, evidence links, and explicit loading/error/paused states. Never show raw secrets or untrusted HTML.

- [ ] **Step 4: Implement Live Work and Corrections**

Live Work prioritizes active sessions and knowledge-compounding counts. Corrections lists tentative entries with source correction, rule preview, author, and confirm/reject/edit actions.

- [ ] **Step 5: Update navigation and routes**

Make `Live Work`, `Brain`, `Corrections`, `Connections`, and `People` the primary labels while preserving existing routes. Keep Software and advanced surfaces available but secondary.

- [ ] **Step 6: Run frontend validation**

Run: `npx jest tests/frontend.test.ts --runInBand`

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add apps/web/src tests/frontend.test.ts
git commit -m "feat: add live work and skill review experiences"
```

### Task 7: Add end-to-end core-loop verification

**Files:**
- Create: `tests/core-loop.test.ts`
- Modify: `tests/test-utils.ts` only if a reusable authenticated two-user/session fixture is required.
- Modify: `README.md`

**Interfaces:**
- The test creates two users in one workspace, starts a session, joins the second user as Observer, verifies Driver-only redirect authorization, records a redirect, distills and confirms a Skill Entry, starts a second session, and verifies `SKILLS_APPLIED`.

- [ ] **Step 1: Write the failing integration test**

Use mocked AI responses and the real Prisma test database. Assert the exact state transitions and event types:

```ts
expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
  'SESSION_STARTED',
  'REDIRECT_SUBMITTED',
  'CORRECTION_CAPTURED',
  'SKILL_PROPOSED',
  'SKILL_CONFIRMED',
  'SKILLS_APPLIED',
]));
```

- [ ] **Step 2: Implement any narrow integration fixes**

Only fix defects surfaced by this test; do not bypass authorization or replace the persisted flow with test-only mocks.

- [ ] **Step 3: Run the full targeted suite**

Run: `npx jest tests/core-loop.test.ts tests/sessions.test.ts tests/skills.test.ts tests/session-realtime.test.ts --runInBand`

- [ ] **Step 4: Update quickstart documentation**

Document how to seed a demo workspace, open two browsers, start a live session, redirect the agent, confirm the proposed skill, and verify reuse. Do not document real secrets.

- [ ] **Step 5: Commit**

```bash
git add tests/core-loop.test.ts tests/test-utils.ts README.md
git commit -m "test: verify correction to reusable skill loop"
```

### Task 8: Harden connectors, operations, and release checks

**Files:**
- Modify: `src/modules/connectors/connector-services.ts`
- Modify: `src/api/connectors/connector-router.ts`
- Modify: `src/modules/storage/workspace-archive.ts`
- Modify: `src/middleware/rate-limiter.ts`
- Modify: `src/api/app.ts`
- Modify: `README.md`
- Test: existing connector, abuse-control, archive, and API test files plus `tests/release-readiness.test.ts`

**Interfaces:**
- Connector sync reports source freshness, retryable failure, reconnect-required state, and workspace ownership.
- Session and skill mutation endpoints use existing rate-limiting and audit-log patterns.
- Health output reports database, AI provider configuration state without exposing secrets, and connector worker readiness.

- [ ] **Step 1: Write release-readiness tests**

Assert connector failure visibility, workspace isolation for imported context, rate limits on session creation/redirects, audit records for driver and skill changes, and health response safety.

- [ ] **Step 2: Add explicit connector status and freshness handling**

Persist sync start/end/error state, expose it through the existing connector API, and ensure source citations identify provider and retrieval timestamp where available.

- [ ] **Step 3: Add session/skill abuse controls**

Apply the existing rate limiter to session creation, redirects, distillation, and review endpoints. Return `429` with the repository’s established error shape and record denied attempts where audit patterns require it.

- [ ] **Step 4: Add operational documentation**

Document deployment environment variables by name only, database migration/generation, worker/process expectations, backup/restore boundaries, and the deliberate non-goals for the first release.

- [ ] **Step 5: Run release validation**

Run: `npx jest tests/release-readiness.test.ts tests/pillar3-abuse-controls.test.ts tests/drive-connector.test.ts tests/jira-integration.test.ts tests/slack-integration.test.ts tests/s3-archive.test.ts --runInBand`

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add src tests README.md
git commit -m "feat: harden connected context and release operations"
```

## Post-MVP plans

The following are deliberately separate plans after the core loop is shipped and validated:

1. Billing, metering, plan limits, and customer self-service.
2. SSO/SAML, SCIM provisioning, retention policies, and compliance evidence.
3. Container provisioning and multi-workbench infrastructure isolation.
4. Additional provider/connector adapters and source-level permission mapping.
5. CRDT-style simultaneous editing and broader autonomous write actions.

## Verification checklist

After all tasks:

- [ ] `npx prisma generate` succeeds.
- [ ] `npx tsc --noEmit` succeeds.
- [ ] `npm run build` succeeds.
- [ ] Focused session, skill, realtime, and core-loop tests pass.
- [ ] Existing regression tests pass.
- [ ] Two browsers can complete the demo without refreshing.
- [ ] A Driver disconnect pauses the session and does not auto-promote an Observer.
- [ ] A confirmed Skill Entry is visibly applied in a later session.
- [ ] No `.env` content was read, changed, or committed.

