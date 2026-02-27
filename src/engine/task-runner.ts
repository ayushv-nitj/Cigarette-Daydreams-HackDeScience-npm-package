

import type { StageResult } from "./types";

const DEFAULT_TASK_TIMEOUT_MS = 8_000;
const DEFAULT_STAGE_TIMEOUT_MS = 15_000;

function timeoutPromise(ms: number, label: string): Promise<never> {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`[timeout] stage "${label}" exceeded ${ms}ms`)), ms)
    );
}

interface TaskEntry<T> {
    label: string;
    fn: () => Promise<T> | T;
}

/**
 * ParallelStage
 * Register tasks with `.add()`, then execute all in parallel with `.run()`.
 * Each task is individually guarded by a per-task timeout.
 * The whole stage is additionally guarded by a total timeout.
 *
 * @example
 * const stage = new ParallelStage();
 * stage.add("bugLint", () => runBugLint(code, detection));
 * stage.add("semgrep", () => runSemgrep(code));
 * const results = await stage.run({ taskTimeoutMs: 8000, stageTimeoutMs: 15000 });
 */
export class ParallelStage {
    private tasks: TaskEntry<unknown>[] = [];

    /** Register an async (or sync) task with a descriptive label. */
    add<T>(label: string, fn: () => Promise<T> | T): this {
        this.tasks.push({ label, fn } as TaskEntry<unknown>);
        return this;
    }

    /**
     * Execute all registered tasks in parallel.
     * @param taskTimeoutMs  Per-task timeout (default 8 s)
     * @param stageTimeoutMs Overall stage timeout (default 15 s)
     */
    async run(opts?: {
        taskTimeoutMs?: number;
        stageTimeoutMs?: number;
    }): Promise<StageResult[]> {
        const taskMs = opts?.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS;
        const stageMs = opts?.stageTimeoutMs ?? DEFAULT_STAGE_TIMEOUT_MS;

        const wrappedTasks = this.tasks.map(async ({ label, fn }): Promise<StageResult> => {
            const start = Date.now();
            try {
                const value = await Promise.race([
                    Promise.resolve().then(() => fn()),
                    timeoutPromise(taskMs, label),
                ]);
                return { label, status: "fulfilled", value, durationMs: Date.now() - start };
            } catch (err) {
                const status = err instanceof Error && err.message.startsWith("[timeout]")
                    ? "timeout"
                    : "rejected";
                return { label, status, error: err, durationMs: Date.now() - start };
            }
        });

        // Outer guard: if ALL tasks somehow hang past stageMs, resolve with what we have
        const stageGuard = timeoutPromise(stageMs, "ParallelStage").catch(() =>
            [] as StageResult[]
        );

        const settled = await Promise.race([
            Promise.all(wrappedTasks),
            stageGuard,
        ]) as StageResult[];

        return settled;
    }
}
