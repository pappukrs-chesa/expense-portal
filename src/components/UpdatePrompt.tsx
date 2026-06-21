import { useEffect, useRef, useState } from 'react'

const STUCK_WAIT_MS = 5000
const UPDATE_CHECK_MS = 10 * 60 * 1000
const POST_CLICK_RELOAD_MS = 2000

export default function UpdatePrompt() {
  const [show, setShow] = useState(false)
  const regRef = useRef<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let stuckTimer: ReturnType<typeof setTimeout> | null = null
    let checkTimer: ReturnType<typeof setInterval> | null = null

    const scheduleStuck = () => {
      if (stuckTimer) clearTimeout(stuckTimer)
      stuckTimer = setTimeout(() => {
        if (regRef.current?.waiting) setShow(true)
      }, STUCK_WAIT_MS)
    }

    const init = async () => {
      const reg = await navigator.serviceWorker.ready
      regRef.current = reg
      if (reg.waiting) scheduleStuck()
      reg.addEventListener('updatefound', () => {
        const w = reg.installing
        if (!w) return
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) scheduleStuck()
        })
      })
      checkTimer = setInterval(() => { reg.update().catch(() => {}) }, UPDATE_CHECK_MS)
    }
    void init()

    return () => {
      if (stuckTimer) clearTimeout(stuckTimer)
      if (checkTimer) clearInterval(checkTimer)
    }
  }, [])

  if (!show) return null

  const onRefresh = () => {
    const reg = regRef.current
    if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
    setTimeout(() => window.location.reload(), POST_CLICK_RELOAD_MS)
  }

  return (
    <div role="alert" className="fixed inset-x-4 top-4 z-[70] mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 shadow-card-lg animate-rise">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 11-2.6-6.36M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-bold text-white">Update available</div>
        <div className="text-[11px] text-slate-400">A new version is ready. Tap update to refresh.</div>
      </div>
      <button onClick={onRefresh} className="shrink-0 rounded-xl gradient-brand px-4 py-2 text-[12.5px] font-semibold text-white transition hover:brightness-105 active:scale-95">
        Update
      </button>
    </div>
  )
}
