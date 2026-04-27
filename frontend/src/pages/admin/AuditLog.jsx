import { useState, useEffect, useCallback } from 'react'
import { getAuditLog } from '../../services/api'

function fmtTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

function Spinner() {
  return <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
}

const ACTION_COLOR = {
  'invoice.create': '#059669',
  'invoice.update': '#d97706',
  'invoice.delete': '#dc2626',
}

export default function AuditLogPage() {
  const [rows,    setRows]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [page,    setPage]    = useState(0)
  const [search,  setSearch]  = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const LIMIT = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { limit: LIMIT, offset: page * LIMIT }
      if (debouncedSearch) params.action = debouncedSearch
      const data = await getAuditLog(params)
      setRows(data.rows ?? [])
      setTotal(data.total ?? 0)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [page, debouncedSearch])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [debouncedSearch])

  const pages = Math.ceil(total / LIMIT)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Audit Log</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>{total} events recorded</p>
        </div>
        <div style={{ position: 'relative', width: 240 }}>
          <input
            type="text"
            placeholder="Filter by action…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 34px',
              borderRadius: 10, border: '1px solid var(--border)',
              background: '#fff', fontSize: 13, color: 'var(--text-h)', outline: 'none',
            }}
          />
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text)' }}>🔍</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: '#f8fafc' }}>
                {['Time','User','Role','Action','Entity','Details'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Spinner /> Loading…</div>
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text)' }}>
                  No audit events found
                </td></tr>
              )}
              {!loading && rows.map(row => {
                const actionColor = ACTION_COLOR[row.action] ?? '#6366f1'
                let details = ''
                try { details = row.details ? JSON.stringify(JSON.parse(row.details), null, 0).slice(0, 60) : '' } catch { details = String(row.details ?? '') }
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: 'var(--text)' }}>{fmtTime(row.created_at)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-h)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.user_name?.trim() || row.user_email || '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text)' }}>{row.user_role ?? '—'}</span>
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: actionColor }}>{row.action}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text)', whiteSpace: 'nowrap' }}>
                      {row.entity_type ?? '—'}{row.entity_id ? ` #${row.entity_id}` : ''}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span title={details}>{details}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="text-xs px-3 py-1.5 rounded-lg border font-semibold disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>← Prev</button>
            <span className="text-xs" style={{ color: 'var(--text)' }}>Page {page + 1} of {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
              className="text-xs px-3 py-1.5 rounded-lg border font-semibold disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>Next →</button>
          </div>
        )}
      </div>
    </div>
  )
}
