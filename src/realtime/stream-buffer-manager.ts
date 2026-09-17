export interface ActiveStreamState {
  workspaceId: string;
  threadId: string;
  bufferedText: string;
  chunks: string[];
  startedAt: Date;
  isComplete: boolean;
}

export class StreamBufferManager {
  private static instance: StreamBufferManager;
  // Map of `${workspaceId}:${threadId}` -> ActiveStreamState
  private activeStreams: Map<string, ActiveStreamState> = new Map();

  public static getInstance(): StreamBufferManager {
    if (!StreamBufferManager.instance) {
      StreamBufferManager.instance = new StreamBufferManager();
    }
    return StreamBufferManager.instance;
  }

  private getKey(workspaceId: string, threadId: string): string {
    return `${workspaceId}:${threadId}`;
  }

  public startStream(workspaceId: string, threadId: string): ActiveStreamState {
    const key = this.getKey(workspaceId, threadId);
    const state: ActiveStreamState = {
      workspaceId,
      threadId,
      bufferedText: '',
      chunks: [],
      startedAt: new Date(),
      isComplete: false
    };
    this.activeStreams.set(key, state);
    return state;
  }

  public appendChunk(workspaceId: string, threadId: string, chunk: string): ActiveStreamState {
    const key = this.getKey(workspaceId, threadId);
    let state = this.activeStreams.get(key);
    if (!state) {
      state = this.startStream(workspaceId, threadId);
    }
    state.chunks.push(chunk);
    state.bufferedText += chunk;
    return state;
  }

  public completeStream(workspaceId: string, threadId: string): void {
    const key = this.getKey(workspaceId, threadId);
    const state = this.activeStreams.get(key);
    if (state) {
      state.isComplete = true;
      // Expire from active buffer after 5 seconds to allow late socket reconnects
      setTimeout(() => {
        this.activeStreams.delete(key);
      }, 5000);
    }
  }

  public getActiveStreamsForWorkspace(workspaceId: string): ActiveStreamState[] {
    const active: ActiveStreamState[] = [];
    for (const state of this.activeStreams.values()) {
      if (state.workspaceId === workspaceId && !state.isComplete) {
        active.push(state);
      }
    }
    return active;
  }

  public getStream(workspaceId: string, threadId: string): ActiveStreamState | undefined {
    return this.activeStreams.get(this.getKey(workspaceId, threadId));
  }

  public clear(): void {
    this.activeStreams.clear();
  }
}
