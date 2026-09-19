import React, { useState } from 'react';
import {
  X,
  Upload,
  Trash2,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Eye,
  FileImage,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Lesson, LessonScreenshot } from '../../types';
import { compressAndConvertToWebP } from '../../utils/chatMediaUtils';
import { updateLesson } from '../../services/dataService';

interface LessonMaterialEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  lesson: Lesson | null;
  userRole: 'admin' | 'supervisor';
  userName?: string;
  onRefreshData?: () => Promise<void>;
  onPreviewImage?: (url: string) => void;
}

export const LessonMaterialEditModal: React.FC<LessonMaterialEditModalProps> = ({
  isOpen,
  onClose,
  lesson,
  userRole,
  userName = 'Supervisor',
  onRefreshData,
  onPreviewImage
}) => {
  if (!isOpen || !lesson) return null;

  const [screenshots, setScreenshots] = useState<LessonScreenshot[]>(
    lesson.screenshots ? [...lesson.screenshots] : []
  );
  const [materialQualityStatus, setMaterialQualityStatus] = useState<
    '100% Verified' | 'Needs Correction' | 'Replaced by Admin' | 'Replaced by Supervisor'
  >(
    lesson.materialQualityStatus ||
    (userRole === 'admin' ? '100% Verified' : '100% Verified')
  );
  const [materialNotes, setMaterialNotes] = useState<string>(lesson.materialNotes || '');
  const [safetyStatus, setSafetyStatus] = useState<'Safe' | 'Flagged' | 'Audited' | 'Pending Review'>(
    lesson.safetyStatus || 'Audited'
  );
  const [safetyNotes, setSafetyNotes] = useState<string>(lesson.safetyNotes || '');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    if (screenshots.length + fileArray.length > 6) {
      alert("A lesson can have a maximum of 6 material screenshots/pages.");
      return;
    }

    setIsUploading(true);
    try {
      const newItems: LessonScreenshot[] = [];
      for (const file of fileArray) {
        const compressed = await compressAndConvertToWebP(file, 1400, 0.8);
        newItems.push({
          url: compressed.dataUrl,
          name: compressed.name || `Material_Page_${Date.now()}.webp`,
          size: compressed.size,
          uploadedAt: new Date().toISOString(),
          expired: false,
          uploadedByRole: userRole,
          notes: `Uploaded by ${userRole.toUpperCase()} (${userName})`
        });
      }
      setScreenshots(prev => [...prev, ...newItems]);
      if (userRole === 'admin') {
        setMaterialQualityStatus('Replaced by Admin');
      } else {
        setMaterialQualityStatus('Replaced by Supervisor');
      }
    } catch (err: any) {
      alert("Failed to process image: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteScreenshot = (index: number) => {
    if (!window.confirm("Remove this image from the lesson material?")) return;
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateLesson(lesson.id, {
        screenshots,
        materialQualityStatus,
        materialNotes: materialNotes.trim() || undefined,
        safetyStatus,
        safetyNotes: safetyNotes.trim() || undefined,
        auditedBy: `${userRole.toUpperCase()} - ${userName}`,
        auditedAt: new Date().toISOString()
      });

      if (onRefreshData) {
        await onRefreshData();
      }
      onClose();
    } catch (err: any) {
      alert("Failed to update lesson material: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-[#E3DFD7] overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-[#14231b] text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2D8B5C] flex items-center justify-center text-white">
              <FileImage className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base">
                  Audit & Edit Lesson Material & Screenshots
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2D8B5C] text-white">
                  {userRole} Authority
                </span>
              </div>
              <p className="text-[11px] text-[#9cb4a6] mt-0.5">
                Student: <strong>{lesson.studentName}</strong> ({lesson.studentId}) • Tutor:{' '}
                <strong>{lesson.tutorId}</strong> • Date: {lesson.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Lesson Context Strip */}
          <div className="bg-[#FAF9F7] p-3.5 rounded-xl border border-[#E3DFD7] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                Lesson Type & Portion
              </span>
              <p className="font-semibold text-[#161F1A] mt-0.5">{lesson.lessonCovered}</p>
              {lesson.mushafPage && (
                <span className="inline-block text-[10px] font-bold text-[#1E5C3D] mt-0.5">
                  Mushaf Page: {lesson.mushafPage}
                </span>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                Current Attendance
              </span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {lesson.attendanceStatus || 'Present'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#5A6B61] uppercase tracking-wider block">
                Material Inspection Policy
              </span>
              <p className="text-[11px] text-[#5A6B61] mt-0.5">
                Remove blurry or incorrect screenshots. Upload clear scans if tutor's upload is not 100% up to the mark.
              </p>
            </div>
          </div>

          {/* Current Screenshots List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#161F1A] flex items-center space-x-1.5">
                <span>Current Lesson Screenshots & Materials</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-gray-100 text-[#5A6B61]">
                  {screenshots.length} attached
                </span>
              </label>
              <span className="text-[11px] text-[#5A6B61]">
                Max 6 images • Click image to zoom
              </span>
            </div>

            {screenshots.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-[#E3DFD7] rounded-xl bg-[#FAF9F7]/50 text-xs text-[#5A6B61]">
                No screenshots attached to this lesson yet. Use the uploader below to add lesson material.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {screenshots.map((scr, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-xl overflow-hidden border border-[#D5D0C6] bg-[#FAF9F7] shadow-xs flex flex-col justify-between"
                  >
                    <div
                      onClick={() => onPreviewImage && scr.url && onPreviewImage(scr.url)}
                      className="aspect-video bg-black/5 overflow-hidden cursor-zoom-in relative"
                    >
                      {scr.url ? (
                        <img
                          src={scr.url}
                          alt={scr.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          Expired / No URL
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                        <span className="p-1.5 bg-white/90 rounded-full text-black">
                          <Eye className="w-4 h-4" />
                        </span>
                      </div>
                    </div>

                    <div className="p-2 bg-white flex items-center justify-between border-t border-[#EAE6DE]">
                      <div className="min-w-0 pr-1">
                        <p className="text-[10px] font-bold text-[#161F1A] truncate" title={scr.name}>
                          {scr.name}
                        </p>
                        <span className="text-[9px] text-[#5A6B61] block">
                          {scr.uploadedByRole
                            ? `${scr.uploadedByRole.toUpperCase()} upload`
                            : 'Tutor upload'}{' '}
                          • {Math.round((scr.size || 0) / 1024)} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteScreenshot(idx)}
                        className="p-1 rounded-md text-red-600 hover:bg-red-50 cursor-pointer"
                        title="Delete this sub-par or wrong screenshot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload New / Replacement Material */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#161F1A]">
              Upload Replacement / Improved Lesson Material
            </label>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
              }}
              className={`p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                dragOver
                  ? 'border-[#2D8B5C] bg-[#E8F5EE]'
                  : 'border-[#D5D0C6] hover:border-[#2D8B5C] bg-[#FAF9F7]'
              }`}
            >
              <input
                type="file"
                id="material-upload-input"
                multiple
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files) handleFileUpload(e.target.files);
                }}
                className="hidden"
              />
              <label
                htmlFor="material-upload-input"
                className="cursor-pointer flex flex-col items-center space-y-1.5"
              >
                {isUploading ? (
                  <Loader2 className="w-6 h-6 text-[#2D8B5C] animate-spin" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[#2D8B5C]/10 text-[#2D8B5C] flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                )}
                <span className="text-xs font-semibold text-[#161F1A]">
                  Click or Drag & Drop high-resolution Mushaf / Qaida screenshots
                </span>
                <span className="text-[10px] text-[#5A6B61]">
                  Auto-converts and compresses to high-quality lightweight WebP
                </span>
              </label>
            </div>
          </div>

          {/* Quality Assessment & Safety Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#EAE6DE]">
            {/* Material Quality Review */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#161F1A] flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-[#B87314]" />
                <span>Material Quality Evaluation</span>
              </label>
              <select
                value={materialQualityStatus}
                onChange={(e) => setMaterialQualityStatus(e.target.value as any)}
                className="w-full text-xs border border-[#D5D0C6] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#2D8B5C]"
              >
                <option value="100% Verified">100% Verified & Legible</option>
                <option value="Replaced by Supervisor">Corrected / Replaced by Supervisor</option>
                <option value="Replaced by Admin">Corrected / Replaced by Admin</option>
                <option value="Needs Correction">Not Up to the Mark (Flagged for Tutor)</option>
              </select>
              <input
                type="text"
                value={materialNotes}
                onChange={(e) => setMaterialNotes(e.target.value)}
                placeholder="Remarks on material (e.g., 'Replaced blurry page 14 with clear scan')"
                className="w-full text-xs border border-[#D5D0C6] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
              />
            </div>

            {/* Safety & Security Auditing */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-[#161F1A] flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2D8B5C]" />
                <span>Safety & Security Check</span>
              </label>
              <select
                value={safetyStatus}
                onChange={(e) => setSafetyStatus(e.target.value as any)}
                className="w-full text-xs border border-[#D5D0C6] rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-[#2D8B5C]"
              >
                <option value="Audited">Audited & Fully Compliant</option>
                <option value="Safe">Safe (Verified Environment)</option>
                <option value="Flagged">Flagged for Safety Review</option>
                <option value="Pending Review">Pending Supervisor Check</option>
              </select>
              <input
                type="text"
                value={safetyNotes}
                onChange={(e) => setSafetyNotes(e.target.value)}
                placeholder="Supervisor safety observations (e.g., 'Audio/video checked, safe session')"
                className="w-full text-xs border border-[#D5D0C6] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#2D8B5C]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E3DFD7]">
            <span className="text-[11px] text-[#5A6B61]">
              Saved changes replicate immediately to all dashboards and student records.
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-[#5A6B61] hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isUploading}
                className="px-5 py-2 text-xs font-bold text-white bg-[#2D8B5C] hover:bg-[#1E5C3D] rounded-lg shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Save Material & Audit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
