import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { loginWithPassword, requestOtp, verifyOtp } from '../../services/api'

// ─── constants ────────────────────────────────────────────────────────────────

const ROLE_HOME = { admin: '/admin', doctor: '/doctor', patient: '/patient' }

// ─── helpers ──────────────────────────────────────────────────────────────────

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
  width:       '100%',
  padding:     '10px 14px',
  borderRadius: 12,
  border:      '1px solid var(--border)',
  color:       'var(--text-h)',
  background:  '#f8fafc',
  fontSize:    14,
  outline:     'none',
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

// ─── IdentifierField ──────────────────────────────────────────────────────────
// Auto-detects email vs phone as the user types.
//   • starts with a digit → phone mode: country-code selector slides in,
//     value sent to API = dialCode + local digits (e.g. "+503 7890-1234" → "+50378901234")
//   • contains '@'        → email mode: plain input, value sent as-is
//   • empty / other       → idle: plain input, wide placeholder

const DEFAULT_DIAL = '+503'

const DIAL_CODES = [
  { dial: '+503', flag: '🇸🇻', name: 'El Salvador'   },
  { dial: '+1',   flag: '🇺🇸', name: 'USA / Canada'  },
  { dial: '+52',  flag: '🇲🇽', name: 'México'        },
  { dial: '+502', flag: '🇬🇹', name: 'Guatemala'     },
  { dial: '+504', flag: '🇭🇳', name: 'Honduras'      },
  { dial: '+505', flag: '🇳🇮', name: 'Nicaragua'     },
  { dial: '+506', flag: '🇨🇷', name: 'Costa Rica'    },
  { dial: '+507', flag: '🇵🇦', name: 'Panamá'        },
  { dial: '+34',  flag: '🇪🇸', name: 'España'        },
  { dial: '+44',  flag: '🇬🇧', name: 'UK'            },
  { dial: '+49',  flag: '🇩🇪', name: 'Germany'       },
  { dial: '+33',  flag: '🇫🇷', name: 'France'        },
  { dial: '+39',  flag: '🇮🇹', name: 'Italy'         },
  { dial: '+55',  flag: '🇧🇷', name: 'Brazil'        },
  { dial: '+54',  flag: '🇦🇷', name: 'Argentina'     },
  { dial: '+57',  flag: '🇨🇴', name: 'Colombia'      },
  { dial: '+56',  flag: '🇨🇱', name: 'Chile'         },
  { dial: '+51',  flag: '🇵🇪', name: 'Perú'          },
  { dial: '+91',  flag: '🇮🇳', name: 'India'         },
  { dial: '+86',  flag: '🇨🇳', name: 'China'         },
  { dial: '+81',  flag: '🇯🇵', name: 'Japan'         },
  { dial: '+82',  flag: '🇰🇷', name: 'South Korea'   },
  { dial: '+61',  flag: '🇦🇺', name: 'Australia'     },
  { dial: '+64',  flag: '🇳🇿', name: 'New Zealand'   },
]

// 'phone' when starts with a digit, 'email' when contains @, 'idle' otherwise
function detectInputMode(raw) {
  if (!raw) return 'idle'
  if (raw.includes('@')) return 'email'
  if (/^\d/.test(raw)) return 'phone'
  return 'idle'
}

function IdentifierField({ value, onChange, autoFocus = false }) {
  const [text,     setText]     = useState(value ?? '')
  const [dialCode, setDialCode] = useState(DEFAULT_DIAL)

  const mode = detectInputMode(text)

  // Compose the value the API actually receives:
  //   phone → dialCode + digits only (strips spaces/dashes)
  //   email / idle → raw text
  function compose(raw, code) {
    return detectInputMode(raw) === 'phone'
      ? code + raw.replace(/[^\d]/g, '')
      : raw
  }

  function handleText(raw) {
    setText(raw)
    onChange(compose(raw, dialCode))
  }

  function handleDial(code) {
    setDialCode(code)
    if (mode === 'phone') onChange(compose(text, code))
  }

  const hintText =
    mode === 'phone' ? `Will send as: ${dialCode}${text.replace(/[^\d]/g, '')}` :
    mode === 'email' ? 'Signing in with email address' :
    'Type your email, or start with a digit to enter a phone number'

  return (
    <div>
      <label style={labelStyle}>Email or phone number</label>

      {/* Unified border box — select + input share one container */}
      <div style={{
        display:      'flex',
        alignItems:   'stretch',
        border:       '1px solid var(--border)',
        borderRadius: 12,
        background:   '#f8fafc',
        overflow:     'hidden',
      }}>
        {/* Country-code selector — only visible in phone mode */}
        {mode === 'phone' && (
          <select
            value={dialCode}
            onChange={e => handleDial(e.target.value)}
            title="Country dial code"
            style={{
              border:      'none',
              borderRight: '1px solid var(--border)',
              background:  'transparent',
              padding:     '10px 8px',
              fontSize:    13,
              cursor:      'pointer',
              outline:     'none',
              color:       'var(--text-h)',
              flexShrink:  0,
            }}
          >
            {DIAL_CODES.map(c => (
              <option key={c.dial} value={c.dial}>
                {c.flag}  {c.dial}  {c.name}
              </option>
            ))}
          </select>
        )}

        <input
          type={mode === 'phone' ? 'tel' : 'text'}
          inputMode={mode === 'phone' ? 'numeric' : 'email'}
          required
          autoFocus={autoFocus}
          placeholder={mode === 'phone' ? '7890-1234' : 'you@example.com'}
          value={text}
          onChange={e => handleText(e.target.value)}
          style={{
            flex:       1,
            border:     'none',
            background: 'transparent',
            padding:    '10px 14px',
            fontSize:   14,
            color:      'var(--text-h)',
            outline:    'none',
            minWidth:   0,
          }}
        />
      </div>

      {/* Contextual hint below the field */}
      <p className="text-xs mt-1 transition-all"
        style={{ color: mode === 'phone' ? 'var(--primary)' : 'var(--text)' }}>
        {hintText}
      </p>
    </div>
  )
}

