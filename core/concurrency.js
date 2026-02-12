export async function runWithConcurrencyLimit(items, limit, workerFn) {
  const queue = [...items];
  const active = new Set();
  const normalizedLimit = Math.max(1, Number(limit) || 1);

  async function runNext() {
    if (queue.length === 0) {
      return;
    }

    const item = queue.shift();
    const promise = Promise.resolve(workerFn(item))
      .catch((e) => {
        console.warn('Worker error:', e);
      })
      .finally(() => {
        active.delete(promise);
      });

    active.add(promise);

    if (active.size >= normalizedLimit) {
      await Promise.race(active);
    }

    return runNext();
  }

  await runNext();
  await Promise.all(active);
}
