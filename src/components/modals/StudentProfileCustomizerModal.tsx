import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Heart,
  Target,
  Clock,
  Palette,
  User,
  BookOpen,
  Image as ImageIcon,
  Trash2,
  Smile
} from 'lucide-react';
import { UserProfile, Student, Tutor } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  optimizeAndConvertToWebP,
  PRESET_STUDENT_AVATARS,
  OptimizedImageResult
} from '../../utils/imageOptimizer';
import { updateStudent } from '../../services/dataService';

interface StudentProfileCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: Student | null;
  assignedTutor?: Tutor | null;
}

export const StudentProfileCustomizerModal: React.FC<StudentProfileCustomizerModalProps> = ({
  isOpen,
  onClose,
  student,
  assignedTutor
}) => {
  const { userProfile, updateUserProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string>(userProfile?.avatarUrl || '');
  const [preferredName, setPreferredName] = useState<string>(userProfile?.preferredName || '');
  const [bio, setBio] = useState<string>(userProfile?.bio || '');
  const [favoriteSurah, setFavoriteSurah] = useState<string>(userProfile?.favoriteSurah || 'Surah Ar-Rahman');
  const [quranGoal, setQuranGoal] = useState<string>(userProfile?.quranGoal || 'Memorize Juz Amma with Tajweed rules');
  const [hobbies, setHobbies] = useState<string>(userProfile?.hobbies || 'Islamic Calligraphy, Arabic, Reading');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(userProfile?.dailyGoalMinutes || 20);
  const [themePreference, setThemePreference] = useState<'emerald' | 'gold' | 'midnight' | 'sage'>(
    userProfile?.themePreference || 'emerald'
  );
  const [email, setEmail] = useState<string>(userProfile?.email || '');

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [compressionStats, setCompressionStats] = useState<{
    originalKb: number;
    compressedKb: number;
    savingsPercent: number;
    format: string;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setIsProcessingImage(true);
    const originalKb = Number((file.size / 1024).toFixed(1));

    try {
      // Automatically downscale and convert to WebP format with high quality and tiny byte size
      const result: OptimizedImageResult = await optimizeAndConvertToWebP(file, 256, 0.78);
      setAvatarUrl(result.dataUrl);

      const savings = originalKb > 0 ? Math.max(0, Math.round(((originalKb - result.sizeKb) / originalKb) * 100)) : 0;
      setCompressionStats({
        originalKb,
        compressedKb: result.sizeKb,
        savingsPercent: savings,
        format: result.format.toUpperCase()
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process and compress image.');
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectPresetAvatar = (avatar: typeof PRESET_STUDENT_AVATARS[0]) => {
    // Generate a clean SVG data URI for preset avatars
    const svgContent = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="%231E5C3D"/><text x="50%" y="54%" font-size="52" text-anchor="middle" dominant-baseline="central">${encodeURIComponent(avatar.iconSvg)}</text></svg>`;
    setAvatarUrl(svgContent);
    setCompressionStats({
      originalKb: 2,
      compressedKb: 0.8,
      savingsPercent: 60,
      format: 'SVG'
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      const emailChanged = email.trim().toLowerCase() !== userProfile?.email?.trim().toLowerCase();
      
      if (emailChanged && student?.id) {
        if (userProfile?.role === 'parent') {
          await updateStudent(student.id, { parentEmail: email.trim() });
        } else {
          await updateStudent(student.id, { email: email.trim() });
        }
      }

      await updateUserProfile({
        avatarUrl,
        preferredName: preferredName.trim(),
        bio: bio.trim(),
        favoriteSurah: favoriteSurah.trim(),
        quranGoal: quranGoal.trim(),
        hobbies: hobbies.trim(),
        dailyGoalMinutes: Number(dailyGoalMinutes) || 20,
        themePreference,
        ...(emailChanged ? { email: email.trim() } : {})
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile.');
    }
  };

  const POPULAR_SURAHS = [
    'Surah Al-Fatihah (1)',
    'Surah Al-Baqarah (2)',
    'Surah Ali Imran (3)',
    'Surah Al-Kahf (18)',
    'Surah Maryam (19)',
    'Surah Ta-Ha (20)',
    'Surah Yasin (36)',
    'Surah Ar-Rahman (55)',
    'Surah Al-Waqiah (56)',
    'Surah Al-Mulk (67)',
    'Surah Al-Insan (76)',
    'Surah An-Naba (78)',
    'Surah Al-Ikhlas (112)'
  ];

  return (
    <div
      id="student_profile_modal_overlay"
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-[#D5D0C6] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-[#1E5C3D] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
              <Sparkles className="w-4 h-4 text-[#E8A93E]" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">My Student Profile & Personalization</h3>
              <p className="text-[11px] text-[#c7e4d6]">
                Customize your avatar, Quranic learning goals, and display preferences
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSaveProfile} className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
              <X className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">Your student profile and avatar have been saved successfully!</span>
            </div>
          )}

          {/* Section 1: Avatar Upload & WebP Auto-Converter */}
          <div className="p-4 bg-[#FAF9F7] rounded-xl border border-[#E3DFD7] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-[#2D8B5C]" />
                <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
                  Profile Picture & Avatar (Auto-Optimized WebP)
                </h4>
              </div>
              <span className="text-[10px] text-[#5A6B61] bg-white px-2 py-0.5 rounded border border-[#D5D0C6] font-mono">
                Max &lt; 30 KB
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
              {/* Avatar Preview */}
              <div className="relative group">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#1E5C3D] to-[#2D8B5C] p-0.5 shadow-md flex items-center justify-center overflow-hidden border-2 border-white">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Student Avatar"
                      className="w-full h-full object-cover rounded-2xl"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-white">
                      {userProfile?.displayName?.charAt(0).toUpperCase() || 'S'}
                    </span>
                  )}
                </div>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarUrl('');
                      setCompressionStats(null);
                    }}
                    title="Remove custom picture"
                    className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 text-white rounded-full shadow-md hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Upload & Compression Actions */}
              <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/webp, image/gif, image/heic"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isProcessingImage}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-semibold rounded-lg flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isProcessingImage ? 'Optimizing...' : 'Upload Photo'}</span>
                  </button>

                  <span className="text-[11px] text-[#5A6B61]">
                    JPG, PNG or WEBP (auto-compressed to compact WebP)
                  </span>
                </div>

                {/* Real-time compression stats badge */}
                {compressionStats && (
                  <div className="inline-flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-md text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      Original: <strong>{compressionStats.originalKb} KB</strong> ➔ WebP:{' '}
                      <strong className="text-emerald-700">{compressionStats.compressedKb} KB</strong>{' '}
                      ({compressionStats.savingsPercent}% lighter, zero server lag)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick-Pick Islamic Avatars */}
            <div className="pt-2 border-t border-[#E3DFD7]">
              <p className="text-[11px] font-semibold text-[#5A6B61] mb-1.5 flex items-center gap-1">
                <Smile className="w-3.5 h-3.5 text-[#2D8B5C]" />
                <span>Or pick an instant Islamic learning emblem:</span>
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {PRESET_STUDENT_AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => handleSelectPresetAvatar(avatar)}
                    className="p-1.5 rounded-xl border border-[#D5D0C6] hover:border-[#2D8B5C] bg-white hover:bg-emerald-50/50 flex flex-col items-center gap-1 transition-all group cursor-pointer"
                    title={`${avatar.name} (${avatar.category})`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${avatar.bgGradient} flex items-center justify-center text-sm shadow-xs`}>
                      {avatar.iconSvg}
                    </div>
                    <span className="text-[9px] font-medium text-[#5A6B61] truncate max-w-[54px]">
                      {avatar.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: Student Goals & Personal Preferences */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-4 h-4 text-[#2D8B5C]" />
              <span>Quran Learning Goals & Preferences</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[#161F1A] mb-1">
                  Preferred Nickname / Kunya (Optional)
                </label>
                <input
                  type="text"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="e.g. Abu Hamza / Little Maryam"
                  maxLength={50}
                  className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-[#161F1A] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
                />
                <span className="text-[10px] text-[#5A6B61]">Displayed on your student greetings and certificates</span>
              </div>

              <div>
                <label className="block font-semibold text-[#161F1A] mb-1">
                  Favorite Surah / Quran Passage
                </label>
                <select
                  value={favoriteSurah}
                  onChange={(e) => setFavoriteSurah(e.target.value)}
                  className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-[#161F1A] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
                >
                  {POPULAR_SURAHS.map((surah) => (
                    <option key={surah} value={surah}>
                      {surah}
                    </option>
                  ))}
                  <option value="Other">Other / Custom Surah</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#161F1A] mb-1">
                Personal Quran Goal
              </label>
              <input
                type="text"
                value={quranGoal}
                onChange={(e) => setQuranGoal(e.target.value)}
                placeholder="e.g. Complete Juz Amma with Tajweed by next Eid"
                maxLength={120}
                className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-[#161F1A] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block font-semibold text-[#161F1A] mb-1">
                  Daily Quran Practice Goal (Minutes)
                </label>
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-[#2D8B5C]" />
                  <input
                    type="number"
                    min="5"
                    max="180"
                    step="5"
                    value={dailyGoalMinutes}
                    onChange={(e) => setDailyGoalMinutes(Number(e.target.value) || 20)}
                    className="w-24 border border-[#D5D0C6] rounded-lg p-2 bg-white text-center font-bold text-[#161F1A]"
                  />
                  <span className="text-xs text-[#5A6B61]">minutes per day</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#161F1A] mb-1">
                  Hobbies & Interests
                </label>
                <input
                  type="text"
                  value={hobbies}
                  onChange={(e) => setHobbies(e.target.value)}
                  placeholder="e.g. Calligraphy, Arabic, Football"
                  maxLength={100}
                  className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-[#161F1A] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-[#161F1A] mb-1">
                About Me / Personal Note
              </label>
              <textarea
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Share a short note about your Quran journey, aspirations, or learning style..."
                maxLength={240}
                className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-[#161F1A] focus:ring-2 focus:ring-[#2D8B5C] outline-none resize-none"
              />
            </div>
          </div>

          {/* Section 2.5: Contact & Login Email */}
          <div className="p-4 bg-emerald-50/20 rounded-xl border border-emerald-100 space-y-3">
            <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-4 h-4 text-[#2D8B5C]" />
              <span>Contact & Login Email Information</span>
            </h4>
            <p className="text-[11px] text-[#5A6B61] leading-relaxed">
              Updating your email will automatically update both your profile records and login credentials. Keep this updated to ensure uninterrupted access.
            </p>
            <div>
              <label className="block text-[11px] font-semibold text-[#161F1A] mb-1">
                Your Contact / Login Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. parent.name@example.com"
                className="w-full border border-[#D5D0C6] rounded-lg p-2.5 bg-white text-xs text-[#161F1A] focus:ring-2 focus:ring-[#2D8B5C] outline-none"
              />
            </div>
          </div>

          {/* Section 3: Protected Academic & Identity Shield */}
          <div className="p-3.5 bg-[#F4F2EC] rounded-xl border border-[#D5D0C6] space-y-2">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#1E5C3D]" />
              <span className="text-xs font-bold text-[#161F1A]">
                Protected Academic Record (Managed by Academy Admin)
              </span>
            </div>
            <p className="text-[11px] text-[#5A6B61]">
              The following fields are strictly locked so they remain synchronized with tutor logs and billing ledgers:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 bg-white rounded-lg border border-[#E3DFD7]">
                <span className="text-[#5A6B61] block text-[10px]">Official Name</span>
                <strong className="text-[#161F1A] truncate block">{student?.name || userProfile?.displayName}</strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-[#E3DFD7]">
                <span className="text-[#5A6B61] block text-[10px]">Student ID</span>
                <strong className="text-[#2D8B5C] font-mono block">{student?.studentId || userProfile?.studentId || 'N/A'}</strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-[#E3DFD7]">
                <span className="text-[#5A6B61] block text-[10px]">Enrolled Course</span>
                <strong className="text-[#161F1A] truncate block">{student?.courseType || 'Quranic Studies'}</strong>
              </div>
              <div className="p-2 bg-white rounded-lg border border-[#E3DFD7]">
                <span className="text-[#5A6B61] block text-[10px]">Assigned Tutor</span>
                <strong className="text-[#161F1A] truncate block">{assignedTutor?.tutorId || student?.assignedTutorId || 'Assigned Tutor'}</strong>
              </div>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="pt-2 flex items-center justify-end space-x-3 shrink-0 border-t border-[#E3DFD7]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#D5D0C6] rounded-xl text-xs font-semibold text-[#5A6B61] hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Profile Updates</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