// ─── Password Tab ─────────────────────────────────────────────────────────────

function PasswordTab({ onSuccess }) {
  const [identifier, setIdentifier] = useState('')
  const [password,   setPassword]   = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await loginWithPassword(identifier?.trim?.() ?? identifier, password)
      onSuccess(token, user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      <IdentifierField value={identifier} onChange={setIdentifier} autoFocus />

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
          <Link to="/forgot-password"
            className="text-xs font-medium no-underline"
            style={{ color: 'var(--primary)' }}>
            Forgot password?
          </Link>
        </div>
        <input
          type="password"
          required
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />
      </div>

      <ErrorBanner message={error} />

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
        style={{
          background: 'var(--primary)',
          opacity:    loading ? 0.6 : 1,
          cursor:     loading ? 'not-allowed' : 'pointer',
        }}>
        {loading ? <><Spinner /> Signing in…</> : 'Sign in'}
      </button>
    </form>
  )
}

// ─── PIN Tab ──────────────────────────────────────────────────────────────────

function PinTab({ onSuccess }) {
  const [identifier, setIdentifier] = useState('')
  const [code,       setCode]       = useState('')
  const [step,       setStep]       = useState('request')   // 'request' | 'verify'
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [info,       setInfo]       = useState(null)

  async function handleRequest(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await requestOtp(identifier.trim(), 'login')
      setInfo('A 6-digit code was sent. Check your email or phone.')
      setStep('verify')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, user } = await verifyOtp(identifier.trim(), code.trim(), 'login')
      onSuccess(token, user)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 'request') {
    return (
      <form onSubmit={handleRequest} className="flex flex-col gap-4">
        <IdentifierField value={identifier} onChange={setIdentifier} autoFocus />

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
          {loading ? <><Spinner /> Sending…</> : 'Send PIN Code'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-4">
      <SuccessBanner message={info} />

      <div>
        <label style={labelStyle}>6-Digit Code</label>
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
        {loading ? <><Spinner /> Verifying…</> : 'Verify Code'}
      </button>

      <button
        type="button"
        onClick={() => { setStep('request'); setCode(''); setError(null); setInfo(null) }}
        className="text-xs text-center font-medium"
        style={{ color: 'var(--text)' }}>
        ← Use a different identifier
      </button>
    </form>
  )
}

// ─── Login ────────────────────────────────────────────────────────────────────

export default function Login() {
  const { login, isAuthenticated, user, loading: authLoading } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [tab, setTab] = useState('password')

  const from = location.state?.from?.pathname

  // Already logged in → skip the form
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      navigate(from || ROLE_HOME[user.role] || '/', { replace: true })
    }
  }, [authLoading, isAuthenticated, user, from, navigate])

  function handleSuccess(token, userObj) {
    login(token, userObj)
    navigate(from || ROLE_HOME[userObj.role] || '/', { replace: true })
  }

  const tabs = [
    { id: 'password', label: 'Password' },
    { id: 'pin',      label: 'PIN / OTP' },
  ]

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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-h)' }}>River Med</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text)' }}>Sign in to your account</p>
        </div>

        {/* card */}
        <div className="bg-white rounded-2xl border p-8"
          style={{ borderColor: 'var(--border)', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>

          {/* tab switcher */}
          <div className="flex rounded-xl mb-6 p-1"
            style={{ background: '#f1f5f9' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: tab === t.id ? '#fff'            : 'transparent',
                  color:      tab === t.id ? 'var(--text-h)'   : 'var(--text)',
                  boxShadow:  tab === t.id ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'password'
            ? <PasswordTab onSuccess={handleSuccess} />
            : <PinTab     onSuccess={handleSuccess} />
          }
        </div>

        {/* footer links */}
        <p className="text-center text-sm mt-6" style={{ color: 'var(--text)' }}>
          New patient?{' '}
          <Link to="/register" className="font-semibold no-underline"
            style={{ color: 'var(--primary)' }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
