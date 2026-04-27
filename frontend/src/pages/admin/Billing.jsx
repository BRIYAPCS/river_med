import { useState, useEffect, useCallback } from 'react'
import { getInvoices, createInvoice, updateInvoice, deleteInvoice, getPatients } from '../../services/api'

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

function Toast({ msg, onDismiss }) {
  if (!msg) return null
  const err = msg.startsWith('Error')
  return (
    <div onClick={onDismiss} className="fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white cursor-pointer"
      style={{ background: err ? '#dc2626' : '#059669' }}>
      {err ? '⚠ ' : '✓ '}{msg}
    </div>
  )
}

const STATUS_COLOR = {
  draft:  { bg: '#f1f5f9', color: '#64748b' },
  sent:   { bg: '#dbeafe', color: '#1d4ed8' },
  paid:   { bg: '#d1fae5', color: '#065f46' },
  void:   { bg: '#fee2e2', color: '#991b1b' },
}

const inp = { width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid var(--border)', background: '#f8fafc', fontSize: 14, color: 'var(--text-h)', outline: 'none' }
const lbl = { display: 'block', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)', marginBottom: 4 }

// ─── CreateInvoiceForm ────────────────────────────────────────────────────────

function CreateInvoiceForm({ patients, onCreated, onCancel }) {
  const [form, setForm] = useState({ patient_id: '', due_date: '', notes: '' })
  const [items, setItems] = useState([{ description: '', qty: 1, price: '' }])
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState(null)

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setItem(i, k, v) { setItems(s => s.map((it, idx) => idx === i ? { ...it, [k]: v } : it)) }
  function addItem() { setItems(s => [...s, { description: '', qty: 1, price: '' }]) }
  function removeItem(i) { setItems(s => s.filter((_, idx) => idx !== i)) }

  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    const valid = items.filter(it => it.description && Number(it.price) > 0)
    if (!valid.length) { setError('Add at least one line item with a price.'); return }
    setSaving(true); setError(null)
    try {
      const res = await createInvoice({
        patient_id:    Number(form.patient_id),
        line_items:    valid.map(it => ({ description: it.description, qty: Number(it.qty) || 1, price: Number(it.price) })),
        due_date:      form.due_date || null,
        notes:         form.notes   || null,
      })
      onCreated(res.invoice)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border p-6 flex flex-col gap-4"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

      <h3 className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>New Invoice</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label style={lbl}>Patient *</label>
          <select required style={inp} value={form.patient_id} onChange={e => setF('patient_id', e.target.value)}>
            <option value="">Select patient…</option>
            {patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Due Date</label>
          <input type="date" style={inp} value={form.due_date} onChange={e => setF('due_date', e.target.value)} />
        </div>
      </div>

      {/* line items */}
      <div>
        <label style={lbl}>Line Items</label>
        <div className="flex flex-col gap-2">
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input style={{ ...inp, flex: 3 }} placeholder="Description" value={it.description}
                onChange={e => setItem(i, 'description', e.target.value)} />
              <input type="number" min="1" style={{ ...inp, width: 70 }} placeholder="Qty" value={it.qty}
                onChange={e => setItem(i, 'qty', e.target.value)} />
              <input type="number" min="0" step="0.01" style={{ ...inp, width: 100 }} placeholder="Price"
                value={it.price} onChange={e => setItem(i, 'price', e.target.value)} />
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(i)} className="text-xs text-red-500 font-bold px-2">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addItem}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border self-start"
            style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}>
            + Add Item
          </button>
        </div>
        <div className="text-right text-sm font-bold mt-2" style={{ color: 'var(--text-h)' }}>
          Total: {fmtMoney(total)}
        </div>
      </div>

      <div>
        <label style={lbl}>Notes</label>
        <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={form.notes}
          onChange={e => setF('notes', e.target.value)} />
      </div>

      {error && <p className="text-sm px-3 py-2 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>{error}</p>}

      <div className="flex gap-3 justify-end">
        <button type="button" onClick={onCancel} className="px-5 py-2 rounded-xl text-sm font-semibold border"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Cancel</button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white"
          style={{ background: '#6366f1', opacity: saving ? 0.6 : 1 }}>
          {saving ? <><Spinner /> Creating…</> : 'Create Invoice'}
        </button>
      </div>
    </form>
  )
}

