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

// ─── patient profile edit ─────────────────────────────────────────────────────

export async function updateMyPatient(data) {
  return request('PUT', '/patients/me', data)
}

// ─── appointment visit notes ──────────────────────────────────────────────────

export async function saveAppointmentNotes(id, notes) {
  if (!id) throw new Error('saveAppointmentNotes: id is required')
  return request('PUT', `/appointments/${id}/notes`, { notes })
}

// ─── vitals ───────────────────────────────────────────────────────────────────

export async function getAppointmentVitals(appointmentId) {
  if (!appointmentId) throw new Error('getAppointmentVitals: appointmentId is required')
  return request('GET', `/appointments/${appointmentId}/vitals`)
}

export async function recordAppointmentVitals(appointmentId, data) {
  if (!appointmentId) throw new Error('recordAppointmentVitals: appointmentId is required')
  return request('POST', `/appointments/${appointmentId}/vitals`, data)
}

// ─── medical history — allergies ──────────────────────────────────────────────

export async function getAllergies(patientId) {
  const q = patientId ? `?patient_id=${patientId}` : ''
  return request('GET', `/medical/allergies${q}`)
}
export async function createAllergy(data) {
  return request('POST', '/medical/allergies', data)
}
export async function updateAllergy(id, data) {
  if (!id) throw new Error('updateAllergy: id is required')
  return request('PUT', `/medical/allergies/${id}`, data)
}
export async function deleteAllergy(id) {
  if (!id) throw new Error('deleteAllergy: id is required')
  return request('DELETE', `/medical/allergies/${id}`)
}

// ─── medical history — conditions ─────────────────────────────────────────────

export async function getConditions(patientId) {
  const q = patientId ? `?patient_id=${patientId}` : ''
  return request('GET', `/medical/conditions${q}`)
}
export async function createCondition(data) {
  return request('POST', '/medical/conditions', data)
}
export async function updateCondition(id, data) {
  if (!id) throw new Error('updateCondition: id is required')
  return request('PUT', `/medical/conditions/${id}`, data)
}
export async function deleteCondition(id) {
  if (!id) throw new Error('deleteCondition: id is required')
  return request('DELETE', `/medical/conditions/${id}`)
}

// ─── medical history — current medications ────────────────────────────────────

export async function getMedications(patientId) {
  const q = patientId ? `?patient_id=${patientId}` : ''
  return request('GET', `/medical/medications${q}`)
}
export async function createMedication(data) {
  return request('POST', '/medical/medications', data)
}
export async function updateMedication(id, data) {
  if (!id) throw new Error('updateMedication: id is required')
  return request('PUT', `/medical/medications/${id}`, data)
}
export async function deleteMedication(id) {
  if (!id) throw new Error('deleteMedication: id is required')
  return request('DELETE', `/medical/medications/${id}`)
}

// ─── admin user management ────────────────────────────────────────────────────

export async function adminListUsers() {
  return request('GET', '/admin/users')
}
export async function adminUpdateUser(id, data) {
  if (!id) throw new Error('adminUpdateUser: id is required')
  return request('PUT', `/admin/users/${id}`, data)
}
export async function adminToggleUserStatus(id) {
  if (!id) throw new Error('adminToggleUserStatus: id is required')
  return request('PUT', `/admin/users/${id}/status`)
}
export async function adminVerifyUser(id) {
  if (!id) throw new Error('adminVerifyUser: id is required')
  return request('PUT', `/admin/users/${id}/verify`)
}

// ─── doctor profile ───────────────────────────────────────────────────────────

export async function getMyDoctor() {
  return request('GET', '/doctors/me')
}
export async function updateMyDoctor(data) {
  return request('PUT', '/doctors/me', data)
}
export async function getMyAvailability() {
  return request('GET', '/doctors/me/availability')
}
export async function setMyAvailability(slots) {
  return request('PUT', '/doctors/me/availability', slots)
}
export async function getDoctorAvailability(doctorId) {
  if (!doctorId) throw new Error('getDoctorAvailability: doctorId is required')
  return request('GET', `/doctors/${doctorId}/availability`)
}

