import { prisma } from '../../db/client';
import { WorkspaceStorage } from '../storage/workspace-storage';
import { BrainTools } from '../brain/brain-tools';
import { AgentRunner, AgentConfig } from '../brain/agent-runner';
import { SessionEventType, appendSessionEvent, deserializeEventPayload } from './session-events';
import { recordSessionAudit } from './session-service';
import { config } from '../../config';
import { retrieveConfirmedSkills } from '../skills/skill-service';

export interface PendingRedirect {
  id: string;
  userId: string;
  instruction: string;
  evidence?: string;
  force?: boolean;
}

interface ActiveSessionControl {
  sessionId: string;
  workspaceId: string;
  pendingRedirects: PendingRedirect[];
  isPaused: boolean;
  isCancelled: boolean;
  activePromise?: Promise<void>;
}

export class SessionRunner {
  private static controls = new Map<string, ActiveSessionControl>();

  private static getOrCreateControl(sessionId: string, workspaceId: string): ActiveSessionControl {
    let ctrl = this.controls.get(sessionId);
    if (!ctrl) {
      ctrl = {
        sessionId,
        workspaceId,
        pendingRedirects: [],
        isPaused: false,
        isCancelled: false
      };
      this.controls.set(sessionId, ctrl);
    }
    return ctrl;
  }

