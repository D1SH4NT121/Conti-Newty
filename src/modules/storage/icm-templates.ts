import { WorkspaceStorage } from './workspace-storage';

export interface IcmFileDefinition {
  path: string;
  content: string;
}

export const ICM_TEMPLATE_FILES: IcmFileDefinition[] = [
  {
    path: 'prompts/query_harness.md',
    content: `# ICM AI Query & Navigation Harness

You are the central Company Brain agent for this workspace.
Your role is to navigate the folder hierarchy directly:
1. Examine \`docs/\`, \`sops/\`, \`notes/\`, and \`prompts/\`.
2. Retrieve grounded evidence from relevant markdown files.
3. Provide concise, bulleted answers citing exact sources using the syntax:
   \`[source: relative/path/to/file:line_or_range]\`
4. If asked to summarize or answer questions, maintain strict accuracy and trace every claim back to workspace files.
`
  },
  {
    path: 'prompts/summarizer.md',
    content: `# ICM Executive Summarizer Prompt

When creating executive briefings or external updates:
- Highlight key metrics, blockers, and recent decisions.
- Never speculate outside of files found in this workspace.
- Provide source citations for every section.
`
  },
  {
    path: 'docs/company_overview.md',
    content: `# Company Overview & Strategy

## Mission
To transform organizational knowledge into a live, multiplayer Company Brain powered by single-agent navigation over structured folder hierarchies (ICM method).

## Core Principles
1. **Zero Integration Friction**: Turn folders of markdown directly into queryable intelligence.
2. **Multiplayer by Default**: Real-time collaborative querying, editing, and change proposals.
3. **Containerized Security**: Complete workspace isolation without sharing data across boundaries.
`
  },
  {
    path: 'docs/fundraising_status.md',
    content: `# Fundraising & Financial Status

## Current Round: Seed Extension
- **Target**: $2.5M at a $25M post-money valuation cap.
- **Committed**: $1.8M led by Pioneer Ventures and angel operators.
- **Runway**: 18 months at current burn rate ($65k/month).
- **Milestones Achieved**: Full multiplayer workbench release, 45 active agency deployments, 98% positive citation accuracy.
`
  },
  {
    path: 'docs/chicago_project_review.md',
    content: `# Chicago Enterprise Pilot Review

## Pilot Summary (Chicago Operations)
- **Partner**: Midwest Logistics Syndicate (Chicago, IL).
- **Scope**: Deploy isolated Company Brain containers across 12 depot operations.
- **Outcomes**:
  - Replaced 40-page PDF binders with queryable ICM folders.
  - Reduced dispatcher lookup time from 14 minutes to 18 seconds.
  - Successfully tested offline-capable container deployments on depot ruggedized hardware.
- **Key Takeaway**: Operational dispatchers preferred natural language search with clickable file citations over complex multi-agent dashboards.
`
  },
  {
    path: 'sops/client_onboarding.md',
    content: `# SOP: Client Workbench Onboarding

1. **Workspace Initialization**:
   - Create client organization workbench under agency umbrella.
   - Choose ICM template or upload client document zip archive.
2. **Permission Boundary Setup**:
   - Add client stakeholders with \`viewer\` or \`member\` roles.
   - Mark core contract directories as \`read-only\` via workspace settings.
3. **Knowledge Ingestion Verification**:
   - Verify all SOPs, meeting transcripts, and project specs render cleanly.
   - Run verification query: "Summarize client deliverables and current milestones".
`
  },
  {
    path: 'sops/production_deployment.md',
    content: `# SOP: Production Deployment & Verification

1. **Pre-flight Checks**:
   - Run automated test suite (\`npm test\`).
   - Confirm all Prisma migrations and security sandbox boundaries are intact.
2. **Container Build & Verification**:
   - Build container image and verify health check endpoints respond with HTTP 200.
   - Ensure file-system sandbox rejects path traversal attempts.
3. **Human-in-the-Loop Review**:
   - Sensitive file mutations must pass through the Change Review approval engine.
`
  },
  {
    path: 'notes/high_tea_sessions.md',
    content: `# High Tea Cohort Session Notes

## Session #12: ICM Adoption & Practical Workflows
- **Host**: Founder & Community Leads
- **Discussion Points**:
  - Why multi-agent frameworks often fail in production: high latency, brittle handoffs, and debugging friction.
  - The power of single-agent folder navigation: predictable reasoning, easy versioning in git, and zero complex graph configuration.
  - Cohort members demonstrated querying meeting transcripts with instant citation drill-downs.
- **Action Items**:
  - Add auto-anonymization feature for agencies sharing client transcripts.
  - Support one-click ZIP download of entire workbenches for offline compliance.
`
  },
  {
    path: 'notes/weekly_sync.md',
    content: `# Weekly Engineering & Product Sync

## Status Update
- **Company Brain**: Source grounding and search tools are performing with <200ms index lookups.
- **Multiplayer Collaboration**: WebSockets support concurrent sessions, active typing, and live presence.
- **Next Priorities**:
  - Multi-provider model support (Claude, Gemini CLI, Codex).
  - Bulk organization invites for agency client rollouts.
`
  }
];

/**
 * Seeds an isolated workspace with the standard ICM folder structure.
 */
export async function seedWorkspaceIcmTemplate(storage: WorkspaceStorage): Promise<string[]> {
  const createdFiles: string[] = [];

  for (const item of ICM_TEMPLATE_FILES) {
    await storage.writeFile(item.path, item.content);
    createdFiles.push(item.path);
  }

  return createdFiles;
}
