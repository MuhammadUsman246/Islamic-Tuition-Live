import React, { useState, useEffect, useMemo } from 'react';
import { X, UserPlus, CheckCircle, Key, CreditCard, Share2, Calendar, ArrowRight, Plus, Trash2, Users, GraduationCap } from 'lucide-react';
import { Student, Tutor, StudentStatus, CourseType, TrialStatus, AllowedCurrency } from '../../types';
import { COMMON_TIMEZONES, SUPPORTED_COUNTRIES } from '../../utils/timezone';
import { ALLOWED_CURRENCIES, getCurrencySymbol } from '../../utils/currency';
import { registerUserAccount, addReferral, getNextSequentialStudentId, getNextSequentialFamilyId, notifyTrial5SessionsCompleted } from '../../services/dataService';
import { generateStudentEmail, generateParentEmail } from '../../utils/studentEmail';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (studentData: Omit<Student, 'id'>, id?: string) => Promise<void>;
  onSaveAndGoToTimetable?: (studentId: string) => void;
  tutors: Tutor[];
  students?: Student[];
  initialStudent?: Student | null;
}

interface AdditionalChildItem {
  studentId: string;
  name: string;
  age: number | '';
  courseType: CourseType;
  email: string;
  password: string;
}

export const StudentModal: React.FC<StudentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveAndGoToTimetable,
  tutors,
  students = [],
  initialStudent
}) => {
  const [studentId, setStudentId] = useState<string>(() => getNextSequentialStudentId(students));
  const [studentType, setStudentType] = useState<'child' | 'adult'>('child');
  const [familyGroupId, setFamilyGroupId] = useState<string>(() => getNextSequentialFamilyId(students));
  const [familyGroupName, setFamilyGroupName] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [age, setAge] = useState<number | ''>('');
  const [joiningDate, setJoiningDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [parentName, setParentName] = useState<string>('');
  const [parentEmail, setParentEmail] = useState<string>('');
  const [parentPhone, setParentPhone] = useState<string>('');
  const [enrollParentAsStudent, setEnrollParentAsStudent] = useState<boolean>(false);
  const [parentCourseType, setParentCourseType] = useState<CourseType>('Quran Reading / Nazra');
  const [additionalChildren, setAdditionalChildren] = useState<AdditionalChildItem[]>([]);
  const [assignedTutorId, setAssignedTutorId] = useState<string>('Unassigned');
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
  const [referralSource, setReferralSource] = useState<'None' | 'Student / Parent Referral' | 'Facebook Ads' | 'Google Ads' | string>('None');
  const [referredByName, setReferredByName] = useState<string>('');
  const [referredByStudentId, setReferredByStudentId] = useState<string>('');
  const [referralRewardAmount, setReferralRewardAmount] = useState<number>(30);
  const [referralStatus, setReferralStatus] = useState<'Pending' | 'Approved' | 'Paid/Applied' | 'Eligible'>('Pending');
  const [showFeeToStudent, setShowFeeToStudent] = useState<boolean>(true);
  const [createStudentUser, setCreateStudentUser] = useState<boolean>(true);
  const [studentPassword, setStudentPassword] = useState<string>('quran123');
  const [createParentUser, setCreateParentUser] = useState<boolean>(true);
  const [parentPassword, setParentPassword] = useState<string>('parent123');
  const [saving, setSaving] = useState<boolean>(false);

  // Existing families list for quick linking if adding a child to an existing family
  const existingFamilies = useMemo(() => {
    const map = new Map<string, { id: string; name: string; parentName: string; parentEmail: string; count: number }>();
    students.forEach(s => {
      if (s.familyGroupId) {
        const existing = map.get(s.familyGroupId);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(s.familyGroupId, {
            id: s.familyGroupId,
            name: s.familyGroupName || (s.parentName ? `${s.parentName} Family` : s.familyGroupId),
            parentName: s.parentName || '',
            parentEmail: s.parentEmail || '',
            count: 1
          });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  }, [students]);

  // Compute the preview Student ID that will be assigned to the Parent when Dual Mode is checked
  const previewParentStudentId = useMemo(() => {
    const temp: Student[] = [
      ...students,
      { studentId } as Student,
      ...additionalChildren.map(c => ({ studentId: c.studentId } as Student))
    ];
    return getNextSequentialStudentId(temp);
  }, [students, studentId, additionalChildren]);

  useEffect(() => {
    if (initialStudent) {
      setStudentId(initialStudent.studentId);
      setStudentType(initialStudent.studentType || (initialStudent.age && initialStudent.age >= 18 ? 'adult' : 'child'));
      setFamilyGroupId(initialStudent.familyGroupId || getNextSequentialFamilyId(students));
      setFamilyGroupName(initialStudent.familyGroupName || '');
      setName(initialStudent.name);
      setAge(initialStudent.age !== undefined ? initialStudent.age : '');
      setJoiningDate(initialStudent.joiningDate || initialStudent.trialStartDate || initialStudent.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setEmail(initialStudent.email);
      setPhone(initialStudent.phone);
      setParentName(initialStudent.parentName || '');
      setParentEmail(initialStudent.parentEmail || '');
      setParentPhone(initialStudent.parentPhone || '');
      setEnrollParentAsStudent(false);
      setAdditionalChildren([]);
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
      setShowFeeToStudent(initialStudent.showFeeToStudent !== false);
    } else {
      setStudentId(getNextSequentialStudentId(students));
      setStudentType('child');
      setFamilyGroupId(getNextSequentialFamilyId(students));
      setFamilyGroupName('');
      setName('');
      setAge('');
      setJoiningDate(new Date().toISOString().slice(0, 10));
      setEmail('');
      setPhone('');
      setParentName('');
      setParentEmail('');
      setParentPhone('');
      setEnrollParentAsStudent(false);
      setParentCourseType('Quran Reading / Nazra');
      setAdditionalChildren([]);
      setAssignedTutorId('Unassigned');
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
      setShowFeeToStudent(true);
    }
  }, [isOpen, initialStudent, tutors, students]);

  if (!isOpen) return null;

  const handleAddAnotherChild = () => {
    const temp: Student[] = [
      ...students,
      { studentId } as Student,
      ...additionalChildren.map(c => ({ studentId: c.studentId } as Student))
    ];
    const nextStuId = getNextSequentialStudentId(temp);
    setAdditionalChildren(prev => [
      ...prev,
      {
        studentId: nextStuId,
        name: '',
        age: '',
        courseType: courseType || 'Quran Reading / Nazra',
        email: '',
        password: studentPassword || 'quran123'
      }
    ]);
  };

  const handleRemoveAdditionalChild = (idx: number) => {
    setAdditionalChildren(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateAdditionalChild = (idx: number, updates: Partial<AdditionalChildItem>) => {
    setAdditionalChildren(prev => prev.map((item, i) => (i === idx ? { ...item, ...updates } : item)));
  };

  const saveStudentRecord = async (redirectToTimetable: boolean) => {
    if (!name.trim()) {
      alert('Please enter the student full name.');
      return;
    }
    if (studentType === 'child' && !parentName.trim()) {
      alert('Please enter the parent / guardian name for child students.');
      return;
    }
    for (let i = 0; i < additionalChildren.length; i++) {
      if (!additionalChildren[i].name.trim()) {
        alert(`Please enter the full name for Child #${i + 2} or remove the empty child row.`);
        return;
      }
    }

    setSaving(true);
    const finalStudentEmail = email.trim() || generateStudentEmail(name, studentId);
    const finalParentEmail = parentEmail.trim() || generateParentEmail(parentName, studentId);
    const effectiveTutorId = initialStudent ? (initialStudent.assignedTutorId || 'Unassigned') : 'Unassigned';
    const effectiveFamilyId = studentType === 'adult'
      ? (familyGroupId.trim() || undefined)
      : (familyGroupId.trim() || getNextSequentialFamilyId(students));
    const effectiveFamilyName = studentType === 'adult'
      ? (familyGroupName.trim() || undefined)
      : (familyGroupName.trim() || `${parentName.trim()} Family`);

    try {
      // 1. Save Primary Student Record
      await onSave(
        {
          studentId,
          name: name.trim(),
          age: age === '' ? undefined : Number(age),
          studentType,
          familyGroupId: effectiveFamilyId,
          familyGroupName: effectiveFamilyName,
          joiningDate,
          trialStartDate: initialStudent?.trialStartDate || joiningDate,
          email: finalStudentEmail,
          phone,
          parentName: studentType === 'adult' ? '' : parentName.trim(),
          parentEmail: studentType === 'adult' ? '' : finalParentEmail,
          parentPhone: studentType === 'adult' ? '' : parentPhone,
          assignedTutorId: effectiveTutorId,
          status,
          isOnLeave: status === 'On Leave',
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
          showFeeToStudent,
          notes,
          privateAdminNotes,
          createdAt: initialStudent?.createdAt || new Date().toISOString()
        },
        initialStudent?.id
      );

      const allFamilyChildIds: string[] = [studentId];
      const tempStudentPool: Student[] = [...students, { studentId, familyGroupId: effectiveFamilyId } as Student];

      // 2. Save Any Additional Children Added via "+ Add Another Child"
      if (!initialStudent && studentType === 'child' && additionalChildren.length > 0) {
        for (const child of additionalChildren) {
          const cleanChildName = child.name.trim();
          if (!cleanChildName) continue;
          const childStuId = child.studentId.trim() || getNextSequentialStudentId(tempStudentPool);
          tempStudentPool.push({ studentId: childStuId, familyGroupId: effectiveFamilyId } as Student);
          allFamilyChildIds.push(childStuId);
          const childFinalEmail = child.email.trim() || generateStudentEmail(cleanChildName, childStuId);

          await onSave({
            studentId: childStuId,
            name: cleanChildName,
            age: child.age === '' ? undefined : Number(child.age),
            studentType: 'child',
            familyGroupId: effectiveFamilyId,
            familyGroupName: effectiveFamilyName,
            joiningDate,
            trialStartDate: joiningDate,
            email: childFinalEmail,
            phone,
            parentName: parentName.trim(),
            parentEmail: finalParentEmail,
            parentPhone,
            assignedTutorId: effectiveTutorId,
            status,
            isOnLeave: status === 'On Leave',
            courseType: child.courseType || courseType,
            country,
            timezone,
            monthlyFee: monthlyFee === '' ? undefined : Number(monthlyFee),
            feeCurrency: feeCurrency || 'USD',
            trialSessionsCompleted: 0,
            trialSessionsTotal: 5,
            trialStatus: status === 'Trial' ? 'In Progress' : 'Converted',
            showFeeToStudent,
            notes,
            privateAdminNotes,
            createdAt: new Date().toISOString()
          });

          if (createStudentUser) {
            await registerUserAccount({
              email: childFinalEmail,
              password: child.password.trim() || studentPassword.trim() || 'quran123',
              displayName: cleanChildName,
              role: 'student',
              studentType: 'child',
              status: 'active',
              studentId: childStuId,
              familyGroupId: effectiveFamilyId,
              familyGroupName: effectiveFamilyName,
              parentName: parentName.trim(),
              parentEmail: finalParentEmail,
              phone,
              country,
              timezone,
              courseType: child.courseType || courseType
            });
          }
        }
      }

      // 3. If "Enroll Parent as Student Too (Dual Mode)" is checked, create Student Record for Parent
      let parentOwnStudentId: string | undefined = undefined;
      if (!initialStudent && studentType === 'child' && enrollParentAsStudent) {
        parentOwnStudentId = getNextSequentialStudentId(tempStudentPool);
        tempStudentPool.push({ studentId: parentOwnStudentId, familyGroupId: effectiveFamilyId } as Student);
        allFamilyChildIds.push(parentOwnStudentId);

        await onSave({
          studentId: parentOwnStudentId,
          name: parentName.trim(),
          studentType: 'adult',
          familyGroupId: effectiveFamilyId,
          familyGroupName: effectiveFamilyName,
          joiningDate,
          trialStartDate: joiningDate,
          email: finalParentEmail,
          phone: parentPhone || phone,
          parentName: '',
          parentEmail: finalParentEmail,
          parentPhone: parentPhone || phone,
          assignedTutorId: effectiveTutorId,
          status,
          isOnLeave: status === 'On Leave',
          courseType: parentCourseType || courseType,
          country,
          timezone,
          monthlyFee: monthlyFee === '' ? undefined : Number(monthlyFee),
          feeCurrency: feeCurrency || 'USD',
          trialSessionsCompleted: 0,
          trialSessionsTotal: 5,
          trialStatus: status === 'Trial' ? 'In Progress' : 'Converted',
          showFeeToStudent: true,
          notes: notes ? `${notes} (Dual-Role Parent & Student)` : 'Enrolled as Parent & Student (Dual Mode)',
          privateAdminNotes,
          createdAt: new Date().toISOString()
        });
      }

      // Dispatch Trial 5/5 completed push toast if newly reaching 5 sessions
      if (status === 'Trial' && trialSessionsCompleted >= 5 && (initialStudent?.trialSessionsCompleted || 0) < 5) {
        notifyTrial5SessionsCompleted({
          studentId,
          name: name.trim(),
          assignedTutorId: effectiveTutorId,
          courseType,
          parentName: parentName.trim(),
          parentPhone,
          trialSessionsCompleted
        });
      }

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
      if (createStudentUser) {
        await registerUserAccount({
          email: finalStudentEmail,
          password: studentPassword.trim() || 'quran123',
          displayName: name.trim(),
          role: 'student',
          studentType,
          status: 'active',
          studentId: studentId,
          familyGroupId: effectiveFamilyId,
          familyGroupName: effectiveFamilyName,
          parentName: studentType === 'adult' ? '' : parentName.trim(),
          parentEmail: studentType === 'adult' ? '' : finalParentEmail,
          phone,
          country,
          timezone,
          courseType
        });
      }

      // Register real parent login account (Item 12)
      if (studentType === 'child' && (createParentUser || enrollParentAsStudent)) {
        await registerUserAccount({
          email: finalParentEmail,
          password: parentPassword.trim() || 'parent123',
          displayName: parentName.trim() || `${name.trim()}'s Parent`,
          role: 'parent',
          status: 'active',
          ...(parentOwnStudentId ? { studentId: parentOwnStudentId, courseType: parentCourseType || courseType } : {}),
          linkedStudentIds: allFamilyChildIds,
          familyGroupId: effectiveFamilyId,
          familyGroupName: effectiveFamilyName,
          phone: parentPhone || phone,
          country,
          timezone
        });
      }

      onClose();
      if (redirectToTimetable && onSaveAndGoToTimetable) {
        onSaveAndGoToTimetable(studentId);
      }
    } catch (err: any) {
      alert("Error saving student: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveStudentRecord(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-[#E3DFD7] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#2D8B5C] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-[#E8A93E]" />
            <h3 className="font-bold text-base">
              {initialStudent ? 'Edit Student Profile' : 'Student Registration & Enrollment'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Student Category Selector */}
          <div className="p-3 bg-[#FAF9F7] rounded-xl border border-[#D5D0C6] space-y-2">
            <label className="block text-xs font-bold text-[#161F1A]">Student Category</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setStudentType('child');
                  setCreateParentUser(true);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  studentType === 'child'
                    ? 'bg-[#1E5C3D] text-white border-[#1E5C3D] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>🧒</span>
                <span>Child Student (Parent-Managed)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStudentType('adult');
                  setCreateParentUser(false);
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  studentType === 'adult'
                    ? 'bg-[#1E5C3D] text-white border-[#1E5C3D] shadow-xs'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span>🎓</span>
                <span>Adult Student (Self-Managing)</span>
              </button>
            </div>
          </div>

          {/* Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
            <div>
              <label className="block text-xs font-semibold text-[#161F1A] mb-1">Age (Years)</label>
              <input
                id="student_age_input"
                type="number"
                min="1"
                max="100"
                value={age}
                onChange={(e) => setAge(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 0))}
                placeholder="e.g. 10"
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* Joining Date Card - Auto-selected but editable manually */}
          <div className="bg-[#E8F5EE] border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-[#1E5C3D]">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#2D8B5C]" />
              <div>
                <span className="font-bold block">Joining & Trial Start Date:</span>
                <span className="text-[11px] text-emerald-800">Auto-selected (click date input to modify manually if needed)</span>
              </div>
            </div>
            <input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="font-mono font-bold bg-white px-2.5 py-1 rounded-md border border-emerald-300 text-xs text-[#1E5C3D] focus:ring-1 focus:ring-[#2D8B5C] focus:outline-none cursor-pointer shadow-2xs"
              title="Auto-selected — click to pick or change joining date"
            />
          </div>

          {/* Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#161F1A]">Student Email / Login Handle</label>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(generateStudentEmail(name, studentId));
                  }}
                  className="text-[10px] text-[#2D8B5C] hover:underline font-semibold cursor-pointer"
                  title="Generate unique branded student email handle (e.g. ali.stu101@islamictuition.us)"
                >
                  ⚡ Auto-generate ({generateStudentEmail(name, studentId)})
                </button>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={generateStudentEmail(name, studentId)}
                className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs"
              />
              {!email && name.trim() && (
                <button
                  type="button"
                  onClick={() => setEmail(generateStudentEmail(name, studentId))}
                  className="mt-1 text-[11px] text-[#1E5C3D] bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 font-mono flex items-center gap-1 cursor-pointer transition-colors"
                  title="Click to apply recommended unique handle"
                >
                  <span className="text-[10px] text-gray-500">Recommended:</span>
                  <span className="font-bold">{generateStudentEmail(name, studentId)}</span>
                </button>
              )}
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

          {/* Adult Student Mode Info Banner */}
          {studentType === 'adult' ? (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 space-y-1">
              <span className="font-bold block flex items-center gap-1.5">
                <span>🎓</span> Adult Student Mode Active
              </span>
              <p className="text-[11px] leading-relaxed">
                This student manages their own account, timetable, and payments autonomously. Parent / guardian details are omitted and no parent login account will be generated.
              </p>
            </div>
          ) : (
            <>
              {/* Parent Details for Child Students + Dual Mode Checkbox */}
              <div className="p-3.5 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#1E5C3D] uppercase tracking-wider block">
                    Parent / Guardian Information
                  </span>
                  {!initialStudent && (
                    <label className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 cursor-pointer hover:bg-emerald-100/70 transition-colors">
                      <input
                        id="enroll_parent_as_student_checkbox"
                        type="checkbox"
                        checked={enrollParentAsStudent}
                        onChange={(e) => {
                          setEnrollParentAsStudent(e.target.checked);
                          if (e.target.checked) {
                            setCreateParentUser(true);
                          }
                        }}
                        className="rounded text-[#2D8B5C] focus:ring-[#2D8B5C] w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[#1E5C3D] flex items-center gap-1">
                        <GraduationCap className="w-3.5 h-3.5 text-[#2D8B5C]" />
                        <span>Enroll Parent as Student Too (Dual Mode)</span>
                      </span>
                    </label>
                  )}
                </div>

                {!initialStudent && enrollParentAsStudent && (
                  <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-xl space-y-2 text-xs text-emerald-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold flex items-center gap-1.5 text-[#1E5C3D]">
                        <GraduationCap className="w-4 h-4 text-[#2D8B5C]" />
                        <span>Parent Dual-Role Enrollment Active (Parent + Student)</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-white border border-emerald-300 font-mono font-bold text-[11px] text-[#1E5C3D]">
                        Parent Student ID: {previewParentStudentId}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      This parent will be enrolled as a student learner (<strong>{previewParentStudentId}</strong>) alongside their parent account under Family ID <strong>{familyGroupId || getNextSequentialFamilyId(students)}</strong>. They can log in with their normal parent email and use the <strong>Parent Mode / Student Mode</strong> toggle in their dashboard.
                    </p>
                    <div className="pt-1 max-w-xs">
                      <label className="block text-[11px] font-semibold text-[#1E5C3D] mb-1">
                        Parent's Own Course / Curriculum
                      </label>
                      <select
                        value={parentCourseType}
                        onChange={(e) => setParentCourseType(e.target.value as CourseType)}
                        className="w-full border border-emerald-300 rounded-md px-2.5 py-1.5 text-xs bg-white font-medium"
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
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">Parent Name *</label>
                    <input
                      type="text"
                      value={parentName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setParentName(val);
                        if (!familyGroupName.trim() || familyGroupName.endsWith(' Family')) {
                          setFamilyGroupName(val.trim() ? `${val.trim()} Family` : '');
                        }
                      }}
                      placeholder="e.g. Farooq Ahmed"
                      className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white"
                      required={studentType === 'child'}
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

              {/* Family ID & Sibling Grouping (Sequential FAM-1001, FAM-1002, etc.) */}
              <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-bold text-[#1E5C3D] flex items-center gap-1.5">
                    <span>👨‍👩‍👧</span>
                    <span>Family ID & Sibling Grouping (Auto-Sequential)</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFamilyGroupId(getNextSequentialFamilyId(students))}
                      className="text-[10px] font-bold text-[#1E5C3D] bg-white hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 cursor-pointer transition-colors"
                      title="Auto-fetch next sequential Family ID (FAM-1001, FAM-1002, ...)"
                    >
                      ⚡ Auto-Fetch Next ({getNextSequentialFamilyId(students)})
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                      Sequential Family ID (e.g. FAM-1001, FAM-1002)
                    </label>
                    <input
                      type="text"
                      value={familyGroupId}
                      onChange={(e) => setFamilyGroupId(e.target.value.toUpperCase())}
                      placeholder="FAM-1001"
                      className="w-full border border-[#D5D0C6] rounded-md px-2.5 py-1.5 text-xs bg-white font-mono font-bold text-[#1E5C3D] uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">Family Group Name</label>
                    <input
                      type="text"
                      value={familyGroupName}
                      onChange={(e) => setFamilyGroupName(e.target.value)}
                      placeholder={parentName.trim() ? `${parentName.trim()} Family` : 'e.g. Ahmed Family'}
                      className="w-full border border-[#D5D0C6] rounded-md px-2.5 py-1.5 text-xs bg-white"
                    />
                  </div>
                </div>
                {existingFamilies.length > 0 && (
                  <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="text-[#5A6B61] font-medium">Or link to existing Family Tree:</span>
                    <select
                      value={existingFamilies.some(f => f.id === familyGroupId) ? familyGroupId : ''}
                      onChange={(e) => {
                        const selId = e.target.value;
                        if (!selId) {
                          setFamilyGroupId(getNextSequentialFamilyId(students));
                          return;
                        }
                        const found = existingFamilies.find(f => f.id === selId);
                        if (found) {
                          setFamilyGroupId(found.id);
                          setFamilyGroupName(found.name);
                          if (found.parentName && !parentName.trim()) setParentName(found.parentName);
                          if (found.parentEmail && !parentEmail.trim()) setParentEmail(found.parentEmail);
                        }
                      }}
                      className="border border-emerald-300 rounded-md px-2 py-1 text-[11px] bg-white text-[#161F1A] font-medium"
                    >
                      <option value="">-- New Sequential Family ({getNextSequentialFamilyId(students)}) --</option>
                      {existingFamilies.map(f => (
                        <option key={f.id} value={f.id}>
                          {f.id} — {f.name} ({f.count} member{f.count > 1 ? 's' : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Multi-Child / Sibling Batch Enrollment ("+ Add Another Child") */}
              {!initialStudent && (
                <div className="p-3.5 bg-[#FAF9F7] border border-[#D5D0C6] rounded-xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-[#2D8B5C]" />
                        <span>Multiple Children Enrollment ({1 + additionalChildren.length} Child{additionalChildren.length > 0 ? 'ren' : ''})</span>
                      </span>
                      <p className="text-[11px] text-[#5A6B61]">
                        Add multiple siblings in one submission — all children automatically share Family ID <strong className="font-mono text-[#1E5C3D]">{familyGroupId || getNextSequentialFamilyId(students)}</strong>
                      </p>
                    </div>
                    <button
                      id="add_another_child_button"
                      type="button"
                      onClick={handleAddAnotherChild}
                      className="px-3 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Another Child</span>
                    </button>
                  </div>

                  {additionalChildren.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                      {additionalChildren.map((child, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-white rounded-xl border border-emerald-200 space-y-2.5 shadow-2xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#1E5C3D] flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded-full bg-[#1E5C3D] text-white text-[10px] font-mono flex items-center justify-center">
                                {idx + 2}
                              </span>
                              <span>Child #{idx + 2} Profile</span>
                              <span className="font-mono text-[10px] bg-emerald-50 text-[#1E5C3D] px-2 py-0.2 rounded border border-emerald-200">
                                {child.studentId} • {familyGroupId || getNextSequentialFamilyId(students)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveAdditionalChild(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 cursor-pointer flex items-center gap-1 text-[11px] font-semibold"
                              title="Remove this child"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-semibold text-[#5A6B61] mb-0.5">Student ID</label>
                              <input
                                type="text"
                                value={child.studentId}
                                onChange={(e) => handleUpdateAdditionalChild(idx, { studentId: e.target.value })}
                                className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs font-mono font-bold bg-[#FAF9F7]"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-semibold text-[#5A6B61] mb-0.5">Child Full Name *</label>
                              <input
                                type="text"
                                value={child.name}
                                onChange={(e) => handleUpdateAdditionalChild(idx, { name: e.target.value })}
                                placeholder="e.g. Maryam Al-Farooqi"
                                className="w-full border border-[#D5D0C6] rounded-md px-2.5 py-1.5 text-xs bg-white"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-[#5A6B61] mb-0.5">Age (Years)</label>
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={child.age}
                                onChange={(e) => handleUpdateAdditionalChild(idx, { age: e.target.value === '' ? '' : Number(e.target.value) })}
                                placeholder="e.g. 8"
                                className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-semibold text-[#5A6B61] mb-0.5">Course Type</label>
                              <select
                                value={child.courseType}
                                onChange={(e) => handleUpdateAdditionalChild(idx, { courseType: e.target.value as CourseType })}
                                className="w-full border border-[#D5D0C6] rounded-md px-2 py-1.5 text-xs bg-white"
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
                            <div>
                              <label className="block text-[10px] font-semibold text-[#5A6B61] mb-0.5">
                                Login Handle (Auto-generated if blank)
                              </label>
                              <input
                                type="email"
                                value={child.email}
                                onChange={(e) => handleUpdateAdditionalChild(idx, { email: e.target.value })}
                                placeholder={generateStudentEmail(child.name || 'child', child.studentId)}
                                className="w-full border border-[#D5D0C6] rounded-md px-2.5 py-1.5 text-xs bg-white"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Academic Status & Course Type (Tutor is assigned & synced automatically via Master Timetable) */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">Academic Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StudentStatus)}
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Trial">Trial (5 Free Sessions)</option>
                  <option value="Pending">Pending</option>
                  <option value="On Leave">On Leave</option>
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
            <div className="px-3 py-2 bg-[#FAF9F7] border border-[#E3DFD7] rounded-lg flex items-center justify-between text-[11px] text-[#5A6B61]">
              <span>
                ⏳ <strong>Tutor & Slot Assignment:</strong> {initialStudent && initialStudent.assignedTutorId && initialStudent.assignedTutorId !== 'Unassigned'
                  ? `Currently assigned to ${initialStudent.assignedTutorId} (synced via Master Timetable)`
                  : 'Starts as Unassigned — pick any available slot on the Master Timetable to auto-assign & sync'}
              </span>
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

            {/* Student Portal Fee Visibility Toggle */}
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <label className="text-xs font-bold text-[#161F1A] block cursor-pointer" htmlFor="showFeeToStudentCheckbox">
                  Show Fee Receipts & Invoices in Student Portal
                </label>
                <p className="text-[11px] text-[#5A6B61]">
                  Checked by default. Uncheck if parents prefer to hide tuition fees from the student dashboard.
                </p>
              </div>
              <input
                id="showFeeToStudentCheckbox"
                type="checkbox"
                checked={showFeeToStudent}
                onChange={(e) => setShowFeeToStudent(e.target.checked)}
                className="w-4 h-4 text-[#2D8B5C] rounded border-gray-300 focus:ring-[#2D8B5C] cursor-pointer shrink-0"
              />
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
                  How did this student join? (Referral Channel)
                </label>
                <select
                  value={
                    referralSource === 'Existing Student' || referralSource === 'Existing Parent'
                      ? 'Student / Parent Referral'
                      : referralSource
                  }
                  onChange={(e) => {
                    const src = e.target.value;
                    setReferralSource(src);
                    if (src === 'None') {
                      setReferredByName('');
                      setReferredByStudentId('');
                    }
                  }}
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white font-medium focus:ring-1 focus:ring-[#2D8B5C]"
                >
                  <option value="None">None / Direct Enrollment</option>
                  <option value="Student / Parent Referral">Student / Parent Referral</option>
                  <option value="Facebook Ads">Facebook Ads</option>
                  <option value="Google Ads">Google Ads</option>
                </select>
              </div>

              {/* Dynamic Referrer selector or custom marketer text input */}
              {(referralSource === 'Student / Parent Referral' || referralSource === 'Existing Student' || referralSource === 'Existing Parent') ? (
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                    Select Referring Student / Parent
                  </label>
                  <select
                    value={referredByStudentId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setReferredByStudentId(selectedId);
                      const matchingStudent = students.find(s => s.studentId === selectedId);
                      if (matchingStudent) {
                        setReferredByName(`${matchingStudent.name} (${matchingStudent.studentId}) - Parent: ${matchingStudent.parentName || 'N/A'}`);
                      } else {
                        setReferredByName('');
                      }
                    }}
                    className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-[#2D8B5C]"
                  >
                    <option value="">-- Choose Existing Student / Parent --</option>
                    {students
                      .filter(s => s.studentId !== studentId)
                      .map(s => (
                        <option key={s.studentId} value={s.studentId}>
                          {s.name} ({s.studentId}) - Parent: {s.parentName || 'N/A'}
                        </option>
                      ))}
                  </select>
                </div>
              ) : (referralSource === 'Facebook Ads' || referralSource === 'Google Ads' || (referralSource !== 'None' && referralSource !== '')) ? (
                <div>
                  <label className="block text-[11px] font-semibold text-[#5A6B61] mb-1">
                    Marketer / Custom Campaign Name
                  </label>
                  <input
                    type="text"
                    value={referredByName}
                    onChange={(e) => setReferredByName(e.target.value)}
                    placeholder="e.g. Marketer John / Facebook Ads"
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

              {/* Parent Account (Child Students Only) */}
              {studentType === 'child' && (
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
              )}
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
          <div className="pt-4 border-t border-[#E3DFD7] flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium text-[#5A6B61] hover:bg-gray-100 rounded-lg cursor-pointer">
              Cancel
            </button>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                id="submit_student_button"
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-semibold text-[#1E5C3D] bg-[#E8F5EE] hover:bg-[#D5EDE0] border border-emerald-300 rounded-lg shadow-2xs flex items-center space-x-1.5 cursor-pointer transition-colors"
                title="Saves student as Unassigned and pins them at the top of the Master Timetable student picker"
              >
                <CheckCircle className="w-4 h-4 text-[#2D8B5C]" />
                <span>{saving ? 'Saving...' : 'Save Student'}</span>
              </button>
              {onSaveAndGoToTimetable && (
                <button
                  id="submit_student_and_timetable_button"
                  type="button"
                  disabled={saving}
                  onClick={() => saveStudentRecord(true)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer transition-colors"
                  title="Saves student and takes you straight to the Master Timetable to book a slot"
                >
                  <Calendar className="w-4 h-4 text-[#E8A93E]" />
                  <span>{saving ? 'Saving...' : 'Save & Go to Timetable'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
