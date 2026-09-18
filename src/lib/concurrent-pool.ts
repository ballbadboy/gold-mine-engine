/** Run at most `concurrency` async tasks in parallel, queue the rest. */
export async function concurrentPool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<Array<{ ok: true; value: T } | { ok: false; error: string }>> {
  const results: Array<{ ok: true; value: T } | { ok: false; error: string }> =
    [];
  const queue = tasks.map((task, index) => ({ task, index }));

  async function runNext(): Promise<void> {
    const queued = queue.shift();
    if (!queued) return;
    const { task, index } = queued;
    try {
      const value = await task();
      results[index] = { ok: true, value };
    } catch (e: unknown) {
      results[index] = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
    await runNext();
  }

  const running: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++) {
    running.push(runNext());
  }
  await Promise.all(running);
  return results;
}
