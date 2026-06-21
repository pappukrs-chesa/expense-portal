import { useState, useEffect, useCallback } from 'react'
import { usePWAInstall } from '../hooks/usePWAInstall'

const DISMISS_KEY = 'ep.pwa-install-dismissed'
const SHOW_AFTER_MS = 20000
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000

export default function InstallPrompt() {
  const { canInstall, isInstalled, isIOS, isAndroid, install } = usePWAInstall()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isInstalled) return
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_FOR_MS) return
    const t = setTimeout(() => setShow(true), SHOW_AFTER_MS)
    return () => clearTimeout(t)
  }, [isInstalled])

  const onInstall = useCallback(async () => {
    const ok = await install()
    if (ok) setShow(false)
  }, [install])

  const onDismiss = useCallback(() => {
    setShow(false)
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  }, [])

  if (isInstalled || !show || (!canInstall && !isIOS && !isAndroid)) return null

  return (
    <div className="fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-2xl border border-indigo-100 bg-white/95 p-4 shadow-card-lg backdrop-blur animate-rise lg:bottom-6">
      <button onClick={onDismiss} aria-label="Dismiss" className="absolute right-2.5 top-2.5 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
      </button>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gradient-brand text-white shadow-brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <div className="min-w-0 flex-1 pr-4">
          <h3 className="text-[14px] font-bold text-slate-900">Install Expense Portal</h3>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
            {isIOS
              ? 'Tap the Share button, then “Add to Home Screen”.'
              : isAndroid && !canInstall
                ? 'Tap the ⋮ menu, then “Add to Home Screen”.'
                : 'Add it to your home screen for faster access and an app-like experience.'}
          </p>
          {isIOS ? (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m0 0L8 8m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Share → Add to Home Screen
            </div>
          ) : isAndroid && !canInstall ? (
            <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-indigo-600">⋮ menu → Add to Home Screen</div>
          ) : (
            <button onClick={onInstall} className="mt-2.5 rounded-xl gradient-brand px-4 py-2 text-[12.5px] font-semibold text-white shadow-brand transition hover:brightness-105 active:scale-95">
              Install App
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
