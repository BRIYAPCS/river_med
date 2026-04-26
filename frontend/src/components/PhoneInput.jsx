import PhoneInputLib from 'react-phone-number-input'
import 'react-phone-number-input/style.css'

// Detect the user's country from their browser locale.
// Falls back to 'US' if detection fails.
function detectCountry() {
  try {
    const lang   = navigator.language || navigator.languages?.[0] || 'en-US'
    const region = new Intl.Locale(lang).region
    return region || 'US'
  } catch {
    return 'US'
  }
}

const DEFAULT_COUNTRY = detectCountry()

// ─── PhoneInput ───────────────────────────────────────────────────────────────
// Wrapper around react-phone-number-input that:
//   • auto-detects the user's country from their browser locale
//   • shows a flag + country-code selector
//   • returns an E.164 string  (e.g. "+12025551234") or undefined
//
// Props:
//   value       string | undefined  — E.164 phone number
//   onChange    (value) => void     — called with E.164 or undefined
//   hasError    boolean             — highlights border red when true
//   autoFocus   boolean

export default function PhoneInput({ value, onChange, hasError = false, autoFocus = false }) {
  return (
    <PhoneInputLib
      international
      countryCallingCodeEditable={false}
      defaultCountry={DEFAULT_COUNTRY}
      value={value}
      onChange={onChange}
      placeholder="Phone number"
      autoFocus={autoFocus}
      className={`rp-input${hasError ? ' rp-input--error' : ''}`}
    />
  )
}
