import { useState, useEffect, useRef, useCallback } from 'react'
import type { Option } from '../types'

type Props = {
  value: string
  placeholder: string
  fetchOptions: (q: string) => Promise<Option[]>
  onSelect: (opt: Option | null) => void
}

export default function SearchSelect({ value, placeholder, fetchOptions, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<Option[]>([])
  const [loading, setLoading] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const reqId = useRef(0)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const runFetch = useCallback(
    async (q: string) => {
      const my = ++reqId.current
      setLoading(true)
      try {
        const opts = await fetchOptions(q)
        if (my === reqId.current) setOptions(opts || [])
      } catch {
        if (my === reqId.current) setOptions([])
      } finally {
        if (my === reqId.current) setLoading(false)
      }
    },
    [fetchOptions],
  )

  const openMenu = () => {
    setOpen(true)
    void runFetch(query)
  }

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value
    setQuery(q)
    setOpen(true)
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void runFetch(q), 350)
  }

  const pick = (opt: Option) => {
    onSelect(opt)
    setQuery('')
    setOpen(false)
  }

  const clear = () => {
    onSelect(null)
    setQuery('')
    setOptions([])
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3.5 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" className="shrink-0">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          className="min-w-0 flex-1 border-none bg-transparent py-3 text-[15px] text-slate-900 outline-none placeholder:text-slate-400"
          type="text"
          placeholder={value || placeholder}
          value={open ? query : value || ''}
          onChange={onChange}
          onFocus={openMenu}
        />
        {value && (
          <button type="button" onClick={clear} className="shrink-0 rounded-full p-0.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" aria-label="Clear">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-card-lg animate-pop">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium text-slate-400">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
              Searching…
            </div>
          ) : options.length === 0 ? (
            <div className="px-3 py-2.5 text-[13px] font-medium text-slate-400">No matches — type to search</div>
          ) : (
            options.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => pick(o)}
                className="flex w-full flex-col items-start gap-0.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-indigo-50"
              >
                <span className="text-[14px] font-medium text-slate-800">{o.label}</span>
                {o.sub && <span className="text-[11px] font-medium text-slate-400">{o.sub}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
