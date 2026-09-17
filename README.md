# Conti-Newty Workbench

> **AI Workspace for Knowledge, Collaboration & Small Software**  
> Company Brain • Multiplayer AI • Small Software Cloud

---

## 🌟 Key Capabilities

### 1. 🧠 Company Brain
- **Workspace-Scoped Secure Storage**: Strict path-traversal rejection and configurable read-only path rules.
- **AI Agent Harness & Tools**: Autonomous execution of `list_directory`, `read_file`, `write_file`, `create_file`, and `search_files`.
- **Source Grounding**: Clickable citations `[source: path/file:lines]` referencing exact workspace documents for explainability and truthfulness.

### 2. 👥 Multiplayer AI
- **Real-Time WebSockets**: Live presence badges, active typing indicators, and file viewing indicators.
- **Multi-threaded Conversations**: Collaboration threads organized by topics and projects.
- **Human-in-the-Loop Change Review**: Server-side proposal, unified line diff inspection, and review approvals before disk mutation.

### 3. ⚡ Small Software Cloud
- **Context-Aware App Generation**: Transform workspace documents and JSON datasets into functional interactive applications (Dashboards, Knowledge Portals, Forms).
- **Isolated Sandbox Execution**: Ephemeral sandbox instances serving live HTTP requests safely.
- **Security Validation**: Pre-deployment AST & regex security scan preventing shell command execution or environment exfiltration.

---

## 🏗️ Architecture & Modules

```text
src/
├── api/                 # REST API Routers (Auth, Workspaces, Files, Threads, Tasks, Changes, Apps, Orgs)
├── modules/
│   ├── brain/           # AI Agent runner, Brain tools, Source grounding & Anthropic client
│   ├── storage/         # Workspace storage with path-traversal prevention & read-only enforcement
│   ├── auth/            # JWT auth, password hashing, and Tool Execution Authorization Guard (RBAC)
│   ├── changes/         # Change proposal, diff computation, and approval/rejection engine
│   └── app-generator/   # App templates, security validator, and Sandbox Runner
├── realtime/            # Socket.io server, presence manager, and event broadcaster
├── middleware/          # Express auth & workspace role validation middleware
├── db/                  # Prisma client singleton and seed scripts
└── server.ts            # Server bootstrap (HTTP + WebSockets)
```

---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+ LTS
- SQLite (default) or PostgreSQL

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Migration & Demo Seed
```bash
npx prisma migrate dev
npx ts-node scripts/demo-seed.ts
```

### 3. Run Development Server
```bash
npm run dev
```
Open **`http://localhost:3000`** in your browser.

### 4. Run Test Suite
```bash
npm test
```

---

## 🔐 Security & Authorization Chain

Every AI tool execution follows strict server-side evaluation:
```text
Human Identity → Workspace Permissions → Thread/Task Context → Requested Tool → Target Resource → Allow / Deny
```

- **Viewer Role**: Read-only tools only (`read_file`, `list_directory`, `search_files`).
- **Member Role**: Read & write tools on permitted paths.
- **Admin Role**: Full management, read-only path configuration, and destructive operations.

---

## 📡 REST API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/login` | `POST` | User authentication & JWT issuance |
| `/api/auth/register` | `POST` | User registration |
| `/api/auth/me` | `GET` | Current user profile |
| `/api/workspaces` | `GET`, `POST` | List and create workspaces |
| `/api/workspaces/:id/files/*` | `GET`, `PUT`, `DELETE` | Workspace file operations |
| `/api/workspaces/:id/threads` | `GET`, `POST` | Conversation threads |
| `/api/workspaces/:id/tasks` | `POST`, `GET` | AI agent task execution & history |
| `/api/workspaces/:id/changes` | `GET`, `POST` | Proposed changes & review |
| `/api/workspaces/:id/changes/:id/approve` | `POST` | Approve & apply change |
| `/api/workspaces/:id/apps` | `GET`, `POST` | Small Software Cloud generation & deployment |

---

## 📄 License
MIT License
