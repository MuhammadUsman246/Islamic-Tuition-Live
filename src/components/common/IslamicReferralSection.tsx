import React, { useState, useEffect } from 'react';
import {
  Share2,
  Sparkles,
  Heart,
  BookOpen,
  Phone,
  User,
  CheckCircle2,
  Send,
  Gift,
  Award,
  HelpCircle
} from 'lucide-react';
import { CourseType, StudentReferralLead } from '../../types';
import { addStudentReferralLead, getStudentReferralLeads } from '../../services/dataService';

interface IslamicReferralSectionProps {
  referrerName: string;
  referrerStudentId?: string;
  referrerRole: 'student' | 'parent';
  referrerEmail?: string;
}

export const IslamicReferralSection: React.FC<IslamicReferralSectionProps> = ({
  referrerName,
  referrerStudentId,
  referrerRole,
  referrerEmail
}) => {
  const [friendName, setFriendName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [courseInterest, setCourseInterest] = useState<CourseType>('Quran Reading / Nazra');
  const [notes, setNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [myLeads, setMyLeads] = useState<StudentReferralLead[]>([]);

  // Load existing referral leads submitted by this referrer
  const loadLeads = async () => {
    try {
      const allLeads = await getStudentReferralLeads();
      const userLeads = allLeads.filter(l => 
        (referrerStudentId && l.referrerStudentId === referrerStudentId) ||
        (l.referrerName && l.referrerName.toLowerCase().trim() === referrerName.toLowerCase().trim())
      );
      setMyLeads(userLeads);
    } catch (err) {
      console.warn("Could not load referral leads:", err);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [referrerStudentId, referrerName]);

  const handleSubmitReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName.trim() || !whatsappNumber.trim()) {
      alert("Please provide the student name and WhatsApp number.");
      return;
    }

    try {
      setIsSubmitting(true);
      await addStudentReferralLead({
        referrerStudentId,
        referrerName,
        referrerEmail,
        referrerRole,
        referredFriendName: friendName.trim(),
        referredParentName: '',
        whatsappNumber: whatsappNumber.trim(),
        courseInterest,
        dateSubmitted: new Date().toISOString().slice(0, 10),
        status: 'Pending Contact',
        discountAmount: 30,
        notes: notes.trim() || 'Submitted via Academy Student/Parent Referral Portal',
        createdAt: new Date().toISOString()
      });

      setSubmittedSuccess(true);
      setFriendName('');
      setWhatsappNumber('');
      setNotes('');
      await loadLeads();
    } catch (err: any) {
      alert("Error submitting referral: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Clean Professional Referral Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E3DFD7] shadow-xs relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>Student Referral Program</span>
            </span>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-[#161F1A] tracking-tight">
              Share the Blessing of Quranic Education
            </h2>
            <p className="text-xs sm:text-sm text-[#5A6B61] leading-relaxed max-w-3xl">
              Introducing relatives, friends, and neighbors to learning the Holy Quran is a wonderful way to spread knowledge and earn great rewards from Allah SWT as continuous Sadaqah Jariyah. Every verse they recite brings eternal reward to your scale of good deeds. As a token of gratitude for helping spread goodness, you also receive a $30 tuition discount on your next fee invoice upon their first successful payment.
            </p>
          </div>

          {/* Inspirational Callouts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E3DFD7] space-y-1">
              <div className="flex items-center space-x-2 text-[#2D8B5C] font-bold text-xs">
                <Heart className="w-4 h-4 text-[#2D8B5C]" />
                <span>Sahih al-Bukhari</span>
              </div>
              <p className="text-xs text-[#5A6B61] italic">
                "The best among you are those who learn the Quran and teach it."
              </p>
            </div>

            <div className="bg-[#FAF9F7] p-4 rounded-xl border border-[#E3DFD7] space-y-1">
              <div className="flex items-center space-x-2 text-[#2D8B5C] font-bold text-xs">
                <Award className="w-4 h-4 text-[#2D8B5C]" />
                <span>Sahih Muslim</span>
              </div>
              <p className="text-xs text-[#5A6B61] italic">
                "Whoever guides someone to goodness will have a reward like the one who did it."
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Referral Form + Benefits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Referral Form (2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-[#E3DFD7] shadow-sm space-y-5">
          <div className="border-b border-[#EAE6DE] pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">Submit a New Student Recommendation</h3>
              <p className="text-xs text-[#5A6B61]">Enter your friend or relative's details. Our team will reach out via WhatsApp.</p>
            </div>
            <Gift className="w-5 h-5 text-[#2D8B5C]" />
          </div>

          {submittedSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-2 animate-in fade-in duration-300 break-words">
              <div className="flex items-center space-x-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>JazakAllahu Khairan! Recommendation Submitted</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed break-words">
                May Allah reward you for spreading Quranic knowledge. Our academic coordinator will contact your friend via WhatsApp to schedule a free 5-session trial. As soon as they complete their first payment, your <strong>$30 flat discount</strong> will automatically be credited to your account!
              </p>
              <button
                type="button"
                onClick={() => setSubmittedSuccess(false)}
                className="min-h-[44px] px-3 py-2 text-xs font-bold text-emerald-800 hover:underline inline-flex items-center cursor-pointer"
              >
                + Submit another student recommendation
              </button>
            </div>
          )}

          {!submittedSuccess && (
            <form onSubmit={handleSubmitReferral} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#161F1A] mb-1">
                    Student / Friend's Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={friendName}
                      onChange={e => setFriendName(e.target.value)}
                      placeholder="e.g. Yusuf Khan"
                      className="min-h-[44px] w-full pl-9 pr-3 py-2.5 bg-[#FAF9F7] border border-[#D5D0C6] rounded-xl text-xs text-[#161F1A] focus:outline-none focus:border-[#2D8B5C]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#161F1A] mb-1">
                    WhatsApp Contact Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={whatsappNumber}
                      onChange={e => setWhatsappNumber(e.target.value)}
                      placeholder="e.g. +1 (555) 234-5678"
                      className="min-h-[44px] w-full pl-9 pr-3 py-2.5 bg-[#FAF9F7] border border-[#D5D0C6] rounded-xl text-xs text-[#161F1A] focus:outline-none focus:border-[#2D8B5C]"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#161F1A] mb-1">
                  Additional Notes or Best Time to Call <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Cousin from Texas, prefers evening weekend classes..."
                  className="w-full px-3 py-2.5 bg-[#FAF9F7] border border-[#D5D0C6] rounded-xl text-xs text-[#161F1A] focus:outline-none focus:border-[#2D8B5C]"
                />
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-1.5 text-[11px] text-[#5A6B61]">
                  <HelpCircle className="w-3.5 h-3.5 text-[#2D8B5C] shrink-0" />
                  <span>Discount automatically attaches to your next invoice.</span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4 shrink-0" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Recommendation'}</span>
                </button>
              </div>
            </form>
          )}
        </div>

        {/* How it Works / Benefits Column */}
        <div className="space-y-4">
          <div className="bg-[#FAF9F7] p-5 rounded-2xl border border-[#E3DFD7] space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#161F1A]">
              How the $30 Reward System Works
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-[#2D8B5C] text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
                <div>
                  <strong className="text-[#161F1A] block">Submit Friend Info</strong>
                  <p className="text-[11px] text-[#5A6B61]">Provide their WhatsApp contact details above.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-[#2D8B5C] text-white flex items-center justify-center font-bold text-xs shrink-0">2</span>
                <div>
                  <strong className="text-[#161F1A] block">Free 5-Session Trial</strong>
                  <p className="text-[11px] text-[#5A6B61]">Our coordinator contacts them to start 5 trial sessions with our certified tutors.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <span className="w-6 h-6 rounded-full bg-[#2D8B5C] text-white flex items-center justify-center font-bold text-xs shrink-0">3</span>
                <div>
                  <strong className="text-[#161F1A] block">$30 Discount Auto-Applied</strong>
                  <p className="text-[11px] text-[#5A6B61]">Upon their first fee payment, $30 flat discount is automatically deducted from your next invoice!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submitted Referrals History (Mobile Cards + Desktop Table) */}
      {myLeads.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-sm p-4 sm:p-5 space-y-3 break-words">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#EAE6DE] pb-2">
            <h3 className="text-sm font-bold text-[#161F1A]">Your Submitted Student Recommendations ({myLeads.length})</h3>
            <span className="text-xs text-[#5A6B61]">Track conversion &amp; discount status</span>
          </div>

          {/* Mobile Card Layout (< 768px) */}
          <div className="md:hidden space-y-2.5">
            {myLeads.map(lead => (
              <div key={lead.id} className="p-3.5 rounded-xl bg-[#FAF9F7] border border-[#E3DFD7] space-y-2 text-xs break-words">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-[#161F1A] text-sm break-words">{lead.referredFriendName}</div>
                    <div className="text-[11px] font-mono text-[#5A6B61] mt-0.5 break-words">{lead.whatsappNumber}</div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                    lead.status === 'Converted & Discount Applied'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : lead.status === 'Trial Scheduled'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : lead.status === 'Contacted'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {lead.status}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[#EAE6DE] text-[11px]">
                  <span className="font-mono text-[#5A6B61]">{lead.dateSubmitted} · {lead.courseInterest || 'Quran'}</span>
                  <span className="font-bold text-[#2D8B5C]">${lead.discountAmount || 30} Flat Discount</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] text-[#5A6B61] font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Referred Student</th>
                  <th className="py-2.5 px-3">WhatsApp Number</th>
                  <th className="py-2.5 px-3">Course</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Discount Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6DE]">
                {myLeads.map(lead => (
                  <tr key={lead.id} className="hover:bg-[#FAF9F7]/60">
                    <td className="py-2.5 px-3 font-mono text-[#5A6B61]">{lead.dateSubmitted}</td>
                    <td className="py-2.5 px-3 font-bold text-[#161F1A] break-words">{lead.referredFriendName}</td>
                    <td className="py-2.5 px-3 font-mono text-[#5A6B61] break-words">{lead.whatsappNumber}</td>
                    <td className="py-2.5 px-3 text-[#2D8B5C] font-semibold">{lead.courseInterest || 'Quran'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                        lead.status === 'Converted & Discount Applied'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : lead.status === 'Trial Scheduled'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : lead.status === 'Contacted'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#2D8B5C]">
                      ${lead.discountAmount || 30} Flat Discount
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