// ─── InvoiceRow ───────────────────────────────────────────────────────────────

function printInvoice(inv) {
  const items = Array.isArray(inv.line_items) ? inv.line_items : JSON.parse(inv.line_items || '[]')
  const w = window.open('', '_blank', 'width=650,height=750')
  w.document.write(`<!DOCTYPE html><html><head><title>Invoice #${inv.id}</title>
<style>
  body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:580px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
  .clinic{font-size:22px;font-weight:bold;color:#6366f1}
  .inv-num{font-size:13px;color:#666;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:20px}
  th{text-align:left;font-size:11px;text-transform:uppercase;color:#888;padding:8px 0;border-bottom:2px solid #e5e7eb}
  td{padding:10px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
  .total-row td{font-weight:bold;font-size:15px;border-top:2px solid #e5e7eb;border-bottom:none;color:#111}
  .status{display:inline-block;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;background:#d1fae5;color:#065f46}
  .footer{margin-top:32px;font-size:11px;color:#aaa;text-align:center}
  @media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <div><div class="clinic">River Med Clinic</div><div class="inv-num">Invoice #${inv.id}</div></div>
  <div style="text-align:right;font-size:12px;color:#666">
    <div>Patient: <strong>${inv.patient_name ?? '—'}</strong></div>
    <div>Date: ${fmtDate(inv.created_at)}</div>
    ${inv.due_date ? `<div>Due: ${fmtDate(inv.due_date)}</div>` : ''}
    <div style="margin-top:6px"><span class="status">${inv.status.toUpperCase()}</span></div>
  </div>
</div>
<table>
  <thead><tr><th>Description</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>
    ${items.map(it => `<tr><td>${it.description}</td><td style="text-align:right">${it.qty}</td><td style="text-align:right">$${Number(it.price).toFixed(2)}</td><td style="text-align:right">$${(it.qty * it.price).toFixed(2)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="3">Total</td><td style="text-align:right">$${Number(inv.amount).toFixed(2)}</td></tr>
  </tbody>
</table>
${inv.notes ? `<p style="margin-top:20px;font-size:12px;color:#555">${inv.notes}</p>` : ''}
<div class="footer">River Med Clinic · Thank you for your trust in us.</div>
</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
}

function InvoiceRow({ inv, onUpdate, onDelete }) {
  const [updating, setUpdating] = useState(false)
  const sc = STATUS_COLOR[inv.status] ?? STATUS_COLOR.draft
  const items = (() => { try { return Array.isArray(inv.line_items) ? inv.line_items : JSON.parse(inv.line_items || '[]') } catch { return [] } })()

  async function changeStatus(status) {
    setUpdating(true)
    try { const res = await updateInvoice(inv.id, { status }); onUpdate(res.invoice) }
    catch { /* toast shown above */ }
    finally { setUpdating(false) }
  }

  async function handleDelete() {
    if (!confirm(`Delete invoice #${inv.id}?`)) return
    try { await deleteInvoice(inv.id); onDelete(inv.id) } catch { /* silent */ }
  }

  return (
    <div className="bg-white rounded-2xl border p-4 flex flex-col gap-3"
      style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-bold" style={{ color: 'var(--text-h)' }}>#{inv.id} — {inv.patient_name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={sc}>{inv.status}</span>
          </div>
          <div className="text-xs" style={{ color: 'var(--text)' }}>
            {fmtDate(inv.created_at)}{inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ''}
          </div>
        </div>
        <div className="text-base font-bold" style={{ color: 'var(--text-h)' }}>{fmtMoney(inv.amount)}</div>
      </div>

      {items.length > 0 && (
        <div className="text-xs" style={{ color: 'var(--text)' }}>
          {items.map((it, i) => <span key={i} className="inline-block mr-3">{it.description} × {it.qty}</span>)}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {inv.status !== 'paid'  && <button onClick={() => changeStatus('paid')}  disabled={updating} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: '#d1fae5', color: '#065f46' }}>Mark Paid</button>}
        {inv.status !== 'sent'  && inv.status !== 'paid' && inv.status !== 'void' && <button onClick={() => changeStatus('sent')} disabled={updating} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: '#dbeafe', color: '#1d4ed8' }}>Send</button>}
        {inv.status !== 'void'  && inv.status !== 'paid' && <button onClick={() => changeStatus('void')} disabled={updating} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: '#fee2e2', color: '#991b1b' }}>Void</button>}
        <button onClick={() => printInvoice(inv)} className="text-xs px-3 py-1.5 rounded-lg border font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text-h)' }}>Print</button>
        {inv.status !== 'paid' && <button onClick={handleDelete} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ color: '#dc2626' }}>Delete</button>}
      </div>
    </div>
  )
}

