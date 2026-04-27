import { useState, useEffect, useCallback } from 'react'
import { getInvoices } from '../../services/api'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso))
}
function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}
function Spinner() {
  return <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}

const STATUS_STYLE = {
  draft:  { background: '#f1f5f9', color: '#64748b' },
  sent:   { background: '#dbeafe', color: '#1d4ed8' },
  paid:   { background: '#d1fae5', color: '#065f46' },
  void:   { background: '#fee2e2', color: '#991b1b' },
}

function printInvoice(inv) {
  const items = (() => { try { return Array.isArray(inv.line_items) ? inv.line_items : JSON.parse(inv.line_items || '[]') } catch { return [] } })()
  const w = window.open('', '_blank', 'width=650,height=750')
  w.document.write(`<!DOCTYPE html><html><head><title>Invoice #${inv.id}</title>
<style>
  body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:580px;margin:0 auto}
  .clinic{font-size:22px;font-weight:bold;color:#1e3a8a}.sub{color:#666;font-size:12px;margin-bottom:20px}
  table{width:100%;border-collapse:collapse;margin-top:20px}
  th{text-align:left;font-size:11px;text-transform:uppercase;color:#888;padding:8px 0;border-bottom:2px solid #e5e7eb}
  td{padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
  .total td{font-weight:bold;font-size:15px;border-top:2px solid #ddd;border-bottom:none}
  @media print{body{padding:20px}}
</style></head><body>
<div class="clinic">River Med Clinic</div>
<div class="sub">Invoice #${inv.id} · ${fmtDate(inv.created_at)}${inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ''} · <strong>${inv.status.toUpperCase()}</strong></div>
<table>
  <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>
    ${items.map(it => `<tr><td>${it.description}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">$${Number(it.price).toFixed(2)}</td><td style="text-align:right">$${(it.qty*it.price).toFixed(2)}</td></tr>`).join('')}
    <tr class="total"><td colspan="3">Total</td><td style="text-align:right">$${Number(inv.amount).toFixed(2)}</td></tr>
  </tbody>
</table>
${inv.notes ? `<p style="margin-top:16px;font-size:12px;color:#555">${inv.notes}</p>` : ''}
</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
}

export default function PatientInvoices() {
  const [invoices, setInvoices] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getInvoices()
      setInvoices(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalPaid   = invoices.filter(i => i.status === 'paid').reduce((s,i) => s + Number(i.amount), 0)
  const totalOwed   = invoices.filter(i => ['draft','sent'].includes(i.status)).reduce((s,i) => s + Number(i.amount), 0)

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>My Invoices</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>Billing history from River Med Clinic</p>
      </div>

      {/* summary */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {[['Total Paid', totalPaid, '#059669'], ['Amount Due', totalOwed, '#d97706']].map(([lbl, val, color]) => (
            <div key={lbl} className="bg-white rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text)' }}>{lbl}</p>
              <p className="text-xl font-bold mt-1" style={{ color }}>{fmtMoney(val)}</p>
            </div>
          ))}
        </div>
      )}

      {loading && <div className="flex items-center justify-center gap-2 py-12" style={{ color: 'var(--text)' }}><Spinner /> Loading…</div>}
      {!loading && error && <p className="text-sm px-4 py-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</p>}

      {!loading && !error && invoices.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl opacity-20">💳</span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>No invoices yet</p>
        </div>
      )}

      {!loading && invoices.length > 0 && (
        <div className="flex flex-col gap-4">
          {invoices.map(inv => {
            const items = (() => { try { return Array.isArray(inv.line_items) ? inv.line_items : JSON.parse(inv.line_items || '[]') } catch { return [] } })()
            const sc = STATUS_STYLE[inv.status] ?? STATUS_STYLE.draft
            return (
              <div key={inv.id} className="bg-white rounded-2xl border p-4 flex flex-col gap-2"
                style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>Invoice #{inv.id}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={sc}>{inv.status}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
                      {fmtDate(inv.created_at)}{inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ''}
                    </div>
                  </div>
                  <div className="text-base font-bold" style={{ color: 'var(--text-h)' }}>{fmtMoney(inv.amount)}</div>
                </div>
                {items.length > 0 && (
                  <div className="text-xs" style={{ color: 'var(--text)' }}>
                    {items.map((it, i) => <span key={i} className="inline-block mr-3">{it.description}</span>)}
                  </div>
                )}
                <div>
                  <button onClick={() => printInvoice(inv)}
                    className="text-xs px-3 py-1.5 rounded-lg border font-semibold"
                    style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>
                    Print / Download
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
