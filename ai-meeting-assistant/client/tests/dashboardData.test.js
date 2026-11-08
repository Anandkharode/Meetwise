import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getCompletionPercentage, getUpcomingDeadlines } from '../src/utils/dashboardData.js';

const today = new Date('2026-11-08T16:00:00.000Z');

test('upcoming deadlines keep only open tasks dated today or later and sort them', () => {
  const tomorrow = { _id: 'tomorrow', status: 'pending', deadline: { normalizedDate: '2026-11-09T00:00:00.000Z' } };
  const dueToday = { _id: 'today', status: 'in_progress', deadline: { normalizedDate: '2026-11-08T00:00:00.000Z' } };
  const overdue = { _id: 'overdue', status: 'pending', deadline: { normalizedDate: '2026-11-07T00:00:00.000Z' } };
  const completed = { _id: 'completed', status: 'completed', deadline: { normalizedDate: '2026-11-10T00:00:00.000Z' } };
  const noDeadline = { _id: 'none', status: 'pending', deadline: null };
  const invalidDate = { _id: 'invalid', status: 'pending', deadline: { normalizedDate: 'not-a-date' } };

  const result = getUpcomingDeadlines([tomorrow, overdue, noDeadline, completed, dueToday, invalidDate], today);
  assert.deepEqual(result.map((task) => task._id), ['today', 'tomorrow']);
  assert.equal(result[0], dueToday);
});

test('upcoming deadline list respects its display limit', () => {
  const tasks = Array.from({ length: 8 }, (_, index) => ({
    _id: String(index),
    status: 'pending',
    deadline: { normalizedDate: `2026-11-${String(9 + index).padStart(2, '0')}T00:00:00.000Z` },
  }));
  assert.equal(getUpcomingDeadlines(tasks, today).length, 6);
});

test('completion percentage uses backend totals and handles empty or inconsistent totals', () => {
  assert.equal(getCompletionPercentage({ totalTasks: 8, completedTasks: 3 }), 38);
  assert.equal(getCompletionPercentage({ totalTasks: 0, completedTasks: 0 }), 0);
  assert.equal(getCompletionPercentage({ totalTasks: 3, completedTasks: 9 }), 100);
});
