import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiError } from '../services/api.js';
import { GuestRoute } from '../routes/ProtectedRoute.jsx';
import Alert from '../components/common/Alert.jsx';
import Brand from '../components/common/Brand.jsx';

function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const update = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate('/dashboard', { replace: true, state: { notice: 'Your account is ready. Welcome to Meetwise.' } });
    } catch (requestError) {
      setError(getApiError(requestError, 'We could not create your account. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[0.98fr_1.02fr]">
      <section className="relative hidden overflow-hidden bg-[#101a30] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -bottom-40 -left-36 h-[520px] w-[520px] rounded-full border border-blue-300/10" />
        <Brand dark />
        <div className="relative max-w-xl pb-10">
          <p className="mb-6 text-sm font-semibold uppercase tracking-[0.18em] text-blue-300">Make room for follow-through</p>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">The meeting<br />ends. The <span className="text-blue-400">momentum</span><br />doesn’t.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-300">Create your workspace and give every decision a clear next step.</p>
          <div className="mt-9 grid max-w-md grid-cols-3 gap-3">
            {[['01', 'Capture'], ['02', 'Clarify'], ['03', 'Follow through']].map(([number, label]) => <div key={number} className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><span className="text-xs font-bold text-blue-300">{number}</span><p className="mt-2 text-xs font-medium text-slate-200">{label}</p></div>)}
          </div>
        </div>
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} Meetwise</p>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-8 lg:hidden"><Brand /></div>
          <div className="mb-7">
            <p className="text-sm font-semibold text-blue-700">GET STARTED</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Create your account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Set up your workspace in a few seconds.</p>
          </div>
          {error && <div className="mb-5"><Alert>{error}</Alert></div>}
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Full name</span><span className="relative block"><UserRound size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="name" name="name" required minLength={2} maxLength={100} value={form.name} onChange={update} placeholder="Alex Morgan" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></span></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span><span className="relative block"><Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="email" type="email" name="email" required value={form.email} onChange={update} placeholder="you@company.com" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></span></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Password</span><span className="relative block"><LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="new-password" type={showPassword ? 'text' : 'password'} name="password" required minLength={8} maxLength={128} value={form.password} onChange={update} placeholder="At least 8 characters" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span><span className="mt-1.5 block text-xs text-slate-400">Use 8–128 characters.</span></label>
            <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Confirm password</span><span className="relative block"><LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input autoComplete="new-password" type={showPassword ? 'text' : 'password'} name="confirmPassword" required value={form.confirmPassword} onChange={update} placeholder="Re-enter your password" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100" /></span></label>
            <button disabled={isSubmitting} type="submit" className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-70">
              {isSubmitting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Creating account…</> : <>Create account <ArrowRight size={17} /></>}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link className="font-semibold text-blue-700 hover:text-blue-800" to="/login">Sign in</Link></p>
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">By creating an account, you agree to use this workspace responsibly.</p>
        </div>
      </section>
    </div>
  );
}

export default function Register() {
  return <GuestRoute><RegisterForm /></GuestRoute>;
}
