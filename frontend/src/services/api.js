// Dev:  VITE_API_BASE is empty → Vite proxy forwards /api → http://localhost:4001
// Prod: VITE_API_BASE=https://briya-api.duckdns.org/api/river (set in .env.production)
const API_BASE = import.meta.env.VITE_API_BASE || '/api'

// ─── token ────────────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('river_med_token')
}

// ─── core request ─────────────────────────────────────────────────────────────

async function request(method, path, body) {
  const url   = `${API_BASE}${path}`
  const token = getToken()

  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }
  if (token)            options.headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) options.body = JSON.stringify(body)

  let res
  try {
    res = await fetch(url, options)
  } catch (networkErr) {
    console.error(`[API] Network error ${method} ${url}:`, networkErr.message)
    throw new Error('Cannot reach the server. Check your connection or try again.')
  }

  let data
  try { data = await res.json() } catch { data = null }

  if (!res.ok) {
    const message = data?.error || data?.message ||
      `${method} ${path} failed — ${res.status} ${res.statusText}`

    const err  = new Error(message)
    err.status = res.status

    // 401 → token is gone or expired. Fire a browser event so AuthContext
    // can call logout() without a direct import cycle.
    if (res.status === 401) {
      console.warn('[API] 401 — session expired or token invalid')
      window.dispatchEvent(new CustomEvent('auth:expired', { detail: { message } }))
    } else {
      console.error(`[API] ${res.status} ${method} ${url}:`, message)
    }

    throw err
  }

  return data
}

// ─── analytics ────────────────────────────────────────────────────────────────

export async function getAnalytics() {
  return request('GET', '/analytics')
}
export async function getAppointmentsPerDay() {
  return request('GET', '/analytics/appointments-per-day')
}
export async function getTopMedications() {
  return request('GET', '/analytics/top-medications')
}
export async function getDoctorLoad() {
  return request('GET', '/analytics/doctor-load')
}

// ─── auth ─────────────────────────────────────────────────────────────────────

export async function registerPatient(data) {
  return request('POST', '/auth/patient/register', data)
}
export async function loginWithPassword(identifier, password) {
  return request('POST', '/auth/login', { identifier, password })
}
export async function requestOtp(identifier, purpose) {
  return request('POST', '/auth/request-otp', { identifier, purpose })
}
export async function verifyOtp(identifier, code, purpose) {
  return request('POST', '/auth/verify-otp', { identifier, code, purpose })
}
export async function forgotPassword(email) {
  return request('POST', '/auth/forgot-password', { email })
}
export async function resetPasswordWithToken(token, newPassword) {
  return request('POST', '/auth/reset-password', { token, newPassword })
}
export async function authMe() {
  return request('GET', '/auth/me')
}
export async function adminCreateStaff(data) {
  return request('POST', '/admin/users', data)
}

// legacy aliases — kept so older components don't break
export async function authLogin(email, password) {
  return request('POST', '/auth/login', { email, password })
}
export async function authRegister(email, password, role) {
  return request('POST', '/auth/register', { email, password, role })
}

// ─── patients ─────────────────────────────────────────────────────────────────

/** Current user's own patient profile (reads patient_id from JWT server-side) */
export async function getMyPatient() {
  return request('GET', '/patients/me')
}
export async function getPatients() {
  return request('GET', '/patients')
}
export async function getPatient(id) {
  if (!id) throw new Error('getPatient: id is required')
  return request('GET', `/patients/${id}`)
}
export async function createPatient(data) {
  return request('POST', '/patients', data)
}

// ─── doctors ──────────────────────────────────────────────────────────────────

export async function getDoctors() {
  return request('GET', '/doctors')
}

// ─── appointments ─────────────────────────────────────────────────────────────

/**
 * Role-aware: patient → own appointments, doctor → assigned, admin → all.
 * Replaces the old getAppointments() for portal dashboards.
 */
