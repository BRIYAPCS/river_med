import { Link } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
      <Link to="/" className="flex items-center gap-2 no-underline">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--primary)' }}>
          <span className="text-white font-bold text-sm">R</span>
        </div>
        <span className="font-bold text-base" style={{ color: 'var(--text-h)' }}>River Med</span>
      </Link>

      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-xl transition-colors hover:bg-gray-100"
          style={{ color: 'var(--text)' }} aria-label="Notifications">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm text-white"
          style={{ background: 'var(--primary)' }}>
          AJ
        </div>
      </div>
    </header>
  )
}
