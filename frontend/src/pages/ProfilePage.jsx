import Card from '../components/Card'
import Button from '../components/Button'

const profile = {
  name: 'Alex Johnson',
  dob: 'March 14, 1990',
  gender: 'Male',
  bloodType: 'O+',
  phone: '+1 (555) 204-8810',
  email: 'alex.johnson@email.com',
  address: '24 Maple Lane, Chicago, IL 60601',
  insurance: 'BlueCross BlueShield',
  memberId: 'BCB-2024-88102',
  doctor: 'Dr. Sarah Chen',
}

const Field = ({ label, value }) => (
  <div>
    <div className="text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>{label}</div>
    <div className="text-sm font-medium" style={{ color: 'var(--text-h)' }}>{value}</div>
  </div>
)

export default function ProfilePage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-h)' }}>My Profile</h1>
        <p style={{ color: 'var(--text)' }}>Manage your personal and health information.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Card */}
        <Card>
          <div className="flex flex-col items-center text-center py-4">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white mb-4"
              style={{ background: 'var(--primary)' }}>
              {profile.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div className="font-bold text-lg mb-1" style={{ color: 'var(--text-h)' }}>{profile.name}</div>
            <div className="text-sm mb-1" style={{ color: 'var(--text)' }}>{profile.email}</div>
            <span className="badge mt-2">Patient</span>
            <div className="mt-6 w-full">
              <Button className="w-full">Edit Profile</Button>
            </div>
          </div>
        </Card>

        {/* Details */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-h)' }}>Personal Information</h2>
            <div className="grid grid-cols-2 gap-5">
              <Field label="Date of Birth"  value={profile.dob} />
              <Field label="Gender"         value={profile.gender} />
              <Field label="Blood Type"     value={profile.bloodType} />
              <Field label="Phone"          value={profile.phone} />
              <Field label="Address"        value={profile.address} />
              <Field label="Primary Doctor" value={profile.doctor} />
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold mb-5" style={{ color: 'var(--text-h)' }}>Insurance</h2>
            <div className="grid grid-cols-2 gap-5">
              <Field label="Provider"  value={profile.insurance} />
              <Field label="Member ID" value={profile.memberId} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
