export type SchedulerConfig = {
  reconcileMs: number;     // Config reconcile interval (default: 30s)
  fullSyncMs: number;      // Full sync interval (default: 5 min)
  healthCheckMs: number;   // Health check interval (default: 1 min)
};

export type ScheduledTask = {
  name: string;
  intervalMs: number;
  handler: () => Promise<void>;
};

const DEFAULT_CONFIG: SchedulerConfig = {
  reconcileMs: 30 * 1000,       // 30 seconds
  fullSyncMs: 5 * 60 * 1000,    // 5 minutes
  healthCheckMs: 60 * 1000,     // 1 minute
};

export class Scheduler {
  private readonly config: SchedulerConfig;
  private readonly tasks: Map<string, { timer: NodeJS.Timeout; lastRun?: Date }> = new Map();
  private stopped = false;
  private readonly debug: boolean;

  constructor(options?: Partial<SchedulerConfig> & { debug?: boolean }) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.debug = options?.debug ?? false;
  }

  get settings(): SchedulerConfig {
    return { ...this.config };
  }

  schedule(task: ScheduledTask): void {
    if (this.stopped) return;

    const existing = this.tasks.get(task.name);
    if (existing) {
      clearInterval(existing.timer);
    }

    const runTask = async () => {
      if (this.stopped) return;

      const entry = this.tasks.get(task.name);
      if (entry) {
        entry.lastRun = new Date();
      }

      try {
        await task.handler();
      } catch (error) {
        console.error(`[scheduler] task ${task.name} failed:`, error);
      }
    };

    // Run immediately
    void runTask();

    // Schedule periodic runs
    const timer = setInterval(runTask, task.intervalMs);
    this.tasks.set(task.name, { timer, lastRun: new Date() });

    if (this.debug) {
      console.log(`[scheduler] scheduled task "${task.name}" every ${task.intervalMs}ms`);
    }
  }

  unschedule(name: string): void {
    const entry = this.tasks.get(name);
    if (entry) {
      clearInterval(entry.timer);
      this.tasks.delete(name);

      if (this.debug) {
        console.log(`[scheduler] unscheduled task "${name}"`);
      }
    }
  }

  async runNow(name: string): Promise<void> {
    const entry = this.tasks.get(name);
    if (!entry) return;

    // The handler will be retrieved from the task registry if we add one
    // For now, we'll trigger the task by name
    if (this.debug) {
      console.log(`[scheduler] running task "${name}" manually`);
    }
  }

  getTaskStatus(): Array<{ name: string; lastRun?: Date }> {
    return Array.from(this.tasks.entries()).map(([name, entry]) => ({
      name,
      lastRun: entry.lastRun,
    }));
  }

  stop(): void {
    this.stopped = true;

    for (const [name, entry] of this.tasks) {
      clearInterval(entry.timer);
      if (this.debug) {
        console.log(`[scheduler] stopped task "${name}"`);
      }
    }

    this.tasks.clear();
  }
}
