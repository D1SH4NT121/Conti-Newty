import { AgentRunner, AgentTaskExecutionResult } from './agent-runner';

export interface QueuedTurnItem {
  id: string;
  threadId: string;
  workspaceId: string;
  userId: string;
  prompt: string;
  runner: AgentRunner;
  taskId: string;
  resolve: (result: AgentTaskExecutionResult) => void;
  reject: (err: any) => void;
  enqueuedAt: Date;
}

export class ThreadTurnQueue {
  private static instance: ThreadTurnQueue;
  // Map of threadId -> QueuedTurnItem[]
  private queues: Map<string, QueuedTurnItem[]> = new Map();
  // Set of active running threadIds
  private runningThreads: Set<string> = new Set();
  // Completed turns log for verification
  private executionHistory: Map<string, AgentTaskExecutionResult[]> = new Map();

  public static getInstance(): ThreadTurnQueue {
    if (!ThreadTurnQueue.instance) {
      ThreadTurnQueue.instance = new ThreadTurnQueue();
    }
    return ThreadTurnQueue.instance;
  }

  public async enqueueTurn(params: {
    threadId: string;
    workspaceId: string;
    userId: string;
    prompt: string;
    taskId: string;
    runner: AgentRunner;
  }): Promise<AgentTaskExecutionResult> {
    const { threadId, workspaceId, userId, prompt, taskId, runner } = params;

    return new Promise((resolve, reject) => {
      const item: QueuedTurnItem = {
        id: `turn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        threadId,
        workspaceId,
        userId,
        prompt,
        taskId,
        runner,
        resolve,
        reject,
        enqueuedAt: new Date()
      };

      if (!this.queues.has(threadId)) {
        this.queues.set(threadId, []);
      }

      this.queues.get(threadId)!.push(item);

      // Trigger processing if not already active
      this.processNext(threadId);
    });
  }

  private async processNext(threadId: string): Promise<void> {
    if (this.runningThreads.has(threadId)) {
      return; // A turn is currently executing, next item will be processed when it finishes
    }

    const queue = this.queues.get(threadId);
    if (!queue || queue.length === 0) {
      return;
    }

    const currentItem = queue.shift()!;
    this.runningThreads.add(threadId);

    try {
      const result = await currentItem.runner.runTask({
        taskId: currentItem.taskId,
        workspaceId: currentItem.workspaceId,
        userId: currentItem.userId,
        userPrompt: currentItem.prompt
      });

      if (!this.executionHistory.has(threadId)) {
        this.executionHistory.set(threadId, []);
      }
      this.executionHistory.get(threadId)!.push(result);

      currentItem.resolve(result);
    } catch (err: any) {
      currentItem.reject(err);
    } finally {
      this.runningThreads.delete(threadId);
      // Automatically process next queued message in FIFO order
      this.processNext(threadId);
    }
  }

  public getQueueLength(threadId: string): number {
    return (this.queues.get(threadId) || []).length;
  }

  public isThreadRunning(threadId: string): boolean {
    return this.runningThreads.has(threadId);
  }

  public getExecutionHistory(threadId: string): AgentTaskExecutionResult[] {
    return this.executionHistory.get(threadId) || [];
  }

  public clear(): void {
    this.queues.clear();
    this.runningThreads.clear();
    this.executionHistory.clear();
  }
}
