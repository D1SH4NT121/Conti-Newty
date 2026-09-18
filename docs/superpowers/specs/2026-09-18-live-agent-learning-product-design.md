# Conti-Newty Live Agent Learning Product

## Goal

Turn Conti-Newty from a broad AI workbench into a collaborative learning
workspace where a team guides an agent during real work and the resulting
corrections become reusable company skills.

The defining loop is:

1. An agent works inside a live session.
2. Teammates observe the same session.
3. An authorized participant redirects the agent.
4. The redirect is persisted with its context and outcome.
5. A distillation pass proposes a Skill Entry.
6. An authorized teammate confirms or rejects the proposal.
7. Confirmed skills are retrieved before later agent work.

## Scope and rollout

The full product is delivered in dependency order:

1. Core live-session learning loop.
2. Connector and source-context hardening.
3. Production operations, usage controls, and billing.
4. Enterprise features such as SSO, SCIM, retention, and compliance
   preparation.

The first release is successful when two browsers can participate in one
session, one participant can redirect the agent, the redirect can become a
confirmed Skill Entry, and a later session visibly applies that skill.

## Architecture

### Live Session

`LiveSession` is the primary user-facing object. Existing `AgentTask` and
`AgentEvent` records remain execution details and are associated with a
session.

A session stores its workspace, goal, lifecycle status, current driver,
created-by user, timestamps, and replayable event stream. A
`SessionParticipant` records each user's role and presence. The initial
control model is intentionally simple:

- One Driver can control the agent.
- Observers can watch the session and request control.
- The Driver can hand off control.
- Authorized users can interrupt with a redirect.
- Simultaneous human file editing is deferred.

### Realtime protocol

Socket.IO remains the realtime transport. Session rooms broadcast validated
state changes, including participant changes, driver handoff, agent steps,
evidence, redirects, interruptions, resumes, skill proposals, and completion.

The server is authoritative. Socket events never grant permissions by
themselves; every control operation checks authenticated workspace membership,
session participation, and the required role.

### Interruptible agent execution

Agent execution becomes asynchronous from the HTTP request perspective:
creating a session returns immediately, while the runner emits durable events
and accepts redirects. A redirect can pause the current step, append the
human instruction to the session context, and resume or cancel the step.
Failures, cancellation, and retries are explicit states and events.

## Correction and Skill Entry model

Every redirect records:

- Session and workspace.
- Correcting user.
- Timestamp.
- Human instruction.
- Agent step and relevant evidence.
- Resulting agent state.

A distillation service converts a correction and its surrounding context into a
small candidate Skill Entry containing:

- Stable identifier and title.
- Rule and rationale.
- Trigger/example.
- Correcting author and source session.
- Confidence/status.
- Creation and update timestamps.
- Optional `supersedes` relationship.

New entries begin as `tentative`. Authorized reviewers can edit, confirm, or
reject them. Confirmed entries are immutable versions for audit purposes;
changes create a new version. A contradictory rule supersedes an earlier
entry rather than overwriting it. Runtime retrieval uses confirmed entries
only.

## Runtime skill retrieval

Before an agent begins work, the system retrieves relevant confirmed skills
using workspace and task context. The applied skills are included in the
session context and shown in the UI with links back to their source sessions.
If no relevant skill exists, the agent proceeds without a fabricated rule.

## Product surfaces

### Live Work home

The homepage prioritizes active sessions, current drivers, observers, agent
state, and knowledge-compounding metrics. Files and connectors remain
accessible but are secondary.

### Session control room

The control room shows the session goal, participants, driver state, current
agent step, evidence, applied skills, event timeline, redirect composer, and
handoff controls. It supports loading, paused, failed, and completed states.

### Corrections review

Reviewers see candidate Skill Entries grouped by workspace and source session.
Each proposal provides the raw correction, distilled rule, evidence, author,
and actions to edit, confirm, reject, or supersede.

### Brain and replay

The Brain view separates confirmed skills from ordinary source documents.
Replay presents a chronological session timeline with agent actions,
redirects, evidence, and resulting skills.

### Connections

Drive, Jira, Slack, and Git provide contextual evidence and citations. They
show sync status, freshness, failures, and permission boundaries. They are
not the primary product narrative.

## Authorization and trust

Workspace membership remains the base authorization boundary. Additional
checks govern:

- Joining a session.
- Becoming or replacing the Driver.
- Sending a redirect.
- Confirming or rejecting a Skill Entry.
- Reading source evidence.
- Applying skills to a task.

All state-changing operations produce audit events. No secret is read from or
written to the repository during implementation; local environment values
remain deployment configuration.

## Testing strategy

The implementation must add focused tests for:

- Session creation and participant authorization.
- Driver assignment and handoff races.
- Redirect persistence and idempotency.
- Agent pause/resume behavior.
- Skill distillation validation.
- Confirmation, rejection, and superseding.
- Runtime retrieval restricted to confirmed skills.
- Workspace isolation.
- Socket event ordering and replay reconstruction.
- End-to-end two-browser core-loop behavior.

Existing backend and frontend builds must continue to pass at each phase.

## Explicitly deferred

- CRDT-style simultaneous file editing.
- Automatic Skill Entry confirmation.
- Public app marketplace.
- BYO provider keys and self-hosting.
- Compliance certification.
- Broad autonomous write actions.

