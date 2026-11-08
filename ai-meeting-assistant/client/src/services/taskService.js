import api from './api.js';

const TASK_PAGE_SIZE = 100;
const TASK_PAGE_BATCH_SIZE = 4;

/** Fetch the backend's authoritative task status totals. */
export async function getTaskStats(signal) {
  const { data } = await api.get('/tasks/stats', { signal });
  return data.stats;
}

/** Get one authenticated task and its parent meeting summary fields. */
export async function getTask(taskId, signal) {
  const { data } = await api.get(`/tasks/${encodeURIComponent(taskId)}`, { signal });
  return data;
}

/** Fetch every task page so dashboard deadline selection is not limited to page one. */
export async function listAllTasks(signal) {
  const first = await api.get('/tasks', {
    params: { page: 1, limit: TASK_PAGE_SIZE },
    signal,
  });
  const { tasks = [], pagination } = first.data;
  const totalPages = Math.max(1, Number(pagination?.totalPages) || 1);
  if (totalPages === 1) return tasks;

  const pageNumbers = Array.from({ length: totalPages - 1 }, (_, index) => index + 2);
  const remainingPages = [];
  for (let offset = 0; offset < pageNumbers.length; offset += TASK_PAGE_BATCH_SIZE) {
    const batch = pageNumbers.slice(offset, offset + TASK_PAGE_BATCH_SIZE);
    const result = await Promise.all(batch.map(async (page) => {
      const { data } = await api.get('/tasks', {
        params: { page, limit: TASK_PAGE_SIZE },
        signal,
      });
      return data.tasks || [];
    }));
    remainingPages.push(...result);
  }
  return tasks.concat(...remainingPages);
}
