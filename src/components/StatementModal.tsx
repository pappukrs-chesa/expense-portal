import { useMemo, useState } from 'react'
import type { Expense } from '../types'

const fmtINR = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (s: string | null) => {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const statusLabel = (s: string) =>
  s === 'submitted' ? 'Pending' : s === 'PostedToSAP' ? 'Invoiced' : s.charAt(0).toUpperCase() + s.slice(1)

const PERIODS = [
  { key: 'month', label: 'This Month' },
  { key: '30', label: 'Last 30 Days' },
  { key: '90', label: 'Last 90 Days' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
] as const
type PeriodKey = (typeof PERIODS)[number]['key']

type Props = { open: boolean; onClose: () => void; rows: Expense[]; concernName: string }

export default function StatementModal({ open, onClose, rows, concernName }: Props) {
  const [period, setPeriod] = useState<PeriodKey>('30')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [generating, setGenerating] = useState(false)

  const range = useMemo(() => {
    const to = new Date()
    let from: Date | null = new Date()
    if (period === 'month') from = new Date(to.getFullYear(), to.getMonth(), 1)
    else if (period === '30') from.setDate(to.getDate() - 30)
    else if (period === '90') from.setDate(to.getDate() - 90)
    else if (period === 'all') from = null
    else if (period === 'custom') {
      from = start ? new Date(start) : null
      return { from, to: end ? new Date(end) : to }
    }
    return { from, to }
  }, [period, start, end])

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        const d = r.bill_date ? new Date(r.bill_date) : r.created_at ? new Date(r.created_at) : null
        if (!d || isNaN(d.getTime())) return true
        if (range.from && d < range.from) return false
        if (range.to && d > new Date(range.to.getTime() + 86400000)) return false
        return true
      })
      .sort((a, b) => new Date(b.bill_date || 0).getTime() - new Date(a.bill_date || 0).getTime())
  }, [rows, range])

  const totals = useMemo(() => {
    const t = { total: 0, count: filtered.length, pending: 0, paid: 0, approved: 0, rejected: 0 }
    for (const r of filtered) {
      const a = Number(r.amount || 0)
      t.total += a
      if (r.status === 'submitted') t.pending += a
      else if (r.status === 'paid') t.paid += a
      else if (r.status === 'rejected') t.rejected += a
      else t.approved += a
    }
    return t
  }, [filtered])

  const periodLabel = PERIODS.find((p) => p.key === period)?.label || ''

  const downloadPDF = async () => {
    const el = document.getElementById('ep-statement-content')
    if (!el) return
    setGenerating(true)
    try {
      const [{ default: html2canvas }, jspdf] = await Promise.all([import('html2canvas'), import('jspdf')])
      const jsPDF = jspdf.jsPDF
      const clone = el.cloneNode(true) as HTMLElement
      clone.style.position = 'fixed'
      clone.style.left = '-9999px'
      clone.style.top = '0'
      clone.style.width = '760px'
      clone.style.maxHeight = 'none'
      clone.style.overflow = 'visible'
      clone.style.background = '#ffffff'
      document.body.appendChild(clone)
      await new Promise((r) => setTimeout(r, 100))
      const canvas = await html2canvas(clone, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true })
      document.body.removeChild(clone)

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgW = pageW - 10
      const imgH = (canvas.height * imgW) / canvas.width
      const usableH = pageH - 10
      if (imgH <= usableH) {
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5, imgW, imgH)
      } else {
        const pageCanvasH = (usableH / imgH) * canvas.height
        let srcY = 0
        let first = true
        while (srcY < canvas.height) {
          const sliceH = Math.min(pageCanvasH, canvas.height - srcY)
          const pc = document.createElement('canvas')
          pc.width = canvas.width
          pc.height = sliceH
          pc.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
          if (!first) pdf.addPage()
          pdf.addImage(pc.toDataURL('image/png'), 'PNG', 5, 5, imgW, (sliceH * imgW) / canvas.width)
          srcY += sliceH
          first = false
        }
      }
      pdf.save(`expense-statement-${period}.pdf`)
    } finally {
      setGenerating(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm animate-fade sm:items-center" onClick={onClose}>
      <div className="max-h-[94dvh] w-full overflow-hidden rounded-t-3xl bg-white shadow-card-lg animate-sheet sm:max-w-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Expense Statement</h3>
            <p className="text-[12px] text-slate-500">Download your expenses as a PDF</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: '70dvh' }}>
          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 transition ${
                  period === p.key ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {period === 'custom' && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-[14px] outline-none focus:border-indigo-500" />
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-[14px] outline-none focus:border-indigo-500" />
            </div>
          )}

          <div id="ep-statement-content" className="mt-4 rounded-2xl border border-slate-200 p-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-lg font-bold text-slate-900">Chesa Dental Care</div>
                <div className="text-[13px] text-slate-500">Expense Statement</div>
              </div>
              <div className="text-right text-[12px] text-slate-500">
                <div className="font-semibold text-slate-700">{concernName}</div>
                <div>{periodLabel}</div>
                <div>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2 text-center">
              {[
                ['Total', fmtINR(totals.total), 'text-slate-800'],
                ['Pending', fmtINR(totals.pending), 'text-amber-600'],
                ['Approved', fmtINR(totals.approved), 'text-blue-600'],
                ['Paid', fmtINR(totals.paid), 'text-emerald-600'],
                ['Rejected', fmtINR(totals.rejected), 'text-rose-600'],
              ].map(([k, v, c]) => (
                <div key={k} className="rounded-xl bg-slate-50 px-2 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</div>
                  <div className={`mt-0.5 text-[13px] font-bold ${c}`}>{v}</div>
                </div>
              ))}
            </div>

            <table className="mt-4 w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="py-2">#</th>
                  <th className="py-2">Date</th>
                  <th className="py-2">Category</th>
                  <th className="py-2">Vendor</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-400">No expenses in this period.</td></tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-400">{r.id}</td>
                      <td className="py-1.5">{fmtDate(r.bill_date)}</td>
                      <td className="py-1.5 font-medium text-slate-800">{r.category}</td>
                      <td className="py-1.5 text-slate-600">{r.vendor || '—'}</td>
                      <td className="py-1.5 text-right font-semibold text-slate-900">{fmtINR(Number(r.amount || 0))}</td>
                      <td className="py-1.5 text-slate-600">{statusLabel(r.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="mt-4 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-400">
              System-generated statement · Chesa Dental Care · {new Date().getFullYear()}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 px-5 py-4">
          <button
            onClick={() => void downloadPDF()}
            disabled={generating || filtered.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl gradient-brand py-3 text-[14px] font-semibold text-white shadow-brand transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {generating ? 'Generating PDF…' : 'Download Statement (PDF)'}
          </button>
        </div>
      </div>
    </div>
  )
}
