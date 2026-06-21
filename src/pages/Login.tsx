import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, otpApi, endpoints } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import type { Concern } from '../types'

const errMsg = (e: unknown, fb: string) => {
  const ax = e as { response?: { data?: { error?: string; message?: string } } }
  return ax?.response?.data?.error || ax?.response?.data?.message || fb
}

const FEATURES = [
  { t: 'Upload in seconds', d: 'Snap a bill, pick a category, submit — from your phone or desktop.' },
  { t: 'Track every status', d: 'See pending, approved, invoiced and paid expenses at a glance.' },
  { t: 'Statements on demand', d: 'Download a clean PDF statement for any period, anytime.' },
]

export default function Login() {
  const { concern: existing, login } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState<'mobile' | 'otp'>('mobile')
  const [mobile, setMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [pending, setPending] = useState<Concern | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  if (existing) return <Navigate to="/" replace />

  const sendOtp = async () => {
    setError('')
    setInfo('')
    if (mobile.length !== 10) {
      setError('Enter a valid 10-digit mobile number')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.get(endpoints.concernLookup(mobile))
      if (!data?.registered) {
        setError(data?.error || 'This mobile is not registered.')
        return
      }
      setPending(data.concern as Concern)
      await otpApi.post(endpoints.sendOtp, { phone: mobile })
      setStep('otp')
      setOtp('')
      setInfo(`OTP sent to +91 ${mobile}`)
    } catch (e) {
      setError(errMsg(e, 'Could not send OTP. Try again.'))
    } finally {
      setLoading(false)
    }
  }

  const verify = async () => {
    setError('')
    if (otp.trim().length < 4) {
      setError('Enter the OTP you received')
      return
    }
    setLoading(true)
    try {
      const { data } = await otpApi.post(endpoints.verifyOtp, { phone: mobile, otp: otp.trim() })
      if ((data?.verified || data?.success) && pending) {
        login(pending)
        navigate('/', { replace: true })
      } else {
        setError(data?.error || data?.message || 'Invalid OTP')
      }
    } catch (e) {
      setError(errMsg(e, 'Invalid or expired OTP'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh w-full lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden gradient-brand p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <Logo className="h-6 w-6" />
          </div>
          <div className="text-[15px] font-semibold tracking-tight">Chesa Dental Care</div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[34px] font-extrabold leading-[1.1] tracking-tight">
            Expenses, handled
            <br />beautifully.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-indigo-100">
            The official expense portal for Chesa team members — submit, track and settle your business expenses in one place.
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.t} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <div>
                  <div className="text-[14px] font-semibold">{f.t}</div>
                  <div className="text-[13px] text-indigo-100/80">{f.d}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[12px] text-indigo-100/70">
          <ShieldIcon className="h-4 w-4" />
          Secure OTP login · only registered concern persons
        </div>
      </aside>

      <main className="relative flex min-h-dvh items-center justify-center gradient-mesh px-4 py-10">
        <div className="w-full max-w-md animate-rise">
          <div className="overflow-hidden rounded-[28px] bg-white shadow-card-lg ring-1 ring-slate-200/70">
            <div className="gradient-brand px-7 pb-8 pt-9 text-white lg:hidden">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-white/25">
                <Logo className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight">Expense Portal</h1>
              <p className="mt-1 text-sm text-indigo-100">Chesa Dental Care · Concern Person Login</p>
            </div>

            <div className="px-7 py-8">
              <div className="mb-6 hidden lg:block">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
                  {step === 'mobile' ? 'Welcome back' : 'Verify it’s you'}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {step === 'mobile' ? 'Log in with your registered mobile number.' : `Enter the code sent to +91 ${mobile}.`}
                </p>
              </div>

              {step === 'mobile' ? (
                <form onSubmit={(e) => { e.preventDefault(); void sendOtp() }}>
                  <label className="mb-2 block text-[13px] font-semibold text-slate-700">Mobile number</label>
                  <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3.5 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
                    <span className="select-none text-[15px] font-semibold text-slate-500">🇮🇳 +91</span>
                    <span className="h-5 w-px bg-slate-200" />
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      autoFocus
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="00000 00000"
                      className="min-w-0 flex-1 border-none bg-transparent py-3.5 text-[16px] tracking-wide text-slate-900 outline-none placeholder:text-slate-300"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || mobile.length < 10}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl gradient-brand py-3.5 text-[15px] font-semibold text-white shadow-brand transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
                  >
                    {loading ? <Spinner /> : null}
                    {loading ? 'Sending OTP…' : 'Get OTP'}
                  </button>
                </form>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); void verify() }}>
                  <p className="mb-1 text-sm text-slate-600 lg:hidden">
                    Enter the code sent to <span className="font-semibold text-slate-900">+91 {mobile}</span>
                  </p>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="• • • • • •"
                    className="mt-3 w-full rounded-2xl border border-slate-300 bg-white py-4 text-center text-2xl font-bold tracking-[0.4em] text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 placeholder:tracking-[0.3em] placeholder:text-slate-300"
                  />
                  <button
                    type="submit"
                    disabled={loading || otp.length < 4}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl gradient-brand py-3.5 text-[15px] font-semibold text-white shadow-brand transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
                  >
                    {loading ? <Spinner /> : null}
                    {loading ? 'Verifying…' : 'Verify & Continue'}
                  </button>
                  <div className="mt-4 flex items-center justify-between text-[13px]">
                    <button type="button" onClick={() => void sendOtp()} disabled={loading} className="font-semibold text-indigo-600 hover:underline disabled:opacity-50">
                      Resend OTP
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStep('mobile'); setError(''); setInfo('') }}
                      className="font-medium text-slate-500 hover:text-slate-800"
                    >
                      Change number
                    </button>
                  </div>
                </form>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-[13px] font-medium text-rose-700 ring-1 ring-rose-100 animate-fade">
                  <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
                </div>
              )}
              {info && !error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[13px] font-medium text-emerald-700 ring-1 ring-emerald-100 animate-fade">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" /> <span>{info}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-slate-400 lg:hidden">
                <ShieldIcon className="h-3.5 w-3.5" />
                Secure OTP login · only registered concern persons
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function Logo({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h6M9 8h2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function ShieldIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function AlertIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></svg>
}
function CheckIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
function Spinner() {
  return <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
}