// ─── AdminBilling ─────────────────────────────────────────────────────────────

export default function AdminBilling() {
  const [invoices,  setInvoices]  = useState([])
  const [patients,  setPatients]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [toast,     setToast]     = useState(null)
  const [filter,    setFilter]    = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getInvoices()
      setInvoices(Array.isArray(data) ? data : [])
    } catch (err) {
      setToast('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { getPatients().then(setPatients).catch(() => {}) }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function handleCreated(inv) {
    setInvoices(prev => [inv, ...prev])
    setShowForm(false)
    setToast('Invoice created.')
  }
  function handleUpdate(inv) { setInvoices(prev => prev.map(i => i.id === inv.id ? inv : i)) }
  function handleDelete(id)  { setInvoices(prev => prev.filter(i => i.id !== id)) }

  const STATUSES = ['all', 'draft', 'sent', 'paid', 'void']
  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter)

  const totals = {
    total:   invoices.reduce((s, i) => s + Number(i.amount), 0),
    paid:    invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0),
    pending: invoices.filter(i => ['draft','sent'].includes(i.status)).reduce((s, i) => s + Number(i.amount), 0),
  }

  return (
    <div className="flex flex-col gap-6">
      <Toast msg={toast} onDismiss={() => setToast(null)} />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Billing</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>Create and manage patient invoices</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: '#6366f1' }}>
            + New Invoice
          </button>
        )}
      </div>

      {/* summary cards */}
      {invoices.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[['Total Billed', totals.total, '#6366f1'], ['Paid', totals.paid, '#059669'], ['Pending', totals.pending, '#d97706']].map(([label, val, color]) => (
            <div key={label} className="bg-white rounded-2xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text)' }}>{label}</p>
              <p className="text-xl font-bold mt-1" style={{ color }}>{fmtMoney(val)}</p>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <CreateInvoiceForm patients={patients} onCreated={handleCreated} onCancel={() => setShowForm(false)} />
      )}

      {/* status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="text-xs px-3 py-1.5 rounded-full font-semibold border transition-all"
            style={{
              borderColor: filter === s ? '#6366f1' : 'var(--border)',
              background:  filter === s ? 'rgba(99,102,241,0.10)' : '#fff',
              color:       filter === s ? '#6366f1' : 'var(--text)',
            }}>
            {s === 'all' ? `All (${invoices.length})` : s}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center justify-center gap-2 py-12" style={{ color: 'var(--text)' }}><Spinner /> Loading…</div>}

      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="text-5xl opacity-20">💳</span>
          <p className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>No invoices{filter !== 'all' ? ` with status "${filter}"` : ' yet'}</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex flex-col gap-4">
          {filtered.map(inv => (
            <InvoiceRow key={inv.id} inv={inv} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
