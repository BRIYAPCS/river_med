import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPasswordWithToken } from '../../services/api'

// ─── primitives ───────────────────────────────────────────────────────────────

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

// ─── Invalid token screen ─────────────────────────────────────────────────────

function InvalidToken() {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
        style={{ background: 'rgba(239,68,68,0.10)' }}>
        ⚠
      </div>
      <div>
        <p className="font-bold text-base mb-1" style={{ color: 'var(--text-h)' }}>
          Invalid reset link
        </p>
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          This link is missing a reset token. Please use the link from your email,
          or request a new one.
        </p>
      </div>
      <Link to="/forgot-password"
        className="mt-2 w-full flex items-center justify-center py-3 rounded-xl text-sm font-bold text-white no-underline"
        style={{ background: 'var(--primary)' }}>
        Request New Link
      </Link>
    </div>
  )
}

// ─── Reset form ───────────────────────────────────────────────────────────────

function ResetForm({ token, onSuccess }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [showPw,      setShowPw]      = useState(false)
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
      await resetPasswordWithToken(token, newPassword)
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const strength = newPassword.length === 0 ? null
    : newPassword.length < 8  ? 'weak'
    : newPassword.length < 12 ? 'fair'
    : 'strong'

  const strengthColor = { weak: '#ef4444', fair: '#f59e0b', strong: '#10b981' }
  const strengthWidth = { weak: '33%',     fair: '66%',     strong: '100%' }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text)' }}>
        Choose a new password for your River Med account.
      </p>

      <div>
        <label style={labelStyle}>New Password</label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPw ? 'text' : 'password'}
            required
            autoFocus
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            style={{ ...inputStyle, paddingRight: 40 }}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw(v => !v)}
            style={{
              position: 'absolute', right: 12, top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text)', fontSize: 13,
            }}>
            {showPw ? 'Hide' : 'Show'}
          </button>
        </div>

        {/* password strength bar */}
        {strength && (
          <div className="mt-2">
            <div className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all"
                style={{
                  width:      strengthWidth[strength],
                  background: strengthColor[strength],
                }} />
            </div>
            <p className="text-xs mt-1 font-medium capitalize"
              style={{ color: strengthColor[strength] }}>
              {strength}
            </p>
          </div>
        )}
      </div>

      <div>
        <label style={labelStyle}>Confirm Password</label>
        <input
          type={showPw ? 'text' : 'password'}
          required
          placeholder="••••••••"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          style={{
            ...inputStyle,
            borderColor: confirm && confirm !== newPassword ? '#ef4444' : 'var(--border)',
          }}
        />
        {confirm && confirm !== newPassword && (
          <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Passwords do not match</p>
        )}
      </div>

      <ErrorBanner message={error} />

      <button
        type="submit"
        disabled={loading || newPassword.length < 8 || newPassword !== confirm}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
        style={{
          background: 'var(--primary)',
          opacity:    (loading || newPassword.length < 8 || newPassword !== confirm) ? 0.6 : 1,
          cursor:     (loading || newPassword.length < 8 || newPassword !== confirm) ? 'not-allowed' : 'pointer',
        }}>
        {loading ? <><Spinner /> Saving…</> : 'Set New Password'}
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
          Password updated!
        </p>
        <p className="text-sm" style={{ color: 'var(--text)' }}>
          Your password has been reset. You can now sign in with your new password.
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

// ─── ResetPassword ────────────────────────────────────────────────────────────

export default function ResetPassword() {
  const [searchParams]        = useSearchParams()
  const token                 = searchParams.get('token') ?? ''
  const [done, setDone]       = useState(false)

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
            {done ? 'All done!' : 'Set New Password'}
          </h1>
          {!done && (
            <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>River Med account recovery</p>
          )}
        </div>

        {/* card */}
        <div className="bg-white rounded-2xl border p-8"
          style={{ borderColor: 'var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          {done
            ? <SuccessScreen />
            : !token
              ? <InvalidToken />
              : <ResetForm token={token} onSuccess={() => setDone(true)} />
          }
        </div>

        {!done && (
          <p className="text-center text-sm mt-6" style={{ color: 'var(--text)' }}>
            <Link to="/login" className="font-semibold no-underline"
              style={{ color: 'var(--primary)' }}>
              ← Back to Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
