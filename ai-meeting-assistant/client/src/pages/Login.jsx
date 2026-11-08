import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../services/api.js';
import { GuestRoute } from '../routes/ProtectedRoute.jsx';
import Alert from '../components/common/Alert.jsx';
import Brand from '../components/common/Brand.jsx';

function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(form);
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true, state: { notice: 'Welcome back. You are signed in.' } });
    } catch (requestError) {
      setError(getApiError(requestError, 'We could not sign you in. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.02fr_0.98fr]">
      <section className="relative hidden overflow-hidden bg-[#101a30] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-36 -top-32 h-[480px] w-[480px] rounded-full border border-blue-300/10" />
        <div className="absolute -right-16 -top-12 h-[320px] w-[320px] rounded-full border border-blue-300/10" />
        <Brand dark />
        <div className="relative max-w-xl pb-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-xs font-semibold text-blue-200"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> YOUR MEETINGS, IN MOTION</div>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">Make every<br />meeting <span className="text-blue-400">count.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-300">Keep the conversation, decisions, and next steps together — so good ideas turn into action.</p>
          <div className="mt-10 flex items-center gap-3 text-sm text-slate-400"><span className="flex -space-x-2"><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#101a30] bg-indigo-400 text-[10px] font-bold text-white">A</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#101a30] bg-teal-400 text-[10px] font-bold text-white">M</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#101a30] bg-orange-300 text-[10px] font-bold text-white">J</span></span><span>Less follow-up. More forward motion.</span></div>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Meetwise</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 lg:hidden"><Brand /></div>
          <div className="mb-8">
            <p className="text-sm font-semibold text-blue-700">WELCOME BACK</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Sign in to Meetwise</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Pick up right where your team left off.</p>
          </div>
          {error && <div className="mb-5"><Alert>{error}</Alert></div>}
          <form className="space-y-5" onSubmit={submit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
              <span className="relative block"><Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="email" type="email" name="email" required value={form.email} onChange={update} placeholder="you@company.com" className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
              <span className="relative block"><LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="current-password" type={showPassword ? 'text' : 'password'} name="password" required value={form.password} onChange={update} placeholder="Enter your password" className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
            </label>
            <button disabled={isSubmitting} type="submit" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70">
              {isSubmitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Signing in…</> : <>Sign in <ArrowRight size={17} /></>}
            </button>
          </form>
          <p className="mt-7 text-center text-sm text-slate-500">New to Meetwise? <Link className="font-semibold text-blue-700 hover:text-blue-800" to="/register">Create an account</Link></p>
          <p className="mt-10 text-center text-xs text-slate-400">Your workspace is protected by secure sign-in.</p>
        </div>
      </section>
    </div>
  );
}

export default function Login() {
  return <GuestRoute><LoginForm /></GuestRoute>;
}
