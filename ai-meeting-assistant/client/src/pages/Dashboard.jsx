import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle2, CircleDashed, ListTodo, Sparkles } from 'lucide-react';
import Alert from '../components/common/Alert.jsx';
import QuickActions from '../components/dashboard/QuickActions.jsx';
import RecentMeetings from '../components/dashboard/RecentMeetings.jsx';
import StatCard from '../components/dashboard/StatCard.jsx';
import TaskOverview from '../components/dashboard/TaskOverview.jsx';
import UpcomingDeadlines from '../components/dashboard/UpcomingDeadlines.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../services/api.js';
import { listMeetings } from '../services/meetingService.js';
import { getTaskStats, listAllTasks } from '../services/taskService.js';
import { getUpcomingDeadlines } from '../utils/dashboardData.js';

export default function Dashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState(location.state?.notice || '');

  const loadDashboard = useCallback(async (signal) => {
    setIsLoading(true);
    setError('');
    try {
      const [meetingResponse, taskStats, tasks] = await Promise.all([
        listMeetings({ page: 1, limit: 5 }, signal),
        getTaskStats(signal),
        listAllTasks(signal),
      ]);
      setData({
        meetings: meetingResponse.meetings || [],
        meetingTotal: meetingResponse.pagination?.total ?? 0,
        tasks,
        taskStats,
      });
    } catch (requestError) {
      if (requestError.code !== 'ERR_CANCELED') {
        setError(getApiError(requestError, 'We could not load your dashboard.'));
      }
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadDashboard(controller.signal);
    return () => controller.abort();
  }, [loadDashboard]);

  const upcoming = useMemo(() => getUpcomingDeadlines(data?.tasks || []), [data?.tasks]);
  const showLoading = isLoading;
  const stats = data?.taskStats;

  function dismissNotice() {
    setNotice('');
    navigate(location.pathname, { replace: true, state: {} });
  }

  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(new Date());

  if (!data && error) {
    return <section className="mx-auto max-w-2xl space-y-5 py-12">
      <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1><p className="mt-2 text-sm text-slate-500">We could not retrieve your workspace data.</p></div>
      <Alert>{error}</Alert>
      <button onClick={() => loadDashboard()} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">Try again</button>
    </section>;
  }

  return (
    <div className="space-y-8">
      {notice && <Alert type="success" onClose={dismissNotice}>{notice}</Alert>}

      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700"><Sparkles size={13} /> YOUR MEETING WORKSPACE</div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-[34px]">Welcome, {user?.name?.split(' ')[0] || 'there'}</h1>
          <p className="mt-2 text-sm text-slate-500">Your meetings, action items, and upcoming deadlines in one place.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays size={16} /><span>{todayLabel}</span></div>
      </section>

      {error && <Alert>{error} <button className="ml-1 font-semibold underline underline-offset-2" onClick={() => loadDashboard()}>Try again</button></Alert>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace statistics">
        <StatCard label="Total meetings" value={data?.meetingTotal ?? 0} caption="Across your workspace" icon={CalendarDays} tone="blue" isLoading={showLoading} />
        <StatCard label="Total tasks" value={stats?.totalTasks ?? 0} caption="All action items" icon={ListTodo} tone="violet" isLoading={showLoading} />
        <StatCard label="Pending tasks" value={stats?.pendingTasks ?? 0} caption="Waiting to get started" icon={CircleDashed} tone="amber" isLoading={showLoading} />
        <StatCard label="Completed tasks" value={stats?.completedTasks ?? 0} caption="Marked complete" icon={CheckCircle2} tone="emerald" isLoading={showLoading} />
      </section>

      <QuickActions />

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <RecentMeetings meetings={data?.meetings || []} isLoading={showLoading} />
        <TaskOverview stats={stats} isLoading={showLoading} />
      </section>

      <UpcomingDeadlines tasks={upcoming} isLoading={showLoading} />
    </div>
  );
}
