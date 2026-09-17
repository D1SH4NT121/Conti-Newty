# Workbench Implementation Design

**Date**: 2026-09-11  
**Based on**: Workbench PRD v4.0 (Final Merge)  
**Scope**: Full vision implementation  
**Technology Stack**: Node.js/TypeScript  
**Purpose**: Internal team collaboration tool  

## 1. Overall System Architecture

### 1.1 Architectural Approach: Modular Monolith

We will implement the Workbench as a **modular monolith** using Node.js and TypeScript. This approach provides:

- **Development simplicity**: Single codebase, easier debugging and testing
- **Deployment simplicity**: Single deployable unit
- **Clear module boundaries**: Well-defined interfaces between components
- **Performance**: No network latency between modules
- **Scalability**: Can be scaled vertically initially, with path to horizontal scaling

### 1.2 Module Structure

```
src/
├── api/                 # REST API routes
│   ├── workspaces/
│   ├── threads/
│   ├── messages/
│   ├── files/
│   ├── tasks/
│   ├── changes/
│   └── apps/
├── modules/             # Core business logic modules
│   ├── brain/           # Company Brain functionality
│   ├── multiplayer/     # Real-time collaboration
│   ├── app-generator/   # Small Software Cloud
│   ├── auth/            # Authentication and authorization
│   └── storage/         # File storage abstraction
├── realtime/            # WebSocket handling
├── middleware/          # Express middleware
├── utils/               # Shared utilities
├── types/               # TypeScript type definitions
└── config/              # Configuration files
```

### 1.3 Technology Choices

- **Runtime**: Node.js 18.x LTS
- **Language**: TypeScript 5.x
- **Framework**: Express.js (for REST API) + Socket.io (for WebSockets)
- **Database**: PostgreSQL with Prisma ORM
- **File System**: Local workspace-scoped storage (MVP), with abstraction layer for future cloud storage
- **AI Provider**: Anthropic Claude API (via official SDK)
- **Real-time**: Socket.io for bidirectional communication
- **Validation**: Zod for request validation
- **Testing**: Jest + Supertest for API tests

## 2. Workbench Core Components

### 2.1 Company Brain Module

The Brain module handles knowledge understanding and AI-assisted file operations.

#### 2.1.1 Core Features

- **File Management**: Upload, read, edit, delete files within workspace boundaries
- **AI Chat Interface**: Conversational interface with source-grounded responses
- **Document Understanding**: AI can read, search, summarize, and compare documents
- **Change Proposals**: AI can suggest file edits for review and approval
- **Source Grounding**: All AI responses include citations to source files

#### 2.1.2 Technical Implementation

- **File Operations**: Secure file system access with path validation
  - All paths resolved against workspace root
  - Prevention of path traversal attacks
  - Read-only path enforcement
- **AI Integration**: 
  - Anthropic Claude SDK for message processing
  - Tool use for file operations (list_directory, read_file, write_file, etc.)
  - Streaming responses for better UX
- **Search**: Full-text search using database capabilities or dedicated search engine
- **Context Management**: Maintain workspace context for AI conversations

#### 2.1.3 Security & Permissions

- **Workspace Isolation**: Each workspace has isolated storage
- **Path Validation**: Server-side validation that all file operations stay within workspace bounds
- **Authorization Chain**: Every tool execution checks:
  ```
  Human identity → Workspace permissions → Thread/task context
  → Requested tool → Target resource → Allow/Deny
  ```
- **Read-only Paths**: Configurable read-only paths that prevent AI modifications

### 2.2 Multiplayer AI Module

Handles real-time collaboration between humans and AI.

#### 2.2.1 Core Features

- **Real-time Synchronization**: Instant updates for file changes, AI responses, and user presence
- **Multi-threaded Conversations**: Separate threads for different topics within a workspace
- **Human-in-the-loop Approval**: Proposed changes require explicit approval
- **Activity Presence**: See what others are viewing or drafting
- **Shared Decision Log**: Reference decisions made in other threads
- **@mention-to-summon**: Pull files, threads, or users into current conversation
- **Session Replay**: New users can view workspace history

