import { useState, useEffect, useMemo, useCallback } from 'react'
import { api, endpoints, billFileUrl } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import SearchSelect from '../components/SearchSelect'
import StatementModal from '../components/StatementModal'
import { compressImages, describeUploadError, formatMB, MAX_FILE_SIZE } from '../utils/imageCompress'
import type { Expense, Option } from '../types'

const fmtINR = (n: number | string | null) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const fmtDate = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const fileSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`

const initials = (s?: string) =>
  (s || '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'

const catBadge = (s?: string) => {
  const w = (s || '').trim().split(/\s+/).filter(Boolean)
  return ((w[0]?.[0] || '') + (w[1]?.[0] || w[0]?.[1] || '')).toUpperCase() || '₹'
}

const statusMeta = (status: string): { label: string; cls: string; dot: string } => {
  switch (status) {
    case 'submitted':
      return { label: 'Pending Approval', cls: 'bg-amber-50 text-amber-700 ring-amber-200', dot: 'bg-amber-500' }
    case 'approved':
      return { label: 'Approved', cls: 'bg-blue-50 text-blue-700 ring-blue-200', dot: 'bg-blue-500' }
    case 'PostedToSAP':
      return { label: 'Invoiced', cls: 'bg-indigo-50 text-indigo-700 ring-indigo-200', dot: 'bg-indigo-500' }
    case 'paid':
      return { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: 'bg-emerald-500' }
    case 'rejected':
      return { label: 'Rejected', cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: 'bg-rose-500' }
    default:
      return { label: status || '—', cls: 'bg-slate-50 text-slate-600 ring-slate-200', dot: 'bg-slate-400' }
  }
}

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'paid', label: 'Paid' },
  { key: 'rejected', label: 'Rejected' },
] as const

type Tab = (typeof TABS)[number]['key']

const emptyForm = {
  category: '',
  category_gl_code: '',
  vendor: '',
  vendor_card_code: '',
  amount: '',
  bill_date: '',
  bill_description: '',
  remarks: '',
}

export default function Expenses() {
  const { concern, logout } = useAuth()
  const [rows, setRows] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...emptyForm })
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [showStatement, setShowStatement] = useState(false)
  const [showLogout, setShowLogout] = useState(false)

  const setField = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const load = useCallback(async () => {
    if (!concern) return
    setLoading(true)
    try {
      const { data } = await api.get(endpoints.expenses, {
        params: { submitted_by_user_id: concern.mobile, limit: 200 },
      })
      setRows(data?.data || [])
    } catch {
      setToast({ kind: 'err', msg: 'Failed to load your expenses' })
    } finally {
      setLoading(false)
    }
  }, [concern])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  const previews = useMemo(
    () =>
      files.map((f) => ({
        name: f.name,
        size: f.size,
        isImg: f.type.startsWith('image/'),
        url: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
      })),
    [files],
  )
  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews])

  const fetchCategoryOptions = useCallback(async (q: string): Promise<Option[]> => {
    const { data } = await api.get(endpoints.categories, { params: q ? { search: q } : {} })
    return (data?.data || []).map((c: { id: string; name: string; gl_code: string }) => ({
      key: c.id,
      label: c.name,
      raw: c,
    }))
  }, [])

  const fetchVendorOptions = useCallback(async (q: string): Promise<Option[]> => {
    const { data } = await api.get(endpoints.vendors, { params: q ? { search: q } : {} })
    return (data?.data || []).map((v: { id: string; vendor_name: string; card_code: string }) => ({
      key: v.id,
      label: v.vendor_name,
      sub: v.card_code,
      raw: v,
    }))
  }, [])

  const filtered = useMemo(() => {
    if (tab === 'all') return rows
    if (tab === 'pending') return rows.filter((r) => r.status === 'submitted')
    if (tab === 'paid') return rows.filter((r) => r.status === 'paid')
    if (tab === 'rejected') return rows.filter((r) => r.status === 'rejected')
    return rows.filter((r) => r.status && r.status !== 'submitted' && r.status !== 'rejected' && r.status !== 'paid')
  }, [rows, tab])

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((r) => r.status === 'submitted').length,
      approved: rows.filter((r) => r.status && r.status !== 'submitted' && r.status !== 'rejected' && r.status !== 'paid').length,
      paid: rows.filter((r) => r.status === 'paid').length,
      rejected: rows.filter((r) => r.status === 'rejected').length,
    }),
    [rows],
  )

  const wallet = useMemo(() => {
    let total = 0
    let pending = 0
    let progress = 0
    let paid = 0
    for (const r of rows) {
      const a = Number(r.amount || 0)
      total += a
      if (r.status === 'submitted') pending += a
      else if (r.status === 'paid') paid += a
      else if (r.status !== 'rejected') progress += a
    }
    return { total, pending, progress, paid }
  }, [rows])

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => {
      const merged = [...prev]
      for (const f of Array.from(list)) {
        if (!merged.some((x) => x.name === f.name && x.size === f.size)) merged.push(f)
      }
      return merged.slice(0, 5)
    })
  }
  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i))

  const resetForm = () => {
    setForm({ ...emptyForm })
    setFiles([])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!concern) return
    if (!form.category) return setToast({ kind: 'err', msg: 'Select a category' })
    if (!form.amount || Number(form.amount) <= 0) return setToast({ kind: 'err', msg: 'Enter a valid amount' })
    if (!form.bill_date) return setToast({ kind: 'err', msg: 'Select the bill date' })
    if (!files.length && !form.remarks.trim())
      return setToast({ kind: 'err', msg: 'Attach a bill, or add remarks if there is no bill' })

    setSubmitting(true)
    try {
      setOptimizing(true)
      const prepared = await compressImages(files)
      setOptimizing(false)
      const oversize = prepared.find((f) => f.size > MAX_FILE_SIZE)
      if (oversize) {
        return setToast({ kind: 'err', msg: `“${oversize.name}” is ${formatMB(oversize.size)} MB — over the 5 MB limit even after compression. Retake or remove it.` })
      }

      const fd = new FormData()
      fd.append('submitted_by', concern.name)
      fd.append('submitted_by_user_id', concern.mobile)
      fd.append('category', form.category)
      fd.append('gl_code', form.category_gl_code || '')
      fd.append('vendor', form.vendor || '')
      fd.append('vendor_card_code', form.vendor_card_code || '')
      fd.append('amount', form.amount)
      fd.append('bill_date', form.bill_date)
      fd.append('bill_description', form.bill_description || '')
      fd.append('remarks', form.remarks || '')
      prepared.forEach((f) => fd.append('billFile', f))

      await api.post(endpoints.expenses, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setToast({ kind: 'ok', msg: 'Expense submitted for approval' })
      setShowForm(false)
      resetForm()
      void load()
    } catch (err) {
      setToast({ kind: 'err', msg: describeUploadError(err, files.reduce((s, f) => s + f.size, 0)) })
    } finally {
      setSubmitting(false)
      setOptimizing(false)
    }
  }

  return (
    <div className="min-h-dvh gradient-mesh">
      <header className="sticky top-0 z-20 glass border-b border-slate-200/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl gradient-brand text-white shadow-brand">
              <Logo className="h-[18px] w-[18px]" />
            </div>
            <div className="leading-tight">
              <div className="text-[15px] font-bold tracking-tight text-slate-900">Expense Portal</div>
              <div className="text-[12px] text-slate-500">Chesa Dental Care</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2.5 rounded-full border border-slate-200 bg-white/70 py-1 pl-1 pr-3.5 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full gradient-brand text-[12px] font-bold text-white">
                {initials(concern?.name)}
              </span>
              <div className="leading-tight">
                <div className="text-[12.5px] font-semibold text-slate-900">{concern?.name}</div>
                <div className="text-[11px] capitalize text-slate-500">{concern?.role || 'Concern person'}</div>
              </div>
            </div>
            <button
              onClick={() => setShowLogout(true)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 lg:px-6 lg:pb-12">
        <div className="lg:grid lg:grid-cols-[348px_1fr] lg:items-start lg:gap-6">
          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="relative overflow-hidden rounded-3xl gradient-brand p-6 text-white shadow-brand animate-rise">
              <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-violet-300/20 blur-2xl" />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-100">
                    <WalletIcon className="h-[18px] w-[18px]" />
                    <span className="text-[13px] font-medium">Total expenses</span>
                  </div>
                  <button
                    onClick={() => setShowStatement(true)}
                    className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold ring-1 ring-white/15 transition hover:bg-white/25"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Statement
                  </button>
                </div>
                <div className="mt-3 text-[34px] font-extrabold leading-none tnum">{fmtINR(wallet.total)}</div>
                <div className="mt-2 text-[12.5px] text-indigo-100/80">
                  {rows.length} expense{rows.length === 1 ? '' : 's'} · {fmtINR(wallet.paid)} paid back
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2.5">
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                    <div className="text-[10.5px] text-indigo-100">Pending</div>
                    <div className="mt-0.5 text-[15px] font-bold tnum">{fmtINR(wallet.pending)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3 ring-1 ring-white/10">
                    <div className="text-[10.5px] text-indigo-100">In progress</div>
                    <div className="mt-0.5 text-[15px] font-bold tnum">{fmtINR(wallet.progress)}</div>
                  </div>
                  <div className="rounded-2xl bg-emerald-400/20 p-3 ring-1 ring-emerald-300/30">
                    <div className="flex items-center gap-1 text-[10.5px] text-emerald-50">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      Paid
                    </div>
                    <div className="mt-0.5 text-[15px] font-bold tnum text-white">{fmtINR(wallet.paid)}</div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowForm(true)}
              className="hidden w-full items-center justify-center gap-2 rounded-2xl gradient-brand py-3.5 text-[15px] font-semibold text-white shadow-brand transition hover:brightness-105 active:scale-[0.99] lg:flex"
            >
              <PlusIcon className="h-[18px] w-[18px]" />
              New Expense
            </button>

            <div className="hidden rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card lg:block">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" strokeLinecap="round" /></svg>
                </span>
                <p className="text-[12.5px] leading-relaxed text-slate-500">
                  Attach the bill image or PDF for faster approval. No bill? Add a short remark explaining the expense.
                </p>
              </div>
            </div>
          </aside>

          <section className="mt-5 lg:mt-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Your expenses</h2>
              <span className="text-[12px] font-medium text-slate-400">{filtered.length} shown</span>
            </div>

            <div className="mt-3 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/70 bg-white/70 p-1 shadow-card">
              {TABS.map((t) => {
                const active = tab === t.key
                const n = counts[t.key]
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition ${
                      active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {t.label}
                    <span
                      className={`min-w-[18px] rounded-full px-1.5 py-px text-center text-[10.5px] font-bold tnum ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {n}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-3 space-y-3">
              {loading ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 rounded-xl skeleton" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3.5 w-1/2 rounded skeleton" />
                        <div className="h-3 w-1/3 rounded skeleton" />
                      </div>
                      <div className="h-5 w-16 rounded skeleton" />
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-12 text-center animate-fade">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 ring-1 ring-indigo-100">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" /><path d="M9 13h6M9 17h4" strokeLinecap="round" /></svg>
                  </div>
                  <div className="mt-4 text-[15px] font-semibold text-slate-900">
                    {tab === 'all' ? 'No expenses yet' : 'Nothing in this view'}
                  </div>
                  <div className="mt-1 text-[13px] text-slate-500">Submit your first bill to get started.</div>
                  <button
                    onClick={() => setShowForm(true)}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl gradient-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-brand transition hover:brightness-105 active:scale-95"
                  >
                    <PlusIcon className="h-4 w-4" /> New Expense
                  </button>
                </div>
              ) : (
                filtered.map((r) => {
                  const meta = statusMeta(r.status)
                  const url = billFileUrl(r.billImageUrl)
                  return (
                    <div
                      key={r.id}
                      className="group rounded-2xl border border-slate-200/70 bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-lg animate-rise"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 text-[12.5px] font-extrabold text-indigo-600 ring-1 ring-indigo-100">
                          {catBadge(r.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-semibold text-slate-900">{r.category}</div>
                          <div className="mt-0.5 truncate text-[13px] text-slate-500">{r.vendor || 'No vendor'}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[17px] font-bold tnum text-slate-900">{fmtINR(r.amount)}</div>
                          <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${meta.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[12px]">
                        <span className="tnum text-slate-400">#{r.id} · {fmtDate(r.bill_date)}</span>
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:underline">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3h7v7M21 3l-9 9M19 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            View bill
                          </a>
                        ) : (
                          <span className="text-slate-400">No bill</span>
                        )}
                      </div>
                      {r.status === 'rejected' && r.anju_rejected_reason && (
                        <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-100">
                          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" /></svg>
                          <span><span className="font-semibold">Rejected:</span> {r.anju_rejected_reason}</span>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </section>
        </div>
      </main>

      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full gradient-brand px-6 py-3.5 text-[15px] font-semibold text-white shadow-brand transition active:scale-95 lg:hidden"
      >
        <PlusIcon className="h-[18px] w-[18px]" />
        New Expense
      </button>

      {showForm && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm animate-fade sm:items-center"
          onClick={() => !submitting && setShowForm(false)}
        >
          <div
            className="max-h-[94dvh] w-full overflow-hidden rounded-t-3xl bg-white shadow-card-lg animate-sheet sm:max-w-lg sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl gradient-brand text-white">
                  <PlusIcon className="h-[18px] w-[18px]" />
                </span>
                <div className="leading-tight">
                  <h3 className="text-base font-bold text-slate-900">New Expense</h3>
                  <p className="text-[12px] text-slate-500">Submit a bill for approval</p>
                </div>
              </div>
              <button onClick={() => !submitting && setShowForm(false)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
              </button>
            </div>
            <form onSubmit={submit} className="flex max-h-[80dvh] flex-col">
              <div className="space-y-4 overflow-y-auto px-5 py-5">
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Category *</label>
                  <SearchSelect
                    value={form.category}
                    placeholder="Search Ashva expense category"
                    fetchOptions={fetchCategoryOptions}
                    onSelect={(opt) =>
                      setForm((f) => ({
                        ...f,
                        category: opt ? opt.label : '',
                        category_gl_code: opt ? String(opt.raw.gl_code ?? '') : '',
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Vendor</label>
                  <SearchSelect
                    value={form.vendor}
                    placeholder="Search Ashva vendor"
                    fetchOptions={fetchVendorOptions}
                    onSelect={(opt) =>
                      setForm((f) => ({
                        ...f,
                        vendor: opt ? opt.label : '',
                        vendor_card_code: opt ? String(opt.raw.card_code ?? '') : '',
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Amount *</label>
                    <div className="flex items-center rounded-2xl border border-slate-300 bg-white px-3.5 transition focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-100">
                      <span className="text-[15px] font-semibold text-slate-400">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => setField('amount', e.target.value)}
                        placeholder="0.00"
                        className="min-w-0 flex-1 border-none bg-transparent py-3 pl-2 text-[15px] tnum text-slate-900 outline-none placeholder:text-slate-300"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Bill date *</label>
                    <input
                      type="date"
                      value={form.bill_date}
                      onChange={(e) => setField('bill_date', e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Description</label>
                  <input
                    type="text"
                    value={form.bill_description}
                    onChange={(e) => setField('bill_description', e.target.value)}
                    placeholder="Short description"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">
                    Remarks {files.length ? '' : <span className="font-medium text-slate-400">(required if no bill)</span>}
                  </label>
                  <textarea
                    rows={2}
                    value={form.remarks}
                    onChange={(e) => setField('remarks', e.target.value)}
                    placeholder="Justification — required when there is no bill"
                    className="w-full resize-none rounded-2xl border border-slate-300 bg-white px-3.5 py-3 text-[15px] text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 placeholder:text-slate-300"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[13px] font-semibold text-slate-700">Bill files <span className="font-medium text-slate-400">(image / PDF, up to 5)</span></label>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
                    onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                    className={`rounded-2xl border-2 border-dashed px-4 py-5 text-center transition ${
                      dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-slate-50/70'
                    }`}
                  >
                    <input
                      id="ep-files"
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 16V4m0 0L8 8m4-4l4 4M5 20h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                      <div className="text-[13px] text-slate-600">
                        <label htmlFor="ep-files" className="cursor-pointer font-semibold text-indigo-600 hover:underline">Browse files</label>
                        <span className="text-slate-400"> or drag &amp; drop</span>
                      </div>
                      <div className="text-[11px] text-slate-400">Images or PDF · up to 5 files</div>
                    </div>
                  </div>
                  {previews.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2.5">
                      {previews.map((p, i) => (
                        <div key={i} className="group/file relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          {p.isImg ? (
                            <img src={p.url} alt={p.name} className="h-20 w-full object-cover" />
                          ) : (
                            <div className="flex h-20 flex-col items-center justify-center gap-1 text-slate-400">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              <span className="text-[10px] font-semibold">PDF</span>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(i)}
                            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/65 text-white transition hover:bg-rose-600"
                            aria-label="Remove file"
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
                          </button>
                          <div className="truncate bg-white/95 px-1.5 py-1 text-[10px] text-slate-500">{p.name} · {fileSize(p.size)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  disabled={submitting}
                  className="flex-1 rounded-2xl border border-slate-200 py-3 text-[14px] font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[0.99]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-2xl gradient-brand py-3 text-[14px] font-semibold text-white shadow-brand transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
                >
                  {submitting ? <Spinner /> : null}
                  {optimizing ? 'Optimizing…' : submitting ? 'Submitting…' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade"
          onClick={() => setShowLogout(false)}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-card-lg animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h3 className="mt-4 text-center text-[17px] font-bold text-slate-900">Log out?</h3>
            <p className="mt-1 text-center text-[13px] text-slate-500">
              You’ll need to verify your mobile number with an OTP to sign back in.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowLogout(false)}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-[14px] font-semibold text-slate-600 transition hover:bg-slate-50 active:scale-[0.99]"
              >
                Cancel
              </button>
              <button
                onClick={logout}
                className="flex-1 rounded-2xl bg-rose-600 py-3 text-[14px] font-semibold text-white shadow-[0_8px_24px_rgba(225,29,72,0.30)] transition hover:bg-rose-700 active:scale-[0.99]"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}

      <StatementModal
        open={showStatement}
        onClose={() => setShowStatement(false)}
        rows={rows}
        concernName={concern?.name || ''}
      />

      {toast && (
        <div
          className={`fixed left-1/2 top-4 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl px-4 py-3 text-[13px] font-semibold text-white shadow-card-lg animate-rise ${
            toast.kind === 'ok' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          {toast.kind === 'ok' ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          )}
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function Logo({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 12h6M9 16h6" strokeLinecap="round" />
    </svg>
  )
}
function WalletIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 9V7a2 2 0 012-2h12" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="17" cy="13" r="1.4" fill="currentColor" />
    </svg>
  )
}
function PlusIcon({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
}
function Spinner() {
  return <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
}
