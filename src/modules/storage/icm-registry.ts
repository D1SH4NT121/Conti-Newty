import { WorkspaceStorage } from './workspace-storage';
import { ICM_TEMPLATE_FILES, IcmFileDefinition, seedWorkspaceIcmTemplate } from './icm-templates';

export interface IcmTemplateDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  files: IcmFileDefinition[];
}

// Re-export the file interface
export { IcmFileDefinition };

// --------------- Template: Founder ICM (original) ---------------
const FOUNDER_TEMPLATE: IcmTemplateDefinition = {
  id: 'founder',
  name: 'Founder ICM',
  description: 'Complete institutional knowledge base for early-stage companies. Includes company overview, fundraising, SOPs, project reviews, and AI query harness.',
  version: '1.0.0',
  files: ICM_TEMPLATE_FILES
};

// --------------- Template: Agency Client ---------------
const AGENCY_TEMPLATE: IcmTemplateDefinition = {
  id: 'agency-client',
  name: 'Agency Client Workbench',
  description: 'Pre-structured workspace for agencies managing external client engagements. Includes client onboarding SOP, deliverable tracking, and anonymization guidelines.',
  version: '1.0.0',
  files: [
    {
      path: 'prompts/query_harness.md',
      content: `# Agency Client Query Harness

You are the Company Brain agent for this client workspace.
1. Navigate \`deliverables/\`, \`contracts/\`, \`meeting-notes/\`, and \`sops/\`.
2. Answer questions with grounded citations: \`[source: path:lines]\`.
3. When asked about sensitive client data, flag that anonymization may be needed before external sharing.
`
    },
    {
      path: 'sops/client-onboarding.md',
      content: `# SOP: Client Onboarding

1. Create client workspace under agency organization.
2. Upload initial document set (contracts, briefs, brand guidelines).
3. Set \`contracts/\` directory as **read-only** for non-admin members.
4. Invite client stakeholders with \`viewer\` role.
5. Run verification query: "Summarize contract deliverables and milestones."
`
    },
    {
      path: 'sops/anonymization-guidelines.md',
      content: `# SOP: Data Anonymization Before External Sharing

1. Run anonymization on any file before sending to external parties.
2. Scrub: client names, financial figures, API keys, emails, phone numbers.
3. Review output before sharing — AI anonymization is a safety net, not a guarantee.
4. Log anonymized exports in \`activity/export-log.md\`.
`
    },
    {
      path: 'deliverables/README.md',
      content: `# Deliverables

Track all client deliverables in this directory.
Each deliverable should be a markdown file with:
- **Status**: Draft | In Review | Approved | Delivered
- **Due Date**: YYYY-MM-DD
- **Owner**: Team member name
`
    },
    {
      path: 'contracts/README.md',
      content: `# Contracts (Read-Only)

Store signed contracts and amendments here.
This directory should be marked read-only for non-admin users via workspace settings.
`
    },
    {
      path: 'meeting-notes/README.md',
      content: `# Meeting Notes

Store meeting transcripts and action items here.
Format: \`YYYY-MM-DD-topic.md\`
`
    }
  ]
};

// --------------- Template: Operations Playbook ---------------
const OPS_TEMPLATE: IcmTemplateDefinition = {
  id: 'operations-playbook',
  name: 'Operations Playbook',
  description: 'Structured operational workspace for teams managing logistics, field operations, and incident response. Includes escalation SOPs, shift handoff templates, and telemetry guides.',
  version: '1.0.0',
  files: [
    {
      path: 'prompts/query_harness.md',
      content: `# Operations Query Harness

You are the operational intelligence agent for this workspace.
1. Navigate \`sops/\`, \`incidents/\`, \`shifts/\`, and \`runbooks/\`.
2. Answer operational questions with line-grounded citations.
3. For incident queries, always check \`incidents/\` first.
`
    },
    {
      path: 'sops/incident-response.md',
      content: `# SOP: Incident Response

## Severity Levels
- **P0 (Critical)**: Customer-facing outage. Respond within 15 minutes. Page on-call lead.
- **P1 (High)**: Degraded service. Respond within 1 hour.
- **P2 (Medium)**: Internal issue. Respond within 4 hours.
- **P3 (Low)**: Cosmetic or non-urgent. Respond within 24 hours.

## Escalation Chain
1. L1 On-Call Engineer acknowledges alert.
2. If unresolved in SLA window, escalate to L2 Lead.
3. If still unresolved, escalate to Engineering Director (P0 only).

## Post-Incident
- Write post-mortem in \`incidents/YYYY-MM-DD-title.md\`.
- Identify root cause, timeline, and action items.
`
    },
    {
      path: 'sops/shift-handoff.md',
      content: `# SOP: Shift Handoff

1. Outgoing shift documents:
   - Active incidents and their status
   - Pending deployments or maintenance windows
   - Any customer escalations in progress
2. File handoff notes in \`shifts/YYYY-MM-DD-shift.md\`.
3. Incoming shift acknowledges receipt in Slack channel.
`
    },
    {
      path: 'runbooks/health-check.md',
      content: `# Runbook: System Health Check

1. Verify all API endpoints return HTTP 200.
2. Check database connection pool utilization (< 80%).
3. Review error rate dashboard (< 0.1% 5xx).
4. Confirm scheduled jobs ran successfully.
5. Log results in \`shifts/\` handoff notes.
`
    },
    {
      path: 'incidents/README.md',
      content: `# Incidents

Store post-mortem documents here.
Format: \`YYYY-MM-DD-incident-title.md\`

Each post-mortem should include:
- Timeline of events
- Root cause analysis
- Action items with owners and due dates
`
    },
    {
      path: 'shifts/README.md',
      content: `# Shift Handoff Notes

Format: \`YYYY-MM-DD-shift.md\`
`
    }
  ]
};

// --------------- Template: Minimal / Blank ---------------
const MINIMAL_TEMPLATE: IcmTemplateDefinition = {
  id: 'minimal',
  name: 'Minimal Workspace',
  description: 'A clean workspace with just the AI query harness. Add your own structure.',
  version: '1.0.0',
  files: [
    {
      path: 'prompts/query_harness.md',
      content: `# AI Query Harness

You are the Company Brain agent for this workspace.
Navigate the folder hierarchy to answer questions with cited sources.
Use the syntax: \`[source: path/to/file:lineStart-lineEnd]\`
`
    },
    {
      path: 'docs/README.md',
      content: `# Documents

Add your documents, knowledge files, and notes to this workspace.
The AI agent will navigate this folder structure to answer questions.
`
    }
  ]
};

// --------------- Registry ---------------
export const ICM_TEMPLATE_REGISTRY: IcmTemplateDefinition[] = [
  FOUNDER_TEMPLATE,
  AGENCY_TEMPLATE,
  OPS_TEMPLATE,
  MINIMAL_TEMPLATE
];

export async function seedIcmTemplateById(
  storage: WorkspaceStorage,
  templateId: string
): Promise<string[] | null> {
  // Backward compat: 'icm' maps to founder
  const id = templateId === 'icm' ? 'founder' : templateId;
  const tpl = ICM_TEMPLATE_REGISTRY.find(t => t.id === id);
  if (!tpl) return null;

  const createdFiles: string[] = [];
  for (const item of tpl.files) {
    await storage.writeFile(item.path, item.content);
    createdFiles.push(item.path);
  }
  return createdFiles;
}