#### 2.2.2 Technical Implementation

- **WebSocket Layer**: Socket.io for real-time bidirectional communication
  - Rooms: Each workspace is a Socket.io room
  - Events: Fine-grained events for different update types
  - Message buffering: For users joining mid-conversation
- **Operational Transform**: For collaborative text editing (if implementing rich text)
- **Conflict Resolution**: Last-write-wins for file edits with visual indicators
- **Approval Workflow**: 
  - AI proposes changes via tool use
  - Changes stored as pending proposals
  - UI shows diff with approve/reject buttons
  - Server-side validation of approvals
- **Presence Tracking**: 
  - User activity events (viewing files, typing, etc.)
  - Intent signaling (what user is about to do)
  - Turn-taking awareness

#### 2.2.3 User Experience Features

- **Activity Stream**: Real-time feed of workspace activity
- **Typing Indicators**: Show when others are composing messages
- **Read Receipts**: Indicate who has seen messages
- **Version History**: File change history with ability to revert
- **Offline Support**: Queue local changes when disconnected

### 2.3 App Generation Module (Small Software Cloud)

Turns workspace knowledge into deployable applications.

#### 2.3.1 Core Features

- **App Generation**: Generate applications from workspace files and conversations
- **Multiple App Types**: Support for HTML/JS apps, dashboards, forms, trackers, workflow tools
- **Secure Deployment**: Isolated execution environments for generated apps
- **Access Control**: Link-based or organization-only access
- **Provenance Tracking**: Trace app behavior back to source knowledge
- **Feedback Loop** (v2): App usage informs Brain updates

#### 2.3.2 Technical Implementation

- **Code Generation Pipeline**:
  1. **Requirements Extraction**: AI analyzes workspace to understand app needs
  2. **Code Generation**: AI generates application code using predefined templates
  3. **Validation**: Automated testing and security scanning
  4. **Deployment**: Deploy to isolated sandbox environment
  5. **Access Provisioning**: Generate unique URLs and access rules

- **Sandbox Architecture**:
  - **Isolation**: Each app runs in its own container/microVM
  - **Resource Limits**: CPU, memory, and process restrictions
  - **Network Controls**: Egress filtering, no inter-app communication
  - **Filesystem**: Read-only app code, isolated writable storage
  - **Execution Timeout**: Automatic termination of long-running processes
  - **Secure Destroy**: Complete cleanup of sandbox resources

- **Supported App Types (MVP)**:
  - Static HTML/CSS/JS applications
  - React applications (via create-react-app template)
  - Node.js/Express APIs
  - Python/Flask applications (for data processing)
  - Dashboard applications (using charting libraries)

- **Security Measures**:
  - **Input Sanitization**: Prevent XSS and injection attacks
  - **Dependency Scanning**: Check for known vulnerabilities
  - **Behavioral Analysis**: Detect obvious abuse patterns
  - **Rate Limiting**: Prevent abuse of app creation and execution
  - **Kill Switch**: Immediate termination of malicious apps

#### 2.3.2 Provenance & Traceability

- **Source Mapping**: Track which workspace files influenced each app feature
- **Version Control**: Maintain history of app generations from same workspace
- **Explainability**: Ability to answer "Why does the app behave this way?" by tracing to source documents
- **Update Tracking**: When source knowledge changes, flag dependent apps for review

## 3. Data Model

Based on the PRD Prisma schema with adjustments for modular implementation:

### 3.1 Core Models

- **Organization**: Top-level container for users and workspaces
- **Workspace**: Contains files, threads, members, and optional app
- **Thread**: Conversation threads within a workspace
- **Message**: Individual messages in threads (user, assistant, tool)
- **AgentTask**: Long-running AI tasks with event tracking
- **ToolExecution**: Auditable log of all tool executions with user identity
- **AppWorkspace**: Deployment metadata for generated applications
- **AppDeployment**: Version history of deployed apps
- **UsageLog**: Token usage tracking for cost management
- **AuditLog**: Security and administrative action logging

