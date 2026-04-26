import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isValidPhoneNumber } from 'react-phone-number-input'
import { useAuth } from '../../context/AuthContext'
import { registerPatient, verifyOtp, requestOtp } from '../../services/api'
import PhoneInput from '../../components/PhoneInput'

// ─── design tokens ────────────────────────────────────────────────────────────

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

// ─── helpers ──────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
      <span className="mt-px flex-shrink-0">⚠</span>
      <span>{message}</span>
    </div>
  )
}

// ─── EyeIcon / EyeOffIcon ─────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

// ─── PasswordField — with show/hide toggle ───────────────────────────────────

function PasswordField({ label, value, onChange, placeholder, borderColor, autoFocus }) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          type={visible ? 'text' : 'password'}
          autoFocus={autoFocus}
          placeholder={placeholder ?? '••••••••'}
          value={value}
          onChange={onChange}
          style={{ ...inputStyle, paddingRight: 42, borderColor: borderColor ?? 'var(--border)' }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible(v => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text)' }}>
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  )
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

const OTP_SECONDS = 15 * 60

function useCountdown(startSeconds) {
  const [secs, setSecs] = useState(startSeconds)
  useEffect(() => {
    if (secs <= 0) return
    const t = setInterval(() => setSecs(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [secs])
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return { secs, display: `${m}:${String(s).padStart(2, '0')}`, reset: () => setSecs(startSeconds) }
}

// ─── Step 1 — Registration form ───────────────────────────────────────────────

function RegistrationStep({ onRegistered }) {
  const [firstName,      setFirstName]      = useState('')
  const [middleName,     setMiddleName]     = useState('')
  const [lastName,       setLastName]       = useState('')
  const [secondLastName, setSecondLastName] = useState('')
  const [email,          setEmail]          = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [phone,     setPhone]     = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  const emailInvalid = emailTouched && email && !EMAIL_RE.test(email)
  const passwordsMatch = !confirm || password === confirm

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!firstName.trim() || !lastName.trim())
      return setError('First name and last name are required.')
    if (!email.trim())
      return setError('Email address is required.')
    if (!EMAIL_RE.test(email.trim()))
      return setError('Please enter a valid email address.')
    if (phone && !isValidPhoneNumber(phone))
      return setError('Please enter a valid phone number, or leave it empty.')
    if (!password)
      return setError('Password is required.')
    if (password.length < 8)
      return setError('Password must be at least 8 characters.')
    if (password !== confirm)
      return setError('Passwords do not match.')

    setLoading(true)
    try {
      const res = await registerPatient({
        first_name:       firstName.trim(),
        middle_name:      middleName.trim() || undefined,
        last_name:        lastName.trim(),
        second_last_name: secondLastName.trim() || undefined,
        email:            email.trim().toLowerCase(),
        phone:            phone || undefined,
        password,
      })
      onRegistered({ identifier: email.trim().toLowerCase(), deliveryMethod: res.deliveryMethod })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {/* name — 2×2 grid */}
      <div className="grid grid-cols-2 gap-3">

        {/* First Name — required */}
        <div>
          <label style={labelStyle}>
            First Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            placeholder="John"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Middle Name — optional */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ ...labelStyle, marginBottom: 0 }}>Middle Name</label>
            <span className="text-xs" style={{ color: 'var(--text)' }}>optional</span>
          </div>
          <input
            type="text"
            placeholder="Michael"
            value={middleName}
            onChange={e => setMiddleName(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Last Name — required */}
        <div>
          <label style={labelStyle}>
            Last Name <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Doe"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Second Last Name — optional */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label style={{ ...labelStyle, marginBottom: 0 }}>Second Last Name</label>
            <span className="text-xs" style={{ color: 'var(--text)' }}>optional</span>
          </div>
          <input
            type="text"
            placeholder="Smith"
            value={secondLastName}
            onChange={e => setSecondLastName(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* email */}
      <div>
        <label style={labelStyle}>Email Address</label>
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={() => setEmailTouched(true)}
          style={{
            ...inputStyle,
            borderColor: emailInvalid ? '#fca5a5' : 'var(--border)',
          }}
        />
        {emailInvalid && (
          <p className="text-xs mt-1" style={{ color: '#dc2626' }}>
            Enter a valid email address (e.g. you@example.com)
          </p>
        )}
      </div>

      {/* phone — optional */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label style={{ ...labelStyle, marginBottom: 0 }}>Phone Number</label>
          <span className="text-xs" style={{ color: 'var(--text)' }}>optional — enables phone login</span>
        </div>
        <PhoneInput value={phone} onChange={setPhone} />
      </div>

      {/* password */}
      <PasswordField
        label="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Min. 8 characters"
      />

      {/* confirm — only shown once user starts typing */}
      {password.length > 0 && (
        <PasswordField
          label="Confirm Password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Re-enter password"
          borderColor={!passwordsMatch ? '#fca5a5' : 'var(--border)'}
        />
      )}
      {!passwordsMatch && (
        <p className="text-xs -mt-2" style={{ color: '#dc2626' }}>Passwords do not match</p>
      )}

      <ErrorBanner message={error} />

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white mt-1"
        style={{
          background: 'var(--primary)',
          opacity:    loading ? 0.6 : 1,
          cursor:     loading ? 'not-allowed' : 'pointer',
        }}>
        {loading ? <><Spinner /> Creating account…</> : 'Create Account'}
      </button>
    </form>
  )
}

// ─── Step 2 — OTP verification ────────────────────────────────────────────────

function VerifyStep({ identifier, deliveryMethod, onVerified, onStartOver }) {
  const [code,      setCode]      = useState('')
  const [loading,   setLoading]   = useState(false)
  const [resending, setResending] = useState(false)
  const [error,     setError]     = useState(null)
  const [resent,    setResent]    = useState(false)
  const countdown = useCountdown(OTP_SECONDS)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await verifyOtp(identifier, code.trim(), 'register')
      onVerified(token, user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setResending(true)
    setError(null)
    setResent(false)
    try {
      await requestOtp(identifier, 'register')
      setResent(true)
      setCode('')
      countdown.reset()
    } catch (err) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {resent ? (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(16,185,129,0.08)', color: '#059669' }}>
          ✓ New code sent — check the backend terminal.
        </div>
      ) : (
        <div className="px-4 py-3 rounded-xl text-sm"
          style={{ background: 'rgba(37,99,235,0.06)', color: 'var(--text)' }}>
          A 6-digit code was sent to{' '}
          <strong style={{ color: 'var(--text-h)' }}>{identifier}</strong>.
        </div>
      )}

      <div>
        <label style={labelStyle}>Verification Code</label>
        <input
          type="text"
          inputMode="numeric"
          required
          autoFocus
          maxLength={6}
          placeholder="123456"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ ...inputStyle, letterSpacing: '0.25em', fontSize: 22, textAlign: 'center' }}
        />
        <div className="mt-1.5">
          {countdown.secs > 0 ? (
            <p className="text-xs font-medium"
              style={{ color: countdown.secs < 60 ? '#dc2626' : 'var(--text)' }}>
              ⏱ Expires in{' '}
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{countdown.display}</span>
            </p>
          ) : (
            <p className="text-xs font-semibold" style={{ color: '#dc2626' }}>
              ⚠ Code expired — click Resend below
            </p>
          )}
        </div>
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
        {loading ? <><Spinner /> Verifying…</> : 'Verify & Continue'}
      </button>

      <div className="flex items-center justify-between pt-1">
        <button type="button" onClick={handleResend} disabled={resending}
          className="text-xs font-medium"
          style={{ color: 'var(--primary)', opacity: resending ? 0.5 : 1 }}>
          {resending ? 'Sending…' : '↻ Resend code'}
        </button>
        <button type="button" onClick={onStartOver}
          className="text-xs font-medium" style={{ color: 'var(--text)' }}>
          ← Start over
        </button>
      </div>
    </form>
  )
}

// ─── RegisterPatient ──────────────────────────────────────────────────────────

export default function RegisterPatient() {
  const { login } = useAuth()
  const navigate  = useNavigate()
  const [step,    setStep]    = useState('register')
  const [regInfo, setRegInfo] = useState(null)

  function handleRegistered(info) { setRegInfo(info); setStep('verify') }
  function handleStartOver()      { setStep('register'); setRegInfo(null) }
  function handleVerified(token, user) { login(token, user); navigate('/patient', { replace: true }) }

  const isVerify = step === 'verify'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ background: '#f8fafc' }}>
      <div className="w-full max-w-sm">

        {/* logo */}
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
            style={{ background: 'var(--primary)' }}>
            <span className="text-white font-bold text-2xl">R</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-h)' }}>
            {isVerify ? 'Verify Account' : 'Create Account'}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>
            {isVerify ? 'Enter the code we sent you' : 'Patient portal access'}
          </p>
        </div>

        {/* step indicators */}
        <div className="flex items-center gap-2 mb-5">
          {['Details', 'Verify'].map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{
                  background: i === 0 || isVerify ? 'var(--primary)' : 'var(--border)',
                  color:      i === 0 || isVerify ? '#fff'            : 'var(--text)',
                }}>
                {i === 0 && isVerify ? '✓' : i + 1}
              </div>
              <span className="text-xs font-medium"
                style={{ color: (isVerify || i === 0) ? 'var(--text-h)' : 'var(--text)' }}>
                {label}
              </span>
              {i === 0 && <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {/* card */}
        <div className="bg-white rounded-2xl border p-7"
          style={{ borderColor: 'var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>
          {step === 'register'
            ? <RegistrationStep onRegistered={handleRegistered} />
            : <VerifyStep
                identifier={regInfo.identifier}
                deliveryMethod={regInfo.deliveryMethod}
                onVerified={handleVerified}
                onStartOver={handleStartOver}
              />
          }
        </div>

        <p className="text-center text-sm mt-5" style={{ color: 'var(--text)' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold no-underline"
            style={{ color: 'var(--primary)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
