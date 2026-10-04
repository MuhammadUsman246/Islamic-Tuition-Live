import React, { useState } from 'react';
import { BookOpen, X, Search, FileText, CheckCircle2, ExternalLink, Sparkles } from 'lucide-react';

export interface LearningMaterialItem {
  id: string;
  title: string;
  category: 'Qaida' | 'Quran' | 'Tajweed' | 'Hadith' | 'Duas';
  description: string;
  pdfUrl: string;
  pageCount?: number;
}

export const ACADEMY_LEARNING_MATERIALS: LearningMaterialItem[] = [
  {
    id: 'mat_qaida_full',
    title: 'Complete Noorani Qaida (Lessons 1 - 29)',
    category: 'Qaida',
    description: 'Standard foundational Tajweed alphabet, vowels (Harakat), Tanween, Sukoon, and Madd rules.',
    pdfUrl: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey.pdf', // Reliable fallback public sample
    pageCount: 32
  },
  {
    id: 'mat_tajweed_rules',
    title: 'Complete Tajweed Rules & Pronunciation Guide',
    category: 'Tajweed',
    description: 'Ghunnah, Ikhfa, Idgham, Qalqalah, and Makharij (articulation points) with color diagrams.',
    pdfUrl: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey.pdf',
    pageCount: 45
  },
  {
    id: 'mat_quran_juz30',
    title: 'Quran Juz 30 (Amma) - High Resolution 15-Line',
    category: 'Quran',
    description: 'Surah An-Naba to Surah An-Nas for Hifz and Nazra revision.',
    pdfUrl: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey.pdf',
    pageCount: 30
  },
  {
    id: 'mat_hadith_40',
    title: 'An-Nawawi 40 Hadith (Arabic & English)',
    category: 'Hadith',
    description: 'Core prophetic traditions with concise commentary for Islamic studies students.',
    pdfUrl: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey.pdf',
    pageCount: 50
  },
  {
    id: 'mat_duas_hisn',
    title: 'Daily Duas & Masnoon Supplications',
    category: 'Duas',
    description: 'Morning/Evening Adhkar, Kalimas, and daily prayers with transliteration.',
    pdfUrl: 'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey.pdf',
    pageCount: 20
  }
];

interface LearningLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMaterial: (material: LearningMaterialItem) => void;
}

export const LearningLibraryModal: React.FC<LearningLibraryModalProps> = ({
  isOpen,
  onClose,
  onSelectMaterial
}) => {
  const [searchTerm, setSearchCategory] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = ['All', 'Qaida', 'Quran', 'Tajweed', 'Hadith', 'Duas'];

  const filteredMaterials = ACADEMY_LEARNING_MATERIALS.filter(m => {
    const matchesCat = selectedCategory === 'All' || m.category === selectedCategory;
    const matchesSearch = m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          m.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-[10000] animate-in fade-in select-none">
      <div className="bg-[#0D1812] border border-[#223D2E] text-white rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#223D2E] pb-3 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Academy Quran & Qaida Library
              </h3>
              <p className="text-xs text-[#8AA393]">
                Hosted Learning Materials (Zero Chrome Popup Bar)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills & Search */}
        <div className="space-y-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-[#15241B] hover:bg-[#1E3327] text-[#8AA393] border border-[#264232]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchCategory(e.target.value)}
              placeholder="Search Qaida, Surah, Tajweed rules, or Duas..."
              className="w-full bg-[#070C09] border border-[#284736] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* List of Hosted Materials */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredMaterials.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-400">
              No learning materials found matching "{searchTerm}".
            </div>
          ) : (
            filteredMaterials.map(m => (
              <div
                key={m.id}
                className="p-3.5 rounded-2xl bg-[#121F17] border border-[#244030] hover:border-emerald-500/60 transition-all flex items-center justify-between gap-3 group"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {m.category}
                    </span>
                    <h4 className="text-xs font-bold text-white truncate">{m.title}</h4>
                  </div>
                  <p className="text-[11px] text-[#8AA393] leading-snug line-clamp-2">
                    {m.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onSelectMaterial(m);
                    onClose();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 transition-all shadow-md cursor-pointer flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Present on Stage</span>
                </button>
              </div>
            ))
          )}
        </div>

        <div className="pt-2 border-t border-[#223D2E] text-center text-[10px] text-gray-400 shrink-0">
          Tip: Presenting hosted materials inside the app streams HD PDF pages directly to your student with <strong>zero Chrome popup bar</strong>.
        </div>
      </div>
    </div>
  );
};