### 3.2 Key Relationships

- Organization 1:N Membership N:1 User
- Organization 1:N Workspace
- Workspace 1:N Thread
- Thread 1:N Message
- Workspace 1:N AgentTask
- AgentTask 1:N AgentEvent
- AgentTask 0:1 ToolExecution (optional)
- Workspace 0:1 AppWorkspace
- AppWorkspace 1:N AppDeployment
- AppWorkspace 0:N AppAccess

## 4. API Design

### 4.1 REST API Endpoints

#### Workspace Management
- POST `/api/workspaces` - Create new workspace
- GET `/api/workspaces/:id` - Get workspace details
- DELETE `/api/workspaces/:id` - Delete workspace
- GET `/api/workspaces/:id/members` - List workspace members
- POST `/api/workspaces/:id/members/invite` - Invite user to workspace

#### File Operations
- GET `/api/workspaces/:id/files/*` - Read file or directory listing
- PUT `/api/workspaces/:id/files/*` - Create or update file
- DELETE `/api/workspaces/:id/files/*` - Delete file

#### Threads & Messages
- POST `/api/workspaces/:id/threads` - Create new thread
- GET `/api/workspaces/:id/threads` - List threads
- GET `/api/workspaces/:id/threads/:threadId/messages` - Get thread messages
- POST `/api/workspaces/:id/threads/:threadId/messages` - Send message

#### Agent Tasks
- POST `/api/workspaces/:id/tasks` - Create AI task
- GET `/api/workspaces/:id/tasks/:taskId` - Get task status
- POST `/api/workspaces/:id/tasks/:taskId/cancel` - Cancel task

#### Change Management
- GET `/api/workspaces/:id/changes/:changeId` - Get proposed changes
- POST `/api/workspaces/:id/changes/:changeId/approve` - Approve changes
- POST `/api/workspaces/:id/changes/:changeId/reject` - Reject changes

#### App Management
- POST `/api/apps` - Generate new app from workspace
- GET `/api/apps/:id` - Get app details
- DELETE `/api/apps/:id` - Delete app
- PATCH `/api/apps/:id/access` - Update app access settings
- POST `/api/apps/:id/deploy` - Deploy or redeploy app

### 4.2 WebSocket Events

- `workspace.join` / `workspace.leave` - User enters/leaves workspace
- `presence.changed` - User activity updates
- `message.created` / `message.chunk` / `message.completed` - AI message streaming
- `agent.status` / `agent.tool.started` / `agent.tool.completed` - AI tool activity
- `file.changed` - File system updates
- `task.created` / `task.updated` / `task.completed` - Task progress
- `app.status.changed` - App deployment status

## 5. Security Considerations

### 5.1 Brain Workspace Security
- **Path Traversal Prevention**: All file paths validated against workspace root
- **Authorization Enforcement**: Server-side checks for every operation
- **Secret Protection**: Never expose API keys or credentials in AI activity stream
- **Audit Logging**: All tool executions logged with requesting user identity
- **Input Validation**: Strict validation of all inputs to prevent injection

### 5.2 App Workspace Security
- **Strong Isolation**: MicroVM or container-based isolation
- **Resource Limits**: Enforced CPU, memory, process, and time limits
- **Network Sandboxing**: Restricted outbound connections, no inter-app communication
- **Filesystem Isolation**: Separate storage per app, no cross-app access
- **Security Scanning**: Automated vulnerability scanning of generated code
- **Rate Limiting**: Limits on app creation and execution to prevent abuse
- **Administrative Controls**: Ability to immediately shut down problematic apps

### 5.3 Data Protection
- **Encryption**: Sensitive data encrypted at rest (API keys, etc.)
- **Access Controls**: Role-based access control throughout
- **Data Isolation**: Workspace-level data isolation
- **Backup & Recovery**: Regular backups with tested restore procedures

## 6. Success Criteria & Metrics

