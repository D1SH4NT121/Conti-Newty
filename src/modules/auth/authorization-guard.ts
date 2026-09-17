import { prisma } from '../../db/client';

export interface ToolAuthContext {
  userId: string;
  workspaceId: string;
  toolName: string;
  resourcePath?: string;
  taskId?: string;
  executionReason?: string;
}

export interface ToolAuthResult {
  allowed: boolean;
  reason?: string;
  memberRole?: string;
}

const READ_TOOLS = new Set([
  'read',
  'read_file',
  'ls',
  'list_directory',
  'grep',
  'glob',
  'search_files',
  'get_change',
  'list_changes'
]);

const WRITE_TOOLS = new Set([
  'write',
  'write_file',
  'create_file',
  'delete',
  'delete_file',
  'edit',
  'propose_change',
  'approve_change',
  'reject_change'
]);

const ADMIN_TOOLS = new Set([
  'bash',
  'powerShell',
  'system_exec',
  'deploy_app',
  'delete_workspace',
  'manage_members'
]);

function globToRegex(pattern: string): RegExp {
  const normalized = pattern.replace(/\\/g, '/');
  let regexStr = '^';
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i];
    if (char === '*' && normalized[i + 1] === '*') {
      if (normalized[i + 2] === '/') {
        regexStr += '(?:.*/)?';
        i += 3;
      } else {
        regexStr += '.*';
        i += 2;
      }
    } else if (char === '*') {
      regexStr += '[^/]*';
      i += 1;
    } else if (char === '?') {
      regexStr += '[^/]';
      i += 1;
    } else if (['.', '+', '^', '$', '(', ')', '[', ']', '{', '}', '|', '\\'].includes(char)) {
      regexStr += '\\' + char;
      i += 1;
    } else {
      regexStr += char;
      i += 1;
    }
  }
  regexStr += '$';
  return new RegExp(regexStr);
}

export class AuthorizationGuard {
  public async evaluateToolAuthorization(
    context: ToolAuthContext
  ): Promise<ToolAuthResult> {
    const { userId, workspaceId, toolName, resourcePath } = context;

    // 1. Fetch Workspace Membership
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          workspaceId,
          userId
        }
      }
    });

    if (!membership) {
      return {
        allowed: false,
        reason: 'User is not a member of this workspace'
      };
    }

    const role = membership.role.toLowerCase();

    // 2. Viewer role restrictions
    if (role === 'viewer') {
      if (!READ_TOOLS.has(toolName)) {
        return {
          allowed: false,
          reason: `Insufficient role: viewer cannot execute modifying tool "${toolName}"`,
          memberRole: role
        };
      }
    }

    // 3. Admin-only tool restrictions
    if (ADMIN_TOOLS.has(toolName) && role !== 'admin') {
      return {
        allowed: false,
        reason: `Insufficient role: only workspace admins can execute "${toolName}"`,
        memberRole: role
      };
    }

    // 4. Restricted resource read protection (e.g., salary, credentials, secrets, confidential)
    if (resourcePath && READ_TOOLS.has(toolName) && role !== 'admin') {
      const normalizedResource = resourcePath.replace(/\\/g, '/').toLowerCase();
      const isRestricted = 
        normalizedResource.includes('salary') ||
        normalizedResource.includes('confidential') ||
        normalizedResource.includes('.env') ||
        normalizedResource.startsWith('restricted/') ||
        normalizedResource.startsWith('secrets/');

      if (isRestricted) {
        return {
          allowed: false,
          reason: `Insufficient role: '${role}' cannot access restricted resource "${resourcePath}"`,
          memberRole: role
        };
      }
    }

    // 5. Resource path read-only checks for write operations
    if (resourcePath && (WRITE_TOOLS.has(toolName) || !READ_TOOLS.has(toolName))) {
      const readOnlyRules = await prisma.readOnlyPath.findMany({
        where: { workspaceId }
      });

      const normalizedResource = resourcePath.replace(/\\/g, '/');
      for (const rule of readOnlyRules) {
        const regex = globToRegex(rule.path);
        if (regex.test(normalizedResource)) {
          return {
            allowed: false,
            reason: `Resource path "${resourcePath}" is configured as read-only`,
            memberRole: role
          };
        }
      }
    }

    return {
      allowed: true,
      memberRole: role
    };
  }

  public async logToolExecution(params: {
    userId: string;
    workspaceId: string;
    toolName: string;
    taskId?: string;
    input?: any;
    output?: any;
    status: 'SUCCESS' | 'FAILURE' | string;
    allowed: boolean;
  }) {
    return prisma.toolExecution.create({
      data: {
        userId: params.userId,
        workspaceId: params.workspaceId,
        toolName: params.toolName,
        input: JSON.stringify(params.input || {}),
        result: params.output ? JSON.stringify(params.output) : null,
        status: params.status,
        allowed: params.allowed,
        agentTaskId: params.taskId || null
      }
    });
  }
}
