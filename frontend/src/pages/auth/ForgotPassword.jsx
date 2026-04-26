import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../services/api'

// ─── shared primitives ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  )
}

function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(239,68,68,0.08)', color: '#dc2626' }}>
      <span className="mt-px">⚠</span>
      <span>{message}</span>
    </div>
  )
}

const inputStyle = {
  width:        '100%',
  padding:      '10px 14px',
  borderRadius: 12,
  border:       '1px solid var(--border)',
  color:        'var(--text-h)',
  background:   '#f8fafc',
  fontSize:     14,
  outline:      'none',
}

const labelStyle = {
  display:       'block',
  fontSize:      11,
  fontWeight:    600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color:         'var(--text)',
  marginBottom:   6,
}

// ─── Request step ─────────────────────────────────────────────────────────────

function RequestStep({ onSent }) {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await forgotPassword(email.trim())
      onSent(email.trim())
    } catch (err) {
      // Network / server errors only — the backend returns success even for unknown emails
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text)' }}>
        Enter your account email and we'll send a reset link valid for 15 minutes.
      </p>

      <div>
        <label style={labelStyle}>Email address</label>
        <input
          type="email"
          required
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
      </div>

      <ErrorBanner message={error} />

      <button
        type="submit"
        disabled={loading || !email}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
        style={{
          background: 'var(--primary)',
          opacity:    (loading || !email) ? 0.6 : 1,
          cursor:     (loading || !email) ? 'not-allowed' : 'pointer',
        }}>
        {loading ? <><Spinner /> Sending…</> : 'Send Reset Link'}
      </button>
    </form>
  )
}

// ─── Sent confirmation ────────────────────────────────────────────────────────

function SentScreen({ email }) {
  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
        style={{ background: 'rgba(16,185,129,0.12)' }}>
        ✉
      </div>
      <div>
        <p className="font-bold text-base mb-1" style={{ color: 'var(--text-h)' }}>
          Check your inbox
        </p>
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          If <strong>{email}</strong> is linked to a River Med account, a reset
          link was sent. It expires in 15 minutes.
        </p>
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--text)' }}>
        Didn't receive it? Check your spam folder or{' '}
        <button
          onClick={() => window.location.reload()}
          className="font-semibold underline"
          style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
          try again
        </button>
        .
      </p>
    </div>
  )
}

// ─── ForgotPassword ───────────────────────────────────────────────────────────

export default function ForgotPassword() {
  const [step,  setStep]  = useState('request')   // 'request' | 'sent'
  const [email, setEmail] = useState('')

  function handleSent(sentTo) {
    setEmail(sentTo)
    setStep('sent')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#f8fafc' }}>
      <div className="w-full max-w-sm">

        {/* logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
            style={{ background: 'var(--primary)' }}>
            <span className="text-white font-bold text-2xl">R</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-h)' }}>
            {step === 'sent' ? 'Email sent' : 'Forgot Password?'}
          </h1>
          {step === 'request' && (
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>River Med account recovery</p>
          )}
        </div>

        {/* card */}
        <div className="bg-white rounded-2xl border p-8"
          style={{ borderColor: 'var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          {step === 'request'
            ? <RequestStep onSent={handleSent} />
            : <SentScreen email={email} />
          }
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text)' }}>
          Remembered it?{' '}
          <Link to="/login" className="font-semibold no-underline"
            style={{ color: 'var(--primary)' }}>
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
