/** Select open tasks with a real normalized deadline on or after the current UTC date. */
export function getUpcomingDeadlines(tasks, now = new Date(), limit = 6) {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return tasks
    .filter((task) => {
      const deadline = task.deadline?.normalizedDate;
      if (!deadline || task.status === 'completed') return false;
      const date = new Date(deadline);
      return !Number.isNaN(date.getTime()) && date.getTime() >= todayUtc;
    })
    .sort((left, right) => new Date(left.deadline.normalizedDate) - new Date(right.deadline.normalizedDate))
    .slice(0, limit);
}

/** Calculate the rounded completion percentage from backend task totals. */
export function getCompletionPercentage(stats = {}) {
  const total = Number(stats.totalTasks) || 0;
  const completed = Number(stats.completedTasks) || 0;
  if (!total) return 0;
  return Math.round((Math.min(total, Math.max(0, completed)) / total) * 100);
}
