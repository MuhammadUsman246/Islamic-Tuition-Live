import React, { useState, useEffect } from 'react';
import { X, UserPlus, CheckCircle, Key, Shield, CreditCard, Share2 } from 'lucide-react';
import { Student, Tutor, StudentStatus, CourseType, TrialStatus, AllowedCurrency } from '../../types';
import { COMMON_TIMEZONES, SUPPORTED_COUNTRIES } from '../../utils/timezone';
import { ALLOWED_CURRENCIES, getCurrencySymbol } from '../../utils/currency';
import { registerUserAccount, addReferral, getNextSequentialStudentId } from '../../services/dataService';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (studentData: Omit<Student, 'id'>, id?: string) => Promise<void>;
  tutors: Tutor[];
  students?: Student[];
  initialStudent?: Student | null;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  tutors,
  students = [],
  initialStudent
}) => {
  const [studentId, setStudentId] = useState<string>(() => getNextSequentialStudentId(students));
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [parentName, setParentName] = useState<string>('');
  const [parentEmail, setParentEmail] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [assignedTutorId, setAssignedTutorId] = useState<string>('Tutor 1');
  const [status, setStatus] = useState<StudentStatus>('Trial');
  const [courseType, setCourseType] = useState<CourseType>('Quran Reading / Nazra');
  const [country, setCountry] = useState<string>('United States');
  const [timezone, setTimezone] = useState<string>('America/New_York');
  const [monthlyFee, setMonthlyFee] = useState<number | ''>('');
  const [feeCurrency, setFeeCurrency] = useState<AllowedCurrency>('USD');
  const [trialSessionsCompleted, setTrialSessionsCompleted] = useState<number>(0);
  const [trialStatus, setTrialStatus] = useState<TrialStatus>('In Progress');
  const [notes, setNotes] = useState<string>('');
  const [privateAdminNotes, setPrivateAdminNotes] = useState<string>('');
  const [referralSource, setReferralSource] = useState<'None' | 'Existing Student' | 'Existing Parent' | 'Social Media' | 'Google / Search' | 'WhatsApp / Word of Mouth' | 'Website' | 'Other'>('None');
  const [referredByName, setReferredByName] = useState<string>('');
  const [referredByStudentId, setReferredByStudentId] = useState<string>('');
  const [referralRewardAmount, setReferralRewardAmount] = useState<number>(30);
  const [referralStatus, setReferralStatus] = useState<'Pending' | 'Approved' | 'Paid/Applied' | 'Eligible'>('Pending');
  const [createStudentUser, setCreateStudentUser] = useState<boolean>(true);
  const [studentPassword, setStudentPassword] = useState<string>('quran123');
  const [createParentUser, setCreateParentUser] = useState<boolean>(true);
  const [parentPassword, setParentPassword] = useState<string>('parent123');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (initialStudent) {
      setStudentId(initialStudent.studentId);
      setName(initialStudent.name);
      setEmail(initialStudent.email);
      setPhone(initialStudent.phone);
      setParentName(initialStudent.parentName);
      setParentEmail(initialStudent.parentEmail);
      setParentPhone(initialStudent.parentPhone);
      setAssignedTutorId(initialStudent.assignedTutorId);
      setStatus(initialStudent.status);
      setCourseType(initialStudent.courseType);
      setCountry(initialStudent.country);
      setTimezone(initialStudent.timezone);
      setMonthlyFee(initialStudent.monthlyFee !== undefined ? initialStudent.monthlyFee : '');
      setFeeCurrency(initialStudent.feeCurrency || 'USD');
      setTrialSessionsCompleted(initialStudent.trialSessionsCompleted || 0);
      setTrialStatus(initialStudent.trialStatus || 'In Progress');
      setNotes(initialStudent.notes || '');
      setPrivateAdminNotes(initialStudent.privateAdminNotes || '');
      setReferralSource(initialStudent.referralSource || 'None');
      setReferredByName(initialStudent.referredByName || '');
      setReferredByStudentId(initialStudent.referredByStudentId || '');
      setReferralRewardAmount(initialStudent.referralRewardAmount ?? 30);
      setReferralStatus((initialStudent.referralStatus as any) || 'Pending');
    } else {
      setStudentId(getNextSequentialStudentId(students));
      setName('');
      setEmail('');
      setPhone('');
      setParentName('');
      setParentEmail('');
      setParentPhone('');
      if (tutors.length > 0) setAssignedTutorId(tutors[0].tutorId);
      setStatus('Trial');
      setCourseType('Quran Reading / Nazra');
      setCountry('United States');
      setTimezone('America/New_York');
      setMonthlyFee('');
      setFeeCurrency('USD');
      setTrialSessionsCompleted(0);
      setTrialStatus('In Progress');
      setNotes('');
      setPrivateAdminNotes('');
      setReferralSource('None');
      setReferredByName('');
      setReferredByStudentId('');
      setReferralRewardAmount(30);
      setReferralStatus('Pending');
    }
  }, [isOpen, initialStudent, tutors, students]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(
        {
          studentId,
          name,
          email,
          phone,
          parentName,
          parentEmail,
          parentPhone,
          assignedTutorId,
          status,
          courseType,
          country,
          timezone,
          monthlyFee: monthlyFee === '' ? undefined : Number(monthlyFee),
          feeCurrency: feeCurrency || 'USD',
          trialSessionsCompleted,
          trialSessionsTotal: 5,
          trialStatus: status === 'Trial' ? (trialSessionsCompleted >= 5 ? 'Decision Pending' : 'In Progress') : 'Converted',
          referralSource: referralSource !== 'None' ? referralSource : undefined,
          referredByName: referredByName.trim() || undefined,
          referredByStudentId: referredByStudentId.trim() || undefined,
          referralRewardAmount: referralSource !== 'None' ? Number(referralRewardAmount) || 30 : undefined,
          referralStatus: referralSource !== 'None' ? referralStatus : undefined,
          notes,
          privateAdminNotes,
          createdAt: initialStudent?.createdAt || new Date().toISOString()
        },
        initialStudent?.id
      );

      // Record or sync referral in referrals collection if a referrer is specified
      if (referralSource !== 'None' && (referredByName.trim() || referredByStudentId.trim())) {
        const refName = referredByName.trim() || `Student (${referredByStudentId})`;
        await addReferral({
          referrerName: refName,
          referredStudentId: studentId,
          referredStudentName: name.trim(),
          date: new Date().toISOString().slice(0, 10),
          rewardAmount: Number(referralRewardAmount) || 30,
          currency: 'USD',
          status: referralStatus || 'Pending',
          notes: `Referral Source: ${referralSource} | Registered for ${name.trim()} (${studentId})`
        });
      }

      // Register real student login account (Item 12)
      if (createStudentUser && email) {
        await registerUserAccount({
          email: email.trim(),
          password: studentPassword.trim() || 'quran123',
          displayName: name.trim(),
          role: 'student',
          status: 'active',
          studentId: studentId
        });
      }

      // Register real parent login account (Item 12)
      if (createParentUser && parentEmail) {
        await registerUserAccount({
          email: parentEmail.trim(),
          password: parentPassword.trim() || 'parent123',
          displayName: parentName.trim(),
          role: 'parent',
          status: 'active',
          studentId: studentId
        });
      }

      onClose();
    } catch (err: any) {
      alert("Error saving student: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-[#E3DFD7] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#2D8B5C] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-[#E8A93E]" />
            <h3 className="font-bold text-base">
              {initialStudent ? 'Edit Student Profile' : 'Register New Student'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Student ID</label>
              <input
                id="student_id_input"
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-mono font-bold bg-[#FAF9F7]"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Student Full Name</label>
              <input
                id="student_name_input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zayd Al-Farooqi"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
                required
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Student Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Student Phone / WhatsApp</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* Parent Details */}
          <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-3">
            <span className="text-xs font-bold text-[#1E5C3D] uppercase tracking-wider block">
              Parent / Guardian Information
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">Parent Name</label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="e.g. Farooq Ahmed"
                  className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">Parent Email</label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">Parent Phone</label>
                <input
                  type="text"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="+1 555 987 6543"
                  className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Academic Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Assigned Tutor</label>
              <select
                value={assignedTutorId}
                onChange={(e) => setAssignedTutorId(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white"
              >
                {tutors.map((t, idx) => (
                  <option key={`${t.id || t.tutorId}_${idx}`} value={t.tutorId}>{t.tutorId} ({t.realName})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Academic Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StudentStatus)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="Trial">Trial (5 Free Sessions)</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Not Taking">Not Taking</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Course Type</label>
              <select
                value={courseType}
                onChange={(e) => setCourseType(e.target.value as CourseType)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="Noorani Qaida">Noorani Qaida</option>
                <option value="Quran Reading / Nazra">Quran Reading / Nazra</option>
                <option value="Hifz">Hifz</option>
                <option value="Tajweed">Tajweed</option>
                <option value="Salah / Daily Prayers">Salah / Daily Prayers</option>
                <option value="Duas">Duas</option>
                <option value="Ahadith">Ahadith</option>
                <option value="Islamic Studies">Islamic Studies</option>
              </select>
            </div>
          </div>

          {/* Country & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Country</label>
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
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white"
              >
                {SUPPORTED_COUNTRIES.map(c => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Student Local Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white font-mono"
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fee & Currency Selection (Allowed: USD, CAD, GBP, PKR - Item 3) */}
          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#161F1A] flex items-center space-x-1.5">
                <CreditCard className="w-3.5 h-3.5 text-[#2D8B5C]" />
                <span>Tuition Fee & Currency</span>
              </label>
              <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
                Admin-Only Visibility
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[#5A6B61] mb-1">
                  Monthly Fee Amount ({getCurrencySymbol(feeCurrency)})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 font-mono">
                    {getCurrencySymbol(feeCurrency)}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={monthlyFee}
                    onChange={(e) => setMonthlyFee(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 60"
                    className="w-full border border-[#D5D0C6] rounded-lg pl-8 pr-3 py-2 text-xs font-semibold bg-white focus:ring-1 focus:ring-[#2D8B5C]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#5A6B61] mb-1">
                  Currency Selection
                </label>
                <select
                  value={feeCurrency}
                  onChange={(e) => setFeeCurrency(e.target.value as AllowedCurrency)}
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-semibold bg-white focus:ring-1 focus:ring-[#2D8B5C]"
                >
                  {ALLOWED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Trial Sessions Counter (if Trial) */}
          {status === 'Trial' && (
            <div className="p-3 bg-[#FFF9EE] border border-[#E8A93E]/40 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#8C5D08] block">Trial Class Tracking</span>
                <span className="text-[11px] text-[#5A6B61]">5 scheduled sessions total</span>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-xs text-[#161F1A] font-semibold">Completed Sessions:</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={trialSessionsCompleted}
                  onChange={(e) => setTrialSessionsCompleted(parseInt(e.target.value, 10) || 0)}
                  className="w-16 border border-[#D5D0C6] rounded-md px-2 py-1 text-xs text-center font-bold bg-white"
                />
                <span className="text-xs text-[#5A6B61]">/ 5</span>
              </div>
            </div>
          )}

          {/* Referral & Discovery Origin Section */}
          <div className="p-4 bg-[#FAF9F7] border border-[#E3DFD7] rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Share2 className="w-4 h-4 text-[#2D8B5C]" />
                <span className="text-xs font-bold text-[#161F1A]">Referral Origin & Discount Tracking</span>
              </div>
              <span className="text-[10px] text-[#5A6B61] bg-white px-2 py-0.5 rounded border border-[#E3DFD7]">
                Optional Tracking
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                  How did this student join? (Referral Source)
                </label>
                <select
                  value={referralSource}
                  onChange={(e) => {
                    const src = e.target.value as any;
                    setReferralSource(src);
                    if (src === 'None') {
                      setReferredByName('');
                      setReferredByStudentId('');
                    }
                  }}
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white font-medium focus:ring-1 focus:ring-[#2D8B5C]"
                >
                  <option value="None">None / Direct Enrollment</option>
                  <option value="Existing Student">Existing Student (Family / Sibling)</option>
                  <option value="Existing Parent">Existing Parent / Community Member</option>
                  <option value="WhatsApp / Word of Mouth">WhatsApp / Word of Mouth Recommendation</option>
                  <option value="Social Media">Social Media (Facebook / Instagram / TikTok)</option>
                  <option value="Google / Search">Google / Online Search</option>
                  <option value="Website">Academy Website</option>
                  <option value="Other">Other Referral Channel</option>
                </select>
              </div>

              {/* Dynamic Referrer selector or text input */}
              {referralSource === 'Existing Student' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                    Select Referring Student
                  </label>
                  <select
                    value={referredByStudentId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setReferredByStudentId(selectedId);
                      const matchingStudent = students.find(s => s.studentId === selectedId);
                      if (matchingStudent) {
                        setReferredByName(`${matchingStudent.name} (${matchingStudent.studentId})`);
                      }
                    }}
                    className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C]"
                  >
                    <option value="">-- Choose Existing Student --</option>
                    {students
                      .filter(s => s.studentId !== studentId)
                      .map(s => (
                        <option key={s.studentId} value={s.studentId}>
                          {s.name} ({s.studentId}) - Parent: {s.parentName || 'N/A'}
                        </option>
                      ))}
                  </select>
                </div>
              ) : referralSource !== 'None' ? (
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                    Referrer Name / Reference Note
                  </label>
                  <input
                    type="text"
                    value={referredByName}
                    onChange={(e) => setReferredByName(e.target.value)}
                    placeholder="e.g. Tariq Khan / Facebook Campaign / Brother Imran"
                    className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C]"
                  />
                </div>
              ) : null}
            </div>

            {/* If Referral is active, show reward amount & status */}
            {referralSource !== 'None' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#E3DFD7]/80">
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                    Referral Reward / Discount Amount ($ USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 font-mono">$</span>
                    <input
                      type="number"
                      min="0"
                      value={referralRewardAmount}
                      onChange={(e) => setReferralRewardAmount(Number(e.target.value) || 0)}
                      placeholder="30"
                      className="w-full border border-[#D5D0C6] rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                    Referral Status
                  </label>
                  <select
                    value={referralStatus}
                    onChange={(e) => setReferralStatus(e.target.value as any)}
                    className="w-full border border-[#D5D0C6] rounded-lg px-3 py-1.5 text-xs bg-white font-medium"
                  >
                    <option value="Pending">Pending (Awaiting trial conversion)</option>
                    <option value="Approved">Approved (Eligible for next invoice discount)</option>
                    <option value="Paid/Applied">Paid / Applied to Fee Invoice</option>
                    <option value="Eligible">Eligible</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#161F1A] mb-1">General Teaching Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Focus on Tajweed, requires slow recitation..."
              className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
            />
          </div>

          {/* Real User Creation & Login Credentials (Item 12) */}
          <div className="p-4 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-3">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-[#2D8B5C]" />
              <span className="text-xs font-bold text-[#1E5C3D] uppercase tracking-wider">
                User Login Accounts & Credentials Provisioning (Item 12)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Student Account */}
              <div className="bg-white p-3 rounded-lg border border-emerald-200/80 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createStudentUser}
                    onChange={(e) => setCreateStudentUser(e.target.checked)}
                    className="rounded border-[#D5D0C6] text-[#2D8B5C] focus:ring-[#2D8B5C]"
                  />
                  <span className="text-xs font-bold text-[#161F1A]">Create Student Login</span>
                </label>
                {createStudentUser && (
                  <div>
                    <label className="block text-[10px] text-[#5A6B61] mb-1">Student Initial Password</label>
                    <input
                      type="text"
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      placeholder="e.g. quran123"
                      className="w-full border border-[#D5D0C6] rounded-md px-2 py-1 text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Parent Account */}
              <div className="bg-white p-3 rounded-lg border border-emerald-200/80 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createParentUser}
                    onChange={(e) => setCreateParentUser(e.target.checked)}
                    className="rounded border-[#D5D0C6] text-[#2D8B5C] focus:ring-[#2D8B5C]"
                  />
                  <span className="text-xs font-bold text-[#161F1A]">Create Parent Login</span>
                </label>
                {createParentUser && (
                  <div>
                    <label className="block text-[10px] text-[#5A6B61] mb-1">Parent Initial Password</label>
                    <input
                      type="text"
                      value={parentPassword}
                      onChange={(e) => setParentPassword(e.target.value)}
                      placeholder="e.g. parent123"
                      className="w-full border border-[#D5D0C6] rounded-md px-2 py-1 text-xs font-mono"
                    />
                  </div>
                )}
              </div>
            </div>
            <p className="text-[11px] text-[#5A6B61]">
              Students log into the Student Portal; parents log into the Parent Portal to track attendance, fees, and teacher notes.
            </p>
          </div>

          {/* Private Admin Notes (Strictly Admin only!) */}
          <div className="p-3 bg-red-50/50 border border-red-200 rounded-xl">
            <label className="block text-xs font-bold text-red-900 mb-1 flex items-center gap-1">
              <span>Private Admin-Only Notes</span>
              <span className="text-[10px] font-normal text-red-700">(Forbidden to Tutors & Supervisors)</span>
            </label>
            <input
              type="text"
              value={privateAdminNotes}
              onChange={(e) => setPrivateAdminNotes(e.target.value)}
              placeholder="e.g. Special billing arrangement, parent schedule constraints..."
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-xs bg-white"
            />
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-[#E3DFD7] flex items-center justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-[#5A6B61] hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button
              id="submit_student_button"
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-sm flex items-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Student'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