  private static async waitWhilePaused(ctrl: ActiveSessionControl): Promise<void> {
    while (ctrl.isPaused && !ctrl.isCancelled) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  public static async submitRedirect(
    arg1: string,
    arg2: string | { userId: string; instruction: string; evidence?: string; force?: boolean },
    arg3?: { userId: string; instruction: string; evidence?: string; force?: boolean }
  ): Promise<{ redirectId: string }> {
    let workspaceId: string;
    let sessionId: string;
    let input: { userId: string; instruction: string; evidence?: string; force?: boolean };

    if (typeof arg2 === 'string') {
      workspaceId = arg1;
      sessionId = arg2;
      input = arg3!;
    } else {
      sessionId = arg1;
      input = arg2;
      const sess = await prisma.liveSession.findUnique({ where: { id: sessionId }, select: { workspaceId: true } });
      workspaceId = sess?.workspaceId || '';
    }

    const ctrl = this.getOrCreateControl(sessionId, workspaceId);

    const redirect = await prisma.agentRedirect.create({
      data: {
        sessionId,
        workspaceId,
        correctedById: input.userId,
        instruction: input.instruction,
        evidence: input.evidence || '',
        context: JSON.stringify({ force: Boolean(input.force) })
      }
    });

    ctrl.pendingRedirects.push({
      id: redirect.id,
      userId: input.userId,
      instruction: input.instruction,
      evidence: input.evidence,
      force: input.force
    });

    await appendSessionEvent({
      sessionId,
      type: SessionEventType.REDIRECT_SUBMITTED,
      actorId: input.userId,
      payload: {
        redirectId: redirect.id,
        instruction: input.instruction,
        evidence: input.evidence,
        force: Boolean(input.force)
      }
    });

    await recordSessionAudit(
      workspaceId,
      input.userId,
      input.force ? 'FORCE_INTERRUPT_SUBMITTED' : 'AGENT_REDIRECT_SUBMITTED',
      { sessionId, redirectId: redirect.id, instruction: input.instruction }
    );

    return { redirectId: redirect.id };
  }

  public static async pause(sessionId: string, userId: string): Promise<void> {
    const ctrl = this.controls.get(sessionId);
    if (ctrl) ctrl.isPaused = true;

    const session = await prisma.liveSession.update({ where: { id: sessionId }, data: { status: 'PAUSED' } });
    await appendSessionEvent({
      sessionId,
      type: SessionEventType.SESSION_PAUSED,
      actorId: userId,
      payload: { reason: 'USER_PAUSED' }
    });

    await recordSessionAudit(session.workspaceId, userId, 'SESSION_PAUSED', { sessionId });
  }

  public static async resume(
    sessionId: string,
    userId: string,
    workspaceId?: string,
    storage?: WorkspaceStorage,
    io?: any
  ): Promise<void> {
    const ctrl = this.controls.get(sessionId);
    if (ctrl) {
      ctrl.isPaused = false;
    } else {
      if (!workspaceId || !storage) {
        throw new Error('Session execution is unavailable; restart the session instead');
      }
      await this.start(sessionId, workspaceId, userId, storage, io);
      return;
    }

    const session = await prisma.liveSession.update({ where: { id: sessionId }, data: { status: 'RUNNING' } });
    await appendSessionEvent({
      sessionId,
      type: SessionEventType.SESSION_RESUMED,
      actorId: userId,
      payload: { resumedBy: userId }
    });

    await recordSessionAudit(session.workspaceId, userId, 'SESSION_RESUMED', { sessionId });
  }

  public static async cancel(sessionId: string, userId: string): Promise<void> {
    const ctrl = this.controls.get(sessionId);
    if (ctrl) {
      ctrl.isCancelled = true;
      ctrl.isPaused = false;
    }

    const session = await prisma.liveSession.update({ where: { id: sessionId }, data: { status: 'CANCELLED' } });
    await appendSessionEvent({
      sessionId,
      type: SessionEventType.SESSION_CANCELLED,
      actorId: userId,
      payload: { cancelledBy: userId }
    });

    await recordSessionAudit(session.workspaceId, userId, 'SESSION_CANCELLED', { sessionId });
  }

  public static async start(
    sessionId: string,
    workspaceId: string,
    userId: string,
    storage: WorkspaceStorage,
    io?: any
  ): Promise<void> {
    const session = await prisma.liveSession.findUnique({
      where: { id: sessionId },
      include: { events: { where: { type: SessionEventType.CREATED }, take: 1 } }
    });
    if (!session) throw new Error(`LiveSession not found: ${sessionId}`);

    const ctrl = this.getOrCreateControl(sessionId, workspaceId);
    ctrl.isPaused = false;
    ctrl.isCancelled = false;

    await prisma.liveSession.update({
      where: { id: sessionId },
      data: { status: 'RUNNING' }
    });

    const startEvent = await appendSessionEvent({
      sessionId,
      type: SessionEventType.SESSION_STARTED,
      actorId: userId,
      payload: { startedAt: new Date().toISOString() }
    });

    if (io) {
      io.to(`session:${sessionId}`).emit('session.event', startEvent);
      io.to(`session:${sessionId}`).emit('session.status_changed', { status: 'RUNNING' });
    }

    // Run asynchronously without blocking the HTTP request
    const executionPromise = this.executeAsync(session, ctrl, storage, io).finally(() => {
      this.controls.delete(sessionId);
    });
    ctrl.activePromise = executionPromise;
  }

  public static async waitForExecution(sessionId: string): Promise<void> {
    const ctrl = this.controls.get(sessionId);
    if (ctrl?.activePromise) {
      await ctrl.activePromise;
    }
  }

  private static async executeAsync(
    session: any,
    ctrl: ActiveSessionControl,
    storage: WorkspaceStorage,
    io?: any
  ): Promise<void> {
    const sessionId = session.id;
    const workspaceId = session.workspaceId;

    try {
      // Create or locate associated AgentTask
      let task = await prisma.agentTask.findFirst({
        where: { sessionId }
      });
      if (!task) {
        task = await prisma.agentTask.create({
          data: {
            title: session.title,
            description: session.goal,
            status: 'RUNNING',
            workspaceId,
            createdById: session.createdById,
            sessionId
          }
        });
      } else {
        await prisma.agentTask.update({
          where: { id: task.id },
          data: { status: 'RUNNING' }
        });
      }

      // Extract agents from created event payload if available
      let agents: AgentConfig[] = [{ role: 'Researcher', provider: config.aiProvider }];
      if (session.events && session.events[0]) {
        try {
          const payload: any = deserializeEventPayload(session.events[0].payload);
          if (Array.isArray(payload.agents) && payload.agents.length > 0) {
            agents = payload.agents;
          }
        } catch {
          // Ignore malformed created event payload
        }
      }

      // Retrieve confirmed company skills
      let confirmedSkills: any[] = [];
      try {
        confirmedSkills = await retrieveConfirmedSkills(workspaceId, session.goal);
      } catch {
        // Ignore skills retrieval failure and continue session
      }

      if (confirmedSkills.length > 0) {
        const skillsEvent = await appendSessionEvent({
          sessionId,
          type: SessionEventType.SKILLS_APPLIED,
          payload: {
            skills: confirmedSkills.map((s) => ({
              id: s.id,
              stableId: s.stableId,
              title: s.title,
              rule: s.rule
            }))
          }
        });
        if (io) io.to(`session:${sessionId}`).emit('session.event', skillsEvent);
      }

      const brainTools = new BrainTools();
      const runner = new AgentRunner(brainTools, storage, undefined, io);

      let effectivePrompt = session.goal;
      if (confirmedSkills.length > 0) {
        const skillRules = confirmedSkills.map(s => `- [${s.title}]: ${s.rule}`).join('\n');
        effectivePrompt = `CONFIRMED COMPANY SKILLS:\n${skillRules}\n\n${effectivePrompt}`;
      }

      for (let i = 0; i < agents.length; i++) {
        if (ctrl.isCancelled) break;
        await this.waitWhilePaused(ctrl);
        if (ctrl.isCancelled) break;

        // Check for redirects before step
        while (ctrl.pendingRedirects.length > 0) {
          const redirect = ctrl.pendingRedirects.shift()!;
          const interruptedEvent = await appendSessionEvent({
            sessionId,
            type: SessionEventType.AGENT_STEP_INTERRUPTED,
            actorId: redirect.userId,
            payload: {
              turnIndex: i,
              instruction: redirect.instruction,
              evidence: redirect.evidence
            }
          });
          if (io) io.to(`session:${sessionId}`).emit('session.event', interruptedEvent);

          effectivePrompt += `\n\n[REDIRECT INSTRUCTION]: ${redirect.instruction}`;
          if (redirect.evidence) {
            effectivePrompt += `\n[EVIDENCE]: ${redirect.evidence}`;
          }

          const correctionEvent = await appendSessionEvent({
            sessionId,
            type: SessionEventType.CORRECTION_CAPTURED,
            actorId: redirect.userId,
            payload: {
              redirectId: redirect.id,
              step: `Turn ${i + 1}`,
              instruction: redirect.instruction
            }
          });
          if (io) io.to(`session:${sessionId}`).emit('session.event', correctionEvent);

          await prisma.agentRedirect.update({
            where: { id: redirect.id },
            data: {
              agentStep: `turn_${i + 1}`,
              resultingState: 'REDIRECTED'
            }
          });
        }

        const stepStartEvent = await appendSessionEvent({
          sessionId,
          type: SessionEventType.AGENT_STEP_STARTED,
          payload: { turnIndex: i, role: agents[i].role, provider: agents[i].provider }
        });
        if (io) io.to(`session:${sessionId}`).emit('session.event', stepStartEvent);

        // Execute runner turn
        const executionResult = await runner.runTask({
          taskId: task.id,
          workspaceId,
          userId: session.createdById,
          userPrompt: effectivePrompt,
          agents: [agents[i]],
          onEvent: async (ev) => {
            if (io) io.to(`session:${sessionId}`).emit('task.event', ev);
          }
        });

        const stepCompletedEvent = await appendSessionEvent({
          sessionId,
          type: SessionEventType.AGENT_STEP_COMPLETED,
          payload: {
            turnIndex: i,
            role: agents[i].role,
            output: executionResult.answer,
            citations: executionResult.citations,
            status: executionResult.status
          }
        });
        if (io) io.to(`session:${sessionId}`).emit('session.event', stepCompletedEvent);
      }

      if (ctrl.isCancelled) {
        await prisma.liveSession.update({ where: { id: sessionId }, data: { status: 'CANCELLED' } });
        await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'CANCELLED' } });
        return;
      }

      await prisma.liveSession.update({ where: { id: sessionId }, data: { status: 'COMPLETED' } });
      await prisma.agentTask.update({ where: { id: task.id }, data: { status: 'COMPLETED' } });

      const completedEvent = await appendSessionEvent({
        sessionId,
        type: SessionEventType.SESSION_COMPLETED,
        payload: { completedAt: new Date().toISOString() }
      });
      if (io) {
        io.to(`session:${sessionId}`).emit('session.event', completedEvent);
        io.to(`session:${sessionId}`).emit('session.status_changed', { status: 'COMPLETED' });
      }
    } catch (err: any) {
      await prisma.liveSession.update({ where: { id: sessionId }, data: { status: 'FAILED' } });
      const failEvent = await appendSessionEvent({
        sessionId,
        type: SessionEventType.SESSION_FAILED,
        payload: { error: err.message || 'Unknown execution failure' }
      });
      if (io) {
        io.to(`session:${sessionId}`).emit('session.event', failEvent);
        io.to(`session:${sessionId}`).emit('session.status_changed', { status: 'FAILED' });
      }
      console.error(`[SessionRunner] Session ${sessionId} execution error:`, err);
    }
  }
}
