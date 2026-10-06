import React, { useState } from 'react';
import { Sparkles, ExternalLink, Play } from 'lucide-react';

export interface TrainingVideoItem {
  index: number;
  number: number;
  id: string;
  title: string;
  description: string;
}

export const TUTOR_TRAINING_PLAYLIST: TrainingVideoItem[] = [
  { index: 0, number: 1, id: '7YKnLGE1HCc', title: 'Training 1: قاعدہ پڑھانے کا طریقہ', description: 'Qaida Teaching Methodology — Part 1' },
  { index: 1, number: 2, id: '1kzjgukAIK8', title: 'Training 2: قاعدہ پڑھانے کا طریقہ', description: 'Qaida Teaching Methodology — Part 2' },
  { index: 2, number: 3, id: 'bN7obzrwghI', title: 'Training 3: قاعدہ پڑھانے کا طریقہ', description: 'Qaida Teaching Methodology — Part 3' },
  { index: 3, number: 4, id: 'uTAkl2uHYmg', title: 'Training 4: قاعدہ پڑھانے کا طریقہ', description: 'Qaida Teaching Methodology — Part 4' },
  { index: 4, number: 5, id: 'EkbjoJ3ON9E', title: 'Training 5: عَمَّ پارہ پڑھانے کا طریقہ', description: 'Amma Para Teaching Methodology' },
  { index: 5, number: 6, id: 'BK-sxzyf_gg', title: 'Training 6: الٓمٓ پارہ پڑھانے کا طریقہ', description: 'Alif Lam Meem Para Teaching Methodology' },
  { index: 6, number: 7, id: 'hJ9OboLX-uc', title: 'Training 7: قرآن پاک پڑھانے کا طریقہ', description: 'Holy Quran Recitation & Nazra Methodology' },
  { index: 7, number: 8, id: 'tS16QyZMmuA', title: 'Training 8: Memorization Lesson and Islamic Studies', description: 'Hifz, Daily Duas & Islamic Studies Guide' },
  { index: 8, number: 9, id: 'W4MgdwaprRo', title: 'Training 9: Trial Classes & Lesson Sheet', description: 'Conducting Trial Classes & Sheet Logging' },
];

export const TutorsTrainingPortal: React.FC = () => {
  const [selectedTrainingVideoIndex, setSelectedTrainingVideoIndex] = useState<number>(0);
  const currentVideo = TUTOR_TRAINING_PLAYLIST[selectedTrainingVideoIndex] || TUTOR_TRAINING_PLAYLIST[0];

  return (
    <div className="space-y-5">
      {/* Top Control Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E3DFD7] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#1E5C3D] text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Training Series
            </span>
            <span className="text-xs text-[#5A6B61] font-medium">9 Video Modules</span>
          </div>
          <h2 className="text-lg font-bold text-[#161F1A]">
            Tutors Training Videos
          </h2>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedTrainingVideoIndex(prev => Math.max(0, prev - 1))}
            disabled={selectedTrainingVideoIndex === 0}
            className="px-3 py-1.5 rounded-lg border border-[#D5D0C6] bg-white text-xs font-bold text-[#161F1A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FAF9F7] transition-colors cursor-pointer flex items-center space-x-1"
          >
            <span>&larr; Prev Video</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedTrainingVideoIndex(prev => Math.min(8, prev + 1))}
            disabled={selectedTrainingVideoIndex === 8}
            className="px-3 py-1.5 rounded-lg border border-[#D5D0C6] bg-white text-xs font-bold text-[#161F1A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#FAF9F7] transition-colors cursor-pointer flex items-center space-x-1"
          >
            <span>Next Video &rarr;</span>
          </button>
          <a
            href="https://www.youtube.com/playlist?list=PLbQ5G5gE6IK84pFoT1l8qFMNKA2sgltZp"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 rounded-lg bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white font-bold text-xs transition-colors flex items-center space-x-1.5 shadow-2xs shrink-0 cursor-pointer"
          >
            <span>Open Playlist</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Full-Width Ultra-Crisp HD Video Player */}
      <div className="bg-black rounded-2xl overflow-hidden border border-[#E3DFD7] shadow-lg aspect-video w-full max-h-[780px] relative">
        <iframe
          key={currentVideo.id}
          src={`https://www.youtube-nocookie.com/embed/${currentVideo.id}?rel=0&autoplay=0`}
          title={currentVideo.title}
          className="w-full h-full border-0"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      </div>

      {/* Active Video Status & Navigation Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E3DFD7] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3 min-w-0">
          <span className="w-9 h-9 rounded-xl bg-emerald-100 text-[#1E5C3D] flex items-center justify-center font-black text-sm shrink-0 border border-emerald-200">
            #{selectedTrainingVideoIndex + 1}
          </span>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-[#5A6B61] tracking-wider block">
              Currently Playing (Video {selectedTrainingVideoIndex + 1} of 9)
            </span>
            <p className="text-sm font-bold text-[#161F1A] truncate">
              {currentVideo.title}
            </p>
            {currentVideo.description && (
              <p className="text-xs text-[#5A6B61] truncate">
                {currentVideo.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {selectedTrainingVideoIndex < 8 && (
            <button
              type="button"
              onClick={() => setSelectedTrainingVideoIndex(prev => Math.min(8, prev + 1))}
              className="px-4 py-2 rounded-xl bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs"
            >
              <span>Play Next Video (#{selectedTrainingVideoIndex + 2})</span>
              <Play className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
        </div>
      </div>

      {/* Bottom Playlist Grid: Jump to Any Video Directly */}
      <div className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#EAE6DE] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#161F1A]">Full Training Playlist (9 Videos)</h3>
            <p className="text-xs text-[#5A6B61]">Click any module below to load and play that video immediately</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-[#1E5C3D] border border-emerald-200 text-xs font-bold">
            9 Modules Available
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {TUTOR_TRAINING_PLAYLIST.map((vid) => {
            const isActive = selectedTrainingVideoIndex === vid.index;
            return (
              <button
                key={vid.index}
                type="button"
                onClick={() => {
                  setSelectedTrainingVideoIndex(vid.index);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 group ${
                  isActive
                    ? 'bg-[#EEF8F3] border-[#2D8B5C] ring-2 ring-[#2D8B5C]/20 shadow-xs'
                    : 'bg-[#FAF9F7] border-[#E3DFD7] hover:bg-white hover:border-[#2D8B5C]/60 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isActive
                      ? 'bg-[#2D8B5C] text-white shadow-2xs'
                      : 'bg-white border border-[#D5D0C6] text-gray-700 group-hover:border-[#2D8B5C] group-hover:text-[#2D8B5C]'
                  }`}>
                    #{vid.number}
                  </span>
                  {isActive ? (
                    <span className="text-[10px] font-bold text-[#2D8B5C] bg-white px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                      <Play className="w-2.5 h-2.5 fill-current" /> Playing Now
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-[#5A6B61] group-hover:text-[#2D8B5C]">
                      Click to Play &rarr;
                    </span>
                  )}
                </div>

                <div>
                  <p className={`text-xs line-clamp-1 ${
                    isActive ? 'font-bold text-[#1E5C3D]' : 'font-semibold text-[#161F1A]'
                  }`}>
                    {vid.title}
                  </p>
                  <p className="text-[11px] text-[#5A6B61] line-clamp-1 mt-0.5">
                    {vid.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