export async function getMyAppointments() {
  return request('GET', '/appointments/me')
}
export async function getAppointments() {
  return request('GET', '/appointments')
}
export async function getTodayAppointments() {
  return request('GET', '/appointments/today')
}
export async function getPatientAppointments(patientId) {
  if (!patientId) throw new Error('getPatientAppointments: patientId is required')
  return request('GET', `/appointments/patient/${patientId}`)
}
export async function createAppointment(data) {
  return request('POST', '/appointments', data)
}
export async function updateAppointmentStatus(id, status) {
  if (!id)     throw new Error('updateAppointmentStatus: id is required')
  if (!status) throw new Error('updateAppointmentStatus: status is required')
  return request('PUT', `/appointments/${id}/status`, { status })
}
/** Admin assigns a doctor to an appointment. */
export async function assignAppointment(id, doctor_id) {
  if (!id)        throw new Error('assignAppointment: id is required')
  if (!doctor_id) throw new Error('assignAppointment: doctor_id is required')
  return request('PUT', `/appointments/${id}/assign`, { doctor_id })
}
export async function updateAppointment(id, data) {
  if (!id) throw new Error('updateAppointment: id is required')
  return request('PUT', `/appointments/${id}`, data)
}
/**
 * Patient cancels their own waiting appointment (soft-cancel on the server).
 * Admin hard-deletes via deleteAppointment().
 */
export async function cancelAppointment(id) {
  if (!id) throw new Error('cancelAppointment: id is required')
  return request('DELETE', `/appointments/${id}`)
}
export async function deleteAppointment(id) {
  if (!id) throw new Error('deleteAppointment: id is required')
  return request('DELETE', `/appointments/${id}`)
}

// ─── prescriptions ────────────────────────────────────────────────────────────

/**
 * Role-aware: patient → own prescriptions, doctor → wrote, admin → all.
 */
export async function getMyPrescriptions() {
  return request('GET', '/prescriptions/me')
}
/** Backward-compat: fetch by explicit patientId. */
export async function getPrescriptions(patientId) {
  if (!patientId) throw new Error('getPrescriptions: patientId is required')
  return request('GET', `/prescriptions/${patientId}`)
}
export async function createPrescription(data) {
  return request('POST', '/prescriptions', data)
}
/** Patient requests a refill via the prescriptions shortcut route. */
export async function requestRefill(prescriptionId) {
  if (!prescriptionId) throw new Error('requestRefill: prescriptionId is required')
  return request('POST', `/prescriptions/${prescriptionId}/refill`)
}

// ─── refill requests ──────────────────────────────────────────────────────────

/**
 * Role-aware: patient → own requests, doctor → their prescription refills, admin → all.
 */
export async function getMyRefillRequests() {
  return request('GET', '/refill_requests/me')
}
export async function getPendingRefills() {
  return request('GET', '/refill_requests/pending')
}
/** Backward-compat: fetch by explicit patientId. */
export async function getRefillRequests(patientId) {
  if (!patientId) throw new Error('getRefillRequests: patientId is required')
  return request('GET', `/refill_requests/patient/${patientId}`)
}
export async function createRefillRequest(prescriptionId) {
  if (!prescriptionId) throw new Error('createRefillRequest: prescriptionId is required')
  return request('POST', '/refill_requests', { prescription_id: prescriptionId })
}
export async function updateRefillStatus(id, status, notes = null) {
  if (!id)     throw new Error('updateRefillStatus: id is required')
  if (!status) throw new Error('updateRefillStatus: status is required')
  return request('PUT', `/refill_requests/${id}/status`, { status, notes })
}

// ─── messages ─────────────────────────────────────────────────────────────────

/**
 * Role-aware thread list with unread_count per thread.
 * patient → own threads, doctor → assigned threads, admin → all.
 */
export async function getMessageThreads() {
  return request('GET', '/messages/threads')
}
/** Backward-compat alias. */
export async function getThreads() {
  return request('GET', '/messages/threads')
}

/** Full message history for one (patient, doctor) thread. */
export async function getMessageThread(patientId, doctorId) {
  if (!patientId) throw new Error('getMessageThread: patientId is required')
  if (!doctorId)  throw new Error('getMessageThread: doctorId is required')
  return request('GET', `/messages/thread/${patientId}/${doctorId}`)
}
/** Backward-compat alias. */
export async function getThread(patientId, doctorId) {
  if (!patientId) throw new Error('getThread: patientId is required')
  if (!doctorId)  throw new Error('getThread: doctorId is required')
  return request('GET', `/messages/thread/${patientId}/${doctorId}`)
}

/** Send a message. sender_role is derived server-side from the JWT — do not pass it. */
export async function sendMessage(data) {
  return request('POST', '/messages', data)
}

/** Admin: full message dump. */
export async function getMessages() {
  return request('GET', '/messages')
}

/** Mark a specific message as read. Only the receiver may call this. */
export async function markMessageRead(id) {
  if (!id) throw new Error('markMessageRead: id is required')
  return request('PUT', `/messages/${id}/read`)
}
