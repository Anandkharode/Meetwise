import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Bell, CalendarDays, CheckSquare, ChevronDown, LayoutDashboard, LogOut, Menu, Search, Settings, UserRound, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import Brand from '../common/Brand.jsx';

const navigation = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Meetings', to: '/meetings', icon: CalendarDays },
  { label: 'Tasks', to: '/tasks', icon: CheckSquare },
  { label: 'Settings', to: '/settings', icon: Settings },
];

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex h-full flex-col px-5 py-6">
      <div className="flex items-center justify-between px-1">
        <Brand dark />
        {onNavigate && <button onClick={onNavigate} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Close menu"><X size={19} /></button>}
      </div>
      <div className="mt-10 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</div>
      <nav className="mt-3 space-y-1" aria-label="Main navigation">
        {navigation.map(({ label, to, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={onNavigate} className={({ isActive }) => `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/20' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
            <Icon size={18} className="shrink-0 opacity-90" />{label}
            {label !== 'Dashboard' && <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Soon</span>}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-200">
            {user?.name?.slice(0, 1)?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.name}</p>
            <p className="truncate text-xs text-slate-400">{user?.email}</p>
          </div>
          <ChevronDown size={15} className="text-slate-500" />
        </div>
        <button onClick={logout} className="mt-4 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
          <LogOut size={16} /> Sign out
        </button>
      </div>
      <p className="mt-5 px-2 text-[11px] text-slate-600">Meeting actions, made clear.</p>
    </div>
  );
}

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const location = useLocation();
  const { user, logout } = useAuth();
  const pageTitle = location.pathname.startsWith('/meetings') ? 'Meetings'
    : location.pathname.startsWith('/tasks') ? 'Tasks'
      : location.pathname.startsWith('/settings') ? 'Settings' : 'Dashboard';

  useEffect(() => {
    function closeProfile(event) {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
    }
    document.addEventListener('pointerdown', closeProfile);
    return () => document.removeEventListener('pointerdown', closeProfile);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] bg-[#101a30] lg:block"><SidebarContent /></aside>
      {menuOpen && <div className="fixed inset-0 z-40 lg:hidden">
        <button className="absolute inset-0 bg-slate-950/50" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />
        <aside className="relative h-full w-[280px] bg-[#101a30] shadow-2xl"><SidebarContent onNavigate={() => setMenuOpen(false)} /></aside>
      </div>}
      <div className="min-w-0 flex-1 lg:ml-[260px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={21} /></button>
            <div><p className="hidden text-[11px] font-medium uppercase tracking-wider text-slate-400 sm:block">Workspace</p><h1 className="truncate text-lg font-bold tracking-tight text-slate-900">{pageTitle}</h1></div>
          </div>
          <div className="ml-3 flex items-center gap-2 sm:gap-3">
            <label className="relative hidden md:block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input aria-label="Search meetings and tasks" type="search" placeholder="Search meetings and tasks" className="h-10 w-56 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50 lg:w-64" />
            </label>
            <button type="button" aria-label="Notifications (coming soon)" title="Notifications are not available yet" className="relative grid h-10 w-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100"><Bell size={19} /></button>
            <div className="relative" ref={profileRef}>
              <button type="button" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu" className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-slate-100 sm:gap-3 sm:pr-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">{user?.name?.slice(0, 1)?.toUpperCase() || 'U'}</span>
                <span className="hidden max-w-36 text-left sm:block"><span className="block truncate text-sm font-semibold text-slate-800">{user?.name}</span><span className="block truncate text-xs text-slate-500">{user?.email}</span></span>
                <ChevronDown size={15} className={`hidden text-slate-400 transition sm:block ${profileOpen ? 'rotate-180' : ''}`} />
              </button>
              {profileOpen && <div role="menu" className="absolute right-0 top-12 z-30 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                <div className="border-b border-slate-100 px-3 py-2.5"><p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p><p className="truncate text-xs text-slate-500">{user?.email}</p></div>
                <div className="px-3 py-2 text-xs text-slate-500"><UserRound size={13} className="mr-1.5 inline" />{user?.role || 'user'} account</div>
                <button role="menuitem" onClick={() => { setProfileOpen(false); logout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"><LogOut size={15} /> Sign out</button>
              </div>}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9"><Outlet /></main>
      </div>
    </div>
  );
}