### 6.1 Functional Success Criteria

1. **Brain Functionality**:
   - Users can upload files and ask questions about them
   - AI provides accurate, source-grounded answers
   - AI can propose file changes that users can approve/reject

2. **Multiplayer Functionality**:
   - Multiple users can simultaneously edit files
   - Real-time updates appear for all connected users
   - Approval workflow functions correctly for AI-proposed changes

3. **App Generation**:
   - Users can generate apps from workspace knowledge
   - Generated apps deploy successfully and are accessible
   - Apps operate within secure sandbox restrictions

### 6.2 Performance Metrics

- **Response Time**: AI responses streamed within 5 seconds of request
- **Concurrent Users**: Support 50+ simultaneous users per workspace
- **File Operations**: File reads/writes complete within 200ms
- **App Deployment**: Simple apps deploy within 30 seconds
- **System Uptime**: 99.9% monthly uptime target

### 6.3 Quality Metrics

- **Code Coverage**: >80% unit test coverage for core logic
- **Security**: No critical vulnerabilities in regular scanning
- **Error Rates**: <1% error rate for API requests
- **User Satisfaction**: Target NPS >40 after initial rollout

## 7. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)
- Project setup and configuration
- Database schema and basic API structure
- Authentication and authorization system
- Basic file storage with security validation
- Basic REST API for workspace and file management

### Phase 2: Brain Core (Weeks 4-6)
- AI integration with Anthropic Claude API
- File operation tools (list, read, write, create)
- Basic chat interface with streaming responses
- Source grounding implementation
- Initial security validation and testing

### Phase 3: Multiplayer (Weeks 7-9)
- WebSocket implementation with Socket.io
- Real-time presence and activity tracking
- Thread-based conversation system
- AI tool execution broadcasting
- Basic approval workflow for changes

### Phase 4: App Generation (Weeks 10-12)
- App generation pipeline prototype
- Template-based code generation
- Basic validation and security scanning
- Simple deployment to isolated environments
- Access control for generated apps

### Phase 5: Polish & Integration (Weeks 13-14)
- End-to-end testing of complete workflows
- Performance optimization
- Security hardening and penetration testing
- Documentation and user guide creation
- Beta testing with internal users

## 8. Open Questions & Future Work

### 8.1 Immediate Considerations
- **File Storage Strategy**: Start with local filesystem, plan migration to cloud storage (S3/minio)
- **Search Implementation**: Begin with database full-text search, consider dedicated search engine (Elasticsearch/Meilisearch) for scale
- **AI Model Selection**: Start with Claude 3 Haiku/Sonnet, evaluate newer models as released
- **Template Management**: How to maintain and update app generation templates

### 8.2 Future Enhancements (Post-MVP)
- **App → Brain Feedback Loop**: Analyze app usage to suggest knowledge base improvements
- **Advanced Collaboration**: Real-time collaborative editing (Operational Transforms/CRDTs)
- **AI Model Fine-tuning**: Custom models trained on organization's knowledge
- **Extended App Types**: Support for mobile apps, desktop applications, complex workflows
- **Analytics & Insights**: Usage analytics, token consumption reporting, feature adoption tracking
- **Mobile Applications**: Native iOS/Android apps for Workbench access
- **Offline-first Capabilities**: Full functionality when disconnected from network
- **AI Agent Marketplace**: Share and reuse AI agents across organizations

## 9. Conclusion

This design provides a comprehensive blueprint for implementing the Workbench as described in the PRD. The modular monolith approach balances development simplicity with architectural clarity, allowing us to deliver the full vision while maintaining code quality and system reliability.

The design emphasizes security, proper authorization chains, and traceability—addressing key concerns raised in the PRD about AI permission escalation and sandbox isolation. By following this plan, we can create a powerful internal collaboration tool that enables teams to understand their knowledge, work with AI together, and turn that knowledge into deployable software.

---
*Design completed following superpowers:brainstorming skill guidelines*
*Ready for user review and transition to writing-plans skill*