const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function reportUrl(type) {
  const token = localStorage.getItem('river_med_token')
  return `${API_BASE}/reports/${type}?token=${token}`
}

const REPORTS = [
  { type: 'appointments',  label: 'Appointments',  icon: '📅', desc: 'All appointments with patient and doctor info' },
  { type: 'patients',      label: 'Patients',       icon: '🏥', desc: 'Full patient roster with contact details' },
  { type: 'prescriptions', label: 'Prescriptions',  icon: '💊', desc: 'All prescriptions written by doctors' },
  { type: 'revenue',       label: 'Revenue',        icon: '💰', desc: 'Monthly billing summary from invoices' },
]

export default function Reports() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-h)' }}>Reports</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text)' }}>Download clinic data as CSV files</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map(r => (
          <a key={r.type} href={reportUrl(r.type)} download
            className="flex items-start gap-4 bg-white rounded-2xl border p-5 transition-all hover:shadow-md no-underline group"
            style={{ borderColor: 'var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <span className="text-3xl flex-shrink-0">{r.icon}</span>
            <div>
              <p className="text-sm font-bold group-hover:underline" style={{ color: 'var(--text-h)' }}>{r.label}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{r.desc}</p>
              <p className="text-xs mt-2 font-semibold" style={{ color: '#6366f1' }}>⬇ Download CSV</p>
            </div>
          </a>
        ))}
      </div>

      <div className="bg-white rounded-2xl border p-5" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text)' }}>Notes</h3>
        <ul className="text-xs flex flex-col gap-1.5" style={{ color: 'var(--text)' }}>
          <li>• All exports are in UTF-8 CSV format, compatible with Excel and Google Sheets.</li>
          <li>• Revenue report requires at least one invoice to have been created.</li>
          <li>• Data is always current at the time of download.</li>
        </ul>
      </div>
    </div>
  )
}
