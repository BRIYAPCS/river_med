import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../../services/api'
import PhoneInput from '../../components/PhoneInput'

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

function SuccessBanner({ message }) {
  if (!message) return null
  return (
    <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
      <span className="mt-px">✓</span>
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

// ─── Step 1 — Request reset code ──────────────────────────────────────────────

function RequestStep({ onSent }) {
  const [identifier, setIdentifier] = useState('')
  const [mode,       setMode]       = useState('email')   // 'email' | 'phone'
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  function switchMode(next) {
    setMode(next)
    setIdentifier('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const id = identifier?.trim?.() ?? identifier
      await forgotPassword(id)
      onSent(id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text)' }}>
        Enter the email or phone number on your account and we'll send a reset code.
      </p>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            {mode === 'email' ? 'Email' : 'Phone number'}
          </label>
          <div className="flex rounded-lg overflow-hidden border text-xs font-semibold"
            style={{ borderColor: 'var(--border)' }}>
            {['email', 'phone'].map(m => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                className="px-2.5 py-1 capitalize transition-colors"
                style={{
                  background: mode === m ? 'var(--primary)' : '#fff',
                  color:      mode === m ? '#fff'            : 'var(--text)',
                }}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {mode === 'email' ? (
          <input
            type="email"
            required
            autoFocus
            placeholder="you@example.com"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            style={inputStyle}
          />
        ) : (
          <PhoneInput value={identifier} onChange={setIdentifier} autoFocus />
        )}
      </div>

      <ErrorBanner message={error} />

      <button
        type="submit"
        disabled={loading || !identifier}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
        style={{
          background: 'var(--primary)',
          opacity:    (loading || !identifier) ? 0.6 : 1,
          cursor:     (loading || !identifier) ? 'not-allowed' : 'pointer',
        }}>
        {loading ? <><Spinner /> Sending…</> : 'Send Reset Code'}
      </button>
    </form>
  )
}

// ─── Step 2 — Enter code + new password ───────────────────────────────────────

function ResetStep({ identifier, onSuccess }) {
  const [code,        setCode]        = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      return setError('Password must be at least 8 characters.')
    }
    if (newPassword !== confirm) {
      return setError('Passwords do not match.')
    }

    setLoading(true)
    try {
      await resetPassword(identifier, code.trim(), newPassword)
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="px-4 py-3 rounded-xl text-sm"
        style={{ background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
        ✓ Reset code sent to {identifier}. Check your email or phone.
      </div>

      <div>
        <label style={labelStyle}>Reset Code</label>
        <input
          type="text"
          inputMode="numeric"
          required
          autoFocus
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ ...inputStyle, letterSpacing: '0.2em', fontSize: 20, textAlign: 'center' }}
        />
        <p className="text-xs mt-1.5" style={{ color: 'var(--text)' }}>
          Code expires in 10 minutes.
        </p>
      </div>

      <div>
        <label style={labelStyle}>New Password</label>
        <input
          type="password"
          required
          placeholder="••••••••"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Confirm New Password</label>
        <input
          type="password"
          required
          placeholder="••••••••"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          style={inputStyle}
        />
      </div>

      <ErrorBanner message={error} />

      <button
        type="submit"
        disabled={loading || code.length !== 6}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
        style={{
          background: 'var(--primary)',
          opacity:    (loading || code.length !== 6) ? 0.6 : 1,
          cursor:     (loading || code.length !== 6) ? 'not-allowed' : 'pointer',
        }}>
        {loading ? <><Spinner /> Resetting…</> : 'Reset Password'}
      </button>
    </form>
  )
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen() {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
        style={{ background: 'rgba(16,185,129,0.12)' }}>
        ✓
      </div>
      <div>
        <p className="font-bold text-base mb-1" style={{ color: 'var(--text-h)' }}>
          Password reset!
        </p>
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          You can now sign in with your new password.
        </p>
      </div>
      <Link
        to="/login"
        className="mt-2 w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold text-white no-underline"
        style={{ background: 'var(--primary)' }}>
        Go to Sign In
      </Link>
    </div>
  )
}

// ─── ForgotPassword ───────────────────────────────────────────────────────────

export default function ForgotPassword() {
  const [step,       setStep]       = useState('request')   // 'request' | 'reset' | 'done'
  const [identifier, setIdentifier] = useState('')

  function handleSent(id) {
    setIdentifier(id)
    setStep('reset')
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
            {step === 'done' ? 'All done!' : 'Forgot Password?'}
          </h1>
          {step !== 'done' && (
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>River Med account recovery</p>
          )}
        </div>

        {/* card */}
        <div className="bg-white rounded-2xl border p-8"
          style={{ borderColor: 'var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          {step === 'request' && <RequestStep onSent={handleSent} />}
          {step === 'reset'   && (
            <ResetStep
              identifier={identifier}
              onSuccess={() => setStep('done')}
            />
          )}
          {step === 'done' && <SuccessScreen />}
        </div>

        {step !== 'done' && (
          <p className="text-center text-sm mt-6" style={{ color: 'var(--text)' }}>
            Remembered it?{' '}
            <Link to="/login" className="font-semibold no-underline"
              style={{ color: 'var(--primary)' }}>
              Back to Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