// ─── notifications ────────────────────────────────────────────────────────────

export async function getNotifications() {
  return request('GET', '/notifications')
}
export async function markNotificationRead(id) {
  if (!id) throw new Error('markNotificationRead: id is required')
  return request('PUT', `/notifications/${id}/read`)
}
export async function markAllNotificationsRead() {
  return request('PUT', '/notifications/read-all')
}

// ─── insurance ────────────────────────────────────────────────────────────────

export async function getInsurance(patientId) {
  const q = patientId ? `?patient_id=${patientId}` : ''
  return request('GET', `/insurance${q}`)
}
export async function upsertInsurance(data) {
  return request('PUT', '/insurance', data)
}

// ─── documents ────────────────────────────────────────────────────────────────

export async function getDocuments(patientId, appointmentId) {
  const params = new URLSearchParams()
  if (patientId)     params.set('patient_id',     patientId)
  if (appointmentId) params.set('appointment_id', appointmentId)
  return request('GET', `/documents?${params}`)
}

export async function uploadDocument(formData) {
  // multipart/form-data — skip the default JSON content-type
  const token = localStorage.getItem('river_med_token')
  const API_BASE = import.meta.env.VITE_API_BASE || '/api'
  const res = await fetch(`${API_BASE}/documents`, {
    method:  'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body:    formData,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? 'Upload failed')
  return data
}

export async function deleteDocument(id) {
  if (!id) throw new Error('deleteDocument: id is required')
  return request('DELETE', `/documents/${id}`)
}

export function documentDownloadUrl(id) {
  const API_BASE = import.meta.env.VITE_API_BASE || '/api'
  const token    = localStorage.getItem('river_med_token')
  return `${API_BASE}/documents/${id}/download?token=${token}`
}

// ─── invoices ─────────────────────────────────────────────────────────────────

export async function getInvoices(patientId) {
  const q = patientId ? `?patient_id=${patientId}` : ''
  return request('GET', `/invoices${q}`)
}
export async function createInvoice(data) {
  return request('POST', '/invoices', data)
}
export async function updateInvoice(id, data) {
  if (!id) throw new Error('updateInvoice: id is required')
  return request('PUT', `/invoices/${id}`, data)
}
export async function deleteInvoice(id) {
  if (!id) throw new Error('deleteInvoice: id is required')
  return request('DELETE', `/invoices/${id}`)
}

// ─── lab results ──────────────────────────────────────────────────────────────

export async function getLabResults(patientId) {
  const q = patientId ? `?patient_id=${patientId}` : ''
  return request('GET', `/lab_results${q}`)
}
export async function createLabResult(data) {
  return request('POST', '/lab_results', data)
}
export async function updateLabResult(id, data) {
  if (!id) throw new Error('updateLabResult: id is required')
  return request('PUT', `/lab_results/${id}`, data)
}
export async function deleteLabResult(id) {
  if (!id) throw new Error('deleteLabResult: id is required')
  return request('DELETE', `/lab_results/${id}`)
}

// ─── referrals ────────────────────────────────────────────────────────────────

export async function getReferrals(patientId) {
  const q = patientId ? `?patient_id=${patientId}` : ''
  return request('GET', `/referrals${q}`)
}
export async function createReferral(data) {
  return request('POST', '/referrals', data)
}
export async function updateReferralStatus(id, status, notes) {
  if (!id) throw new Error('updateReferralStatus: id is required')
  return request('PUT', `/referrals/${id}/status`, { status, notes })
}

// ─── audit log ────────────────────────────────────────────────────────────────

export async function getAuditLog(params = {}) {
  const q = new URLSearchParams(params).toString()
  return request('GET', `/audit_log${q ? '?' + q : ''}`)
}
