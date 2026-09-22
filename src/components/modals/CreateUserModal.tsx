import React, { useState } from 'react';
import { X, UserPlus, Shield, CheckCircle, Copy, AlertCircle } from 'lucide-react';
import { UserRole, Tutor } from '../../types';
import { registerFirebaseUserWithProfile } from '../../services/dataService';
import { SUPPORTED_COUNTRIES, COMMON_TIMEZONES, detectUserLocation } from '../../utils/timezone';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  availableTutors: Tutor[];
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  availableTutors
}) => {
  const detected = detectUserLocation();
  const [role, setRole] = useState<UserRole>('student');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('student123');

  // Student specific
  const [studentId, setStudentId] = useState(`STU-${Math.floor(100 + Math.random() * 900)}`);
  const [country, setCountry] = useState(detected.country);
  const [timezone, setTimezone] = useState(detected.timezone);
  const [courseType, setCourseType] = useState('Nazra with Tajweed');
  const [assignedTutorId, setAssignedTutorId] = useState(availableTutors[0]?.tutorId || 'Tutor 1');
  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');

  // Tutor specific
  const [tutorId, setTutorId] = useState(`Tutor ${availableTutors.length + 1}`);
  const [hourlyRate, setHourlyRate] = useState(12);
  const [zoomLink, setZoomLink] = useState('https://zoom.us/j/islamictuition-room');
  const [qualifications, setQualifications] = useState('Alim / Qari certified in Hafs');

  // Supervisor specific
  const [department, setDepartment] = useState('Academic Quality & Timetables');

  // State feedback
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    uid: string;
    email: string;
    role: string;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'admin') setPassword('admin123');
    else if (newRole === 'supervisor') setPassword('supervisor123');
    else if (newRole === 'tutor') setPassword('tutor123');
    else if (newRole === 'student') setPassword('student123');
    else if (newRole === 'parent') setPassword('parent123');
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      let profileData: any = {};
      if (role === 'student') {
        profileData = {
          studentId,
          country,
          timezone,
          courseType,
          assignedTutorId,
          parentName: parentName || `${name}'s Parent`,
          parentEmail: parentEmail || `parent.${email}`,
          trialSessionsCompleted: 0,
          status: 'Trial'
        };
      } else if (role === 'tutor') {
        profileData = {
          tutorId,
          realName: name,
          hourlyRate: Number(hourlyRate),
          zoomLink,
          qualifications,
          status: 'Active'
        };
      } else if (role === 'supervisor') {
        profileData = {
          department
        };
      } else if (role === 'parent') {
        profileData = {
          parentName: name,
          linkedStudentIds: [studentId]
        };
      }

      const res = await registerFirebaseUserWithProfile({
        email,
        password,
        displayName: name,
        role,
        profileData
      });

      setSuccessResult({
        uid: res.uid,
        email: res.email,
        role: res.role,
        name: res.displayName
      });

      await onSuccess();
    } catch (err: any) {
      console.error('Registration failed:', err);
      setErrorMsg(err.message || 'Failed to register user in Firebase.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!successResult) return;
    const text = `IslamicTuition Login Credentials:\nRole: ${successResult.role.toUpperCase()}\nName: ${successResult.name}\nEmail: ${successResult.email}\nPassword: ${password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-[#E3DFD7] flex items-center justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#2D8B5C]/10 text-[#2D8B5C] flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">
                Register New Firebase Auth User
              </h3>
              <p className="text-xs text-[#5A6B61]">
                Admin-only server-grade account creation & role profile initialization in Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#5A6B61] hover:bg-gray-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {successResult ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <CheckCircle className="w-5 h-5 text-[#2D8B5C]" />
                  <span>User Successfully Created in Firebase Auth & Firestore!</span>
                </div>
                <p className="text-xs text-emerald-800">
                  Authentication UID and role profile metadata have been safely committed. The user can now log into their dedicated portal.
                </p>
                <div className="bg-white p-3 rounded-lg border border-emerald-200 text-xs font-mono space-y-1 mt-2">
                  <p><strong>UID:</strong> {successResult.uid}</p>
                  <p><strong>Name:</strong> {successResult.name}</p>
                  <p><strong>Email:</strong> {successResult.email}</p>
                  <p><strong>Role:</strong> {successResult.role.toUpperCase()}</p>
                  <p><strong>Initial Password:</strong> {password}</p>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleCopyCredentials}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Credentials'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSuccessResult(null);
                    setName('');
                    setEmail('');
                    setStudentId(`STU-${Math.floor(100 + Math.random() * 900)}`);
                  }}
                  className="px-4 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Register Another User
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block font-semibold text-[#161F1A] mb-1.5">
                  Select User Role
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['admin', 'supervisor', 'tutor', 'student', 'parent'] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => handleRoleChange(r)}
                      className={`py-2 px-2.5 rounded-lg font-semibold capitalize border transition-all cursor-pointer text-center text-xs ${
                        role === r
                          ? 'bg-[#2D8B5C] text-white border-[#2D8B5C] shadow-xs'
                          : 'bg-[#FAF9F7] text-[#5A6B61] border-[#D5D0C6] hover:bg-gray-100'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* General Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#161F1A] mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Zayd Abdullah"
                    className="w-full border border-[#D5D0C6] rounded-lg p-2 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#161F1A] mb-1">
                    Email Address (Login Identity)
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@islamictuition.us"
                    className="w-full border border-[#D5D0C6] rounded-lg p-2 bg-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#161F1A] mb-1">
                  Initial Password
                </label>
                <input
                  type="text"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-[#D5D0C6] rounded-lg p-2 bg-white font-mono"
                />
              </div>

              {/* Role-Specific Fields */}
              {role === 'student' && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-3">
                  <span className="font-bold text-[#161F1A] block">
                    Student Specific Profile Metadata
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[#5A6B61] mb-1">Student ID</label>
                      <input
                        type="text"
                        required
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#5A6B61] mb-1">Country</label>
                      <select
                        value={country}
                        onChange={(e) => {
                          const newCountry = e.target.value;
                          setCountry(newCountry);
                          const matched = SUPPORTED_COUNTRIES.find(c => c.name === newCountry);
                          if (matched && !COMMON_TIMEZONES.some(t => t.value === timezone && t.country === newCountry)) {
                            setTimezone(matched.defaultTimezone);
                          }
                        }}
                        className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white text-xs"
                      >
                        {SUPPORTED_COUNTRIES.map(c => (
                          <option key={c.code} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#5A6B61] mb-1">Timezone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white font-mono text-[11px]"
                      >
                        {COMMON_TIMEZONES.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#5A6B61] mb-1">Course Type</label>
                      <select
                        value={courseType}
                        onChange={(e) => setCourseType(e.target.value)}
                        className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white"
                      >
                        <option value="Nazra with Tajweed">Nazra with Tajweed</option>
                        <option value="Hifz ul Quran">Hifz ul Quran</option>
                        <option value="Tafseer & Islamic Studies">Tafseer & Islamic Studies</option>
                        <option value="Quranic Arabic Basics">Quranic Arabic Basics</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[#5A6B61] mb-1">Assigned Tutor</label>
                      <select
                        value={assignedTutorId}
                        onChange={(e) => setAssignedTutorId(e.target.value)}
                        className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white"
                      >
                        {availableTutors.map((t, idx) => (
                          <option key={`${t.id || t.tutorId}_${idx}`} value={t.tutorId}>
                            {t.realName} ({t.tutorId})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#5A6B61] mb-1">Parent Name</label>
                      <input
                        type="text"
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        placeholder="e.g. Tariq Abdullah"
                        className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[#5A6B61] mb-1">Parent Email</label>
                      <input
                        type="email"
                        value={parentEmail}
                        onChange={(e) => setParentEmail(e.target.value)}
                        placeholder="parent@example.com"
                        className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {role === 'tutor' && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-3">
                  <span className="font-bold text-[#161F1A] block">
                    Tutor Faculty Profile Metadata
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[#5A6B61] mb-1">Tutor Public ID</label>
                      <input
                        type="text"
                        required
                        value={tutorId}
                        onChange={(e) => setTutorId(e.target.value)}
                        className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[#5A6B61] mb-1">Hourly Rate (USD)</label>
                      <input
                        type="number"
                        min="5"
                        max="100"
                        required
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#5A6B61] mb-1">Permanent Zoom Link</label>
                    <input
                      type="url"
                      required
                      value={zoomLink}
                      onChange={(e) => setZoomLink(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[#5A6B61] mb-1">Qualifications / Ijazah</label>
                    <input
                      type="text"
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white"
                    />
                  </div>
                </div>
              )}

              {role === 'supervisor' && (
                <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-2">
                  <span className="font-bold text-[#161F1A] block">
                    Supervisor Operations Scope
                  </span>
                  <div>
                    <label className="block text-[#5A6B61] mb-1">Assigned Department</label>
                    <input
                      type="text"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full border border-[#D5D0C6] rounded-lg p-1.5 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] disabled:opacity-50 text-white rounded-lg font-bold flex items-center space-x-2 cursor-pointer shadow-xs"
                >
                  <Shield className="w-4 h-4" />
                  <span>{loading ? 'Creating in Firebase...' : 'Register User & Profile'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
