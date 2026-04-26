// River Med — Notification Service
//
// Development  (NODE_ENV !== 'production'):
//   OTPs are printed to the terminal in colour — no email/SMS is sent.
//   This lets you test the full OTP flow without a verified domain or Twilio.
//
// Production  (NODE_ENV=production):
//   Emails are sent via Resend.  SMS via Twilio (wire up below).
//   Both require the corresponding env vars to be set.

const isDev = process.env.NODE_ENV !== 'production'

// ── colour helpers ────────────────────────────────────────────────────────────
const C = {
  reset:  '\x1b[0m',
  yellow: '\x1b[33m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
}

// ── Resend client ─────────────────────────────────────────────────────────────
let _resend = null
function getResend() {
  if (!_resend) {
    const { Resend } = require('resend')
    _resend = new Resend(process.env.EMAIL_PROVIDER_API_KEY)
  }
  return _resend
}

const FROM = process.env.EMAIL_FROM || 'River Med <onboarding@resend.dev>'

// ── shared email sender (production only) ────────────────────────────────────

async function sendEmailReal({ to, subject, html, text }) {
  if (!process.env.EMAIL_PROVIDER_API_KEY) {
    throw new Error('EMAIL_PROVIDER_API_KEY is not set.')
  }
  const { error } = await getResend().emails.send({ from: FROM, to, subject, html, text })
  if (error) {
    console.error(`${C.red}[EMAIL ERROR]${C.reset}`, error.message)
    throw new Error(`Email delivery failed: ${error.message}`)
  }
  console.log(`${C.cyan}[EMAIL SENT]${C.reset} → ${to}`)
}

// ── OTP email ─────────────────────────────────────────────────────────────────

async function sendEmailOtp(email, code) {
  // Always log to the server console so admin can find the code in PM2 logs
  // even when email delivery fails (e.g. Resend test sender restriction).
  console.log('')
  console.log(`  ${C.yellow}${C.bold}┌─ OTP EMAIL ──────────────────────────────┐${C.reset}`)
  console.log(`  ${C.yellow}${C.bold}│${C.reset}  To   : ${email}`)
  console.log(`  ${C.yellow}${C.bold}│${C.reset}  Code : ${C.bold}${code}${C.reset}`)
  console.log(`  ${C.yellow}${C.bold}└──────────────────────────────────────────┘${C.reset}`)
  console.log('')

  if (isDev) return   // dev: console only, no real email

  // Production — send via Resend
  // NOTE: onboarding@resend.dev only delivers to your own Resend account email.
  // Add a verified domain in https://resend.com/domains and update EMAIL_FROM
  // in .env so OTPs reach any patient address.
  await sendEmailReal({
    to:      email,
    subject: `${code} is your River Med code`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;color:#08060d">Your verification code</h2>
        <p style="color:#6b6375;margin:0 0 24px">
          Use this code to verify your River Med account.
          It expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;
                    font-size:36px;font-weight:700;letter-spacing:8px;color:#1e3a8a">
          ${code}
        </div>
        <p style="color:#6b6375;font-size:13px;margin:24px 0 0">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>`,
    text: `Your River Med code is ${code}. Expires in 10 minutes.`,
  })
}

// ── Password reset email ───────────────────────────────────────────────────────

async function sendPasswordResetEmail(email, code) {
  if (isDev) {
    console.log('')
    console.log(`  ${C.yellow}${C.bold}┌─ RESET EMAIL ────────────────────────────┐${C.reset}`)
    console.log(`  ${C.yellow}${C.bold}│${C.reset}  To   : ${email}`)
    console.log(`  ${C.yellow}${C.bold}│${C.reset}  Code : ${C.bold}${code}${C.reset}`)
    console.log(`  ${C.yellow}${C.bold}└──────────────────────────────────────────┘${C.reset}`)
    console.log('')
    return
  }

  await sendEmailReal({
    to:      email,
    subject: `${code} — River Med password reset`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;color:#08060d">Reset your password</h2>
        <p style="color:#6b6375;margin:0 0 24px">
          Enter this code in the River Med app to set a new password.
          It expires in <strong>10 minutes</strong>.
        </p>
        <div style="background:#f1f5f9;border-radius:12px;padding:20px;text-align:center;
                    font-size:36px;font-weight:700;letter-spacing:8px;color:#1e3a8a">
          ${code}
        </div>
        <p style="color:#6b6375;font-size:13px;margin:24px 0 0">
          If you didn't request a password reset, ignore this — your password won't change.
        </p>
      </div>`,
    text: `Your River Med password reset code is ${code}. Expires in 10 minutes.`,
  })
}

// ── Password reset link email ─────────────────────────────────────────────────
// Sends a clickable link instead of a 6-digit code.
// The token is embedded in the URL; the frontend page reads it from ?token=...

async function sendPasswordResetLink(email, resetUrl) {
  if (isDev) {
    console.log('')
    console.log(`  ${C.yellow}${C.bold}┌─ RESET LINK ─────────────────────────────┐${C.reset}`)
    console.log(`  ${C.yellow}${C.bold}│${C.reset}  To  : ${email}`)
    console.log(`  ${C.yellow}${C.bold}│${C.reset}  URL : ${C.cyan}${resetUrl}${C.reset}`)
    console.log(`  ${C.yellow}${C.bold}└──────────────────────────────────────────┘${C.reset}`)
    console.log('')
    return
  }

  await sendEmailReal({
    to:      email,
    subject: 'Reset your River Med password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="margin:0 0 8px;color:#08060d">Reset your password</h2>
        <p style="color:#6b6375;margin:0 0 24px">
          Click the button below to set a new password.
          This link expires in <strong>15 minutes</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#1e3a8a;color:#fff;text-decoration:none;
                  padding:14px 28px;border-radius:10px;font-weight:700;font-size:15px">
          Reset Password
        </a>
        <p style="color:#6b6375;font-size:12px;margin:24px 0 8px">
          Or copy this link into your browser:
        </p>
        <p style="color:#6b6375;font-size:12px;word-break:break-all;margin:0">
          ${resetUrl}
        </p>
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>`,
    text: `Reset your River Med password:\n\n${resetUrl}\n\nThis link expires in 15 minutes.`,
  })
}

// ── SMS ───────────────────────────────────────────────────────────────────────
// TODO: replace with Twilio when ready.
//
//   npm install twilio
//   Add to .env: TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER
//
//   const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
//   await twilio.messages.create({
//     body: `Your River Med code is ${code}. Expires in 10 minutes.`,
//     from: process.env.TWILIO_FROM_NUMBER,
//     to:   phone,
//   })

async function sendSmsOtp(phone, code) {
  if (isDev) {
    console.log('')
    console.log(`  ${C.yellow}${C.bold}┌─ OTP SMS ────────────────────────────────┐${C.reset}`)
    console.log(`  ${C.yellow}${C.bold}│${C.reset}  To   : ${phone}`)
    console.log(`  ${C.yellow}${C.bold}│${C.reset}  Code : ${C.bold}${code}${C.reset}`)
    console.log(`  ${C.yellow}${C.bold}└──────────────────────────────────────────┘${C.reset}`)
    console.log('')
    return
  }
  // Production: Twilio not configured yet
  throw new Error('SMS provider not configured. Set TWILIO_* env vars.')
}

module.exports = { sendSmsOtp, sendEmailOtp, sendPasswordResetEmail, sendPasswordResetLink }
