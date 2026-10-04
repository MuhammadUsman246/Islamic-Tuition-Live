import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Shield,
  ShieldCheck,
  Search,
  Filter,
  Check,
  X,
  RotateCcw,
  Sliders,
  HelpCircle,
  Eye,
  Layers,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import {
  DictionaryEntry,
  ProtectedTermEntry,
  getActiveDictionary,
  saveCustomDictionary,
  saveCustomProtectedTerms,
  evaluateTextCorrection,
  INITIAL_VERIFIED_SPELLING_RULES,
  INITIAL_VERIFIED_PHRASE_RULES,
  INITIAL_SUGGESTED_REVIEW_RULES,
  PROTECTED_ACADEMY_TERMS
} from '../../utils/textCorrectionEngine';

export const LessonDictionaryManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'verified' | 'phrases' | 'review' | 'protected' | 'tester'>('verified');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Active entries state
  const [entries, setEntries] = useState<DictionaryEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('it_custom_lesson_dictionary_v1');
        if (stored) {
          const custom: DictionaryEntry[] = JSON.parse(stored);
          return [
            ...INITIAL_VERIFIED_SPELLING_RULES,
            ...INITIAL_VERIFIED_PHRASE_RULES,
            ...INITIAL_SUGGESTED_REVIEW_RULES,
            ...custom
          ];
        }
      } catch (e) {}
    }
    return [
      ...INITIAL_VERIFIED_SPELLING_RULES,
      ...INITIAL_VERIFIED_PHRASE_RULES,
      ...INITIAL_SUGGESTED_REVIEW_RULES
    ];
  });

  const [protectedTerms, setProtectedTerms] = useState<ProtectedTermEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('it_custom_protected_terms_v1');
        if (stored) {
          const custom: ProtectedTermEntry[] = JSON.parse(stored);
          return [...PROTECTED_ACADEMY_TERMS, ...custom];
        }
      } catch (e) {}
    }
    return PROTECTED_ACADEMY_TERMS;
  });

  // Modal / Form states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isAddProtectedModalOpen, setIsAddProtectedModalOpen] = useState<boolean>(false);
  const [editingEntry, setEditingEntry] = useState<DictionaryEntry | null>(null);

  // Form Fields
  const [formWrong, setFormWrong] = useState<string>('');
  const [formCorrect, setFormCorrect] = useState<string>('');
  const [formType, setFormType] = useState<'spelling' | 'phrase'>('spelling');
  const [formCategory, setFormCategory] = useState<any>('Common');
  const [formStatus, setFormStatus] = useState<'verified' | 'suggested_review'>('verified');
  const [formNotes, setFormNotes] = useState<string>('');

  // Protected Form Fields
  const [protectedTermName, setProtectedTermName] = useState<string>('');
  const [protectedCategory, setProtectedCategory] = useState<any>('Islamic Studies');
  const [protectedDesc, setProtectedDesc] = useState<string>('');

  // Live Playground Tester State
  const [testInput, setTestInput] = useState<string>('after etting dua about neigbours');
  const testResult = useMemo(() => evaluateTextCorrection(testInput), [testInput, entries, protectedTerms]);

  // Persist custom entries helper
  const persistChanges = (updatedEntries: DictionaryEntry[]) => {
    setEntries(updatedEntries);
    const initialIds = new Set([
      ...INITIAL_VERIFIED_SPELLING_RULES.map(e => e.id),
      ...INITIAL_VERIFIED_PHRASE_RULES.map(e => e.id),
      ...INITIAL_SUGGESTED_REVIEW_RULES.map(e => e.id)
    ]);
    const customOnly = updatedEntries.filter(e => !initialIds.has(e.id) || e.status !== 'verified');
    saveCustomDictionary(customOnly);
  };

  const persistProtected = (updatedProtected: ProtectedTermEntry[]) => {
    setProtectedTerms(updatedProtected);
    const initialIds = new Set(PROTECTED_ACADEMY_TERMS.map(p => p.id));
    const customOnly = updatedProtected.filter(p => !initialIds.has(p.id));
    saveCustomProtectedTerms(customOnly);
  };

  // Filtered lists
  const filteredVerifiedSpelling = useMemo(() => {
    return entries.filter(e => {
      if (e.type !== 'spelling' || e.status !== 'verified') return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return e.wrong.toLowerCase().includes(q) || e.correct.toLowerCase().includes(q);
      }
      return true;
    });
  }, [entries, searchQuery, categoryFilter]);

  const filteredPhrases = useMemo(() => {
    return entries.filter(e => {
      if (e.type !== 'phrase' || e.status !== 'verified') return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return e.wrong.toLowerCase().includes(q) || e.correct.toLowerCase().includes(q);
      }
      return true;
    });
  }, [entries, searchQuery, categoryFilter]);

  const filteredReview = useMemo(() => {
    return entries.filter(e => {
      if (e.status !== 'suggested_review') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return e.wrong.toLowerCase().includes(q) || e.correct.toLowerCase().includes(q);
      }
      return true;
    });
  }, [entries, searchQuery]);

  const filteredProtected = useMemo(() => {
    return protectedTerms.filter(p => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return p.term.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));
      }
      return true;
    });
  }, [protectedTerms, searchQuery, categoryFilter]);

  // Actions
  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWrong.trim() || !formCorrect.trim()) return;

    if (editingEntry) {
      const updated = entries.map(item =>
        item.id === editingEntry.id
          ? {
              ...item,
              wrong: formWrong.trim(),
              correct: formCorrect.trim(),
              type: formType,
              category: formCategory,
              status: formStatus,
              notes: formNotes.trim() || undefined
            }
          : item
      );
      persistChanges(updated);
    } else {
      const newEntry: DictionaryEntry = {
        id: `rule_${Date.now()}`,
        wrong: formWrong.trim(),
        correct: formCorrect.trim(),
        type: formType,
        category: formCategory,
        confidence: 'high',
        status: formStatus,
        notes: formNotes.trim() || undefined
      };
      persistChanges([newEntry, ...entries]);
    }

    setIsAddModalOpen(false);
    setEditingEntry(null);
    setFormWrong('');
    setFormCorrect('');
  };

  const handleDeleteEntry = (id: string) => {
    if (confirm('Are you sure you want to remove this dictionary correction rule?')) {
      const updated = entries.filter(e => e.id !== id);
      persistChanges(updated);
    }
  };

  const handleApproveReview = (item: DictionaryEntry) => {
    const updated = entries.map(e =>
      e.id === item.id
        ? { ...e, status: 'verified' as const, confidence: 'high' as const }
        : e
    );
    persistChanges(updated);
  };

  const handleSaveProtected = (e: React.FormEvent) => {
    e.preventDefault();
    if (!protectedTermName.trim()) return;

    const newProt: ProtectedTermEntry = {
      id: `prot_${Date.now()}`,
      term: protectedTermName.trim(),
      category: protectedCategory,
      description: protectedDesc.trim() || undefined
    };

    persistProtected([newProt, ...protectedTerms]);
    setIsAddProtectedModalOpen(false);
    setProtectedTermName('');
    setProtectedDesc('');
  };

  const handleDeleteProtected = (id: string) => {
    if (confirm('Are you sure you want to remove this protected term?')) {
      const updated = protectedTerms.filter(p => p.id !== id);
      persistProtected(updated);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER WITH STATS */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#FAF9F7] p-4 sm:p-6 rounded-2xl border border-[#E3DFD7]">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#1E5C3D] text-white text-[10px] font-bold uppercase tracking-wider">
              Smart Correction Engine
            </span>
            <span className="text-xs text-[#5A6B61]">100% Local • Zero AI • Conservative</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#161F1A]">Lesson Notes Dictionary & Smart Correction</h2>
          <p className="text-xs text-[#5A6B61] max-w-2xl">
            Clean up common tutor typos in lesson reports (e.g. <em>"after etting dua"</em> → <em>"After eating dua"</em>) with verified academy rules while protecting sacred Quranic and Islamic terminology.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingEntry(null);
              setFormWrong('');
              setFormCorrect('');
              setFormType('spelling');
              setFormCategory('Adaab');
              setFormStatus('verified');
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Correction Rule</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setProtectedTermName('');
              setProtectedDesc('');
              setIsAddProtectedModalOpen(true);
            }}
            className="px-3.5 py-2 bg-white hover:bg-gray-50 text-[#161F1A] border border-[#D5D0C6] rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-[#2D8B5C]" />
            <span>Add Protected Term</span>
          </button>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white border border-[#E3DFD7] rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#5A6B61]">Verified Spelling</span>
          <p className="text-xl font-bold text-[#2D8B5C]">{filteredVerifiedSpelling.length}</p>
          <span className="text-[10px] text-gray-500">High-confidence word rules</span>
        </div>

        <div className="p-3 bg-white border border-[#E3DFD7] rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#5A6B61]">Verified Phrases</span>
          <p className="text-xl font-bold text-[#1E5C3D]">{filteredPhrases.length}</p>
          <span className="text-[10px] text-gray-500">Multi-word lesson patterns</span>
        </div>

        <div className="p-3 bg-white border border-[#E3DFD7] rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#5A6B61]">Protected Terms</span>
          <p className="text-xl font-bold text-purple-700">{protectedTerms.length}</p>
          <span className="text-[10px] text-gray-500">Sacred/Quranic vocabulary</span>
        </div>

        <div className="p-3 bg-white border border-[#E3DFD7] rounded-xl shadow-2xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#5A6B61]">Review Queue</span>
          <p className="text-xl font-bold text-amber-600">{filteredReview.length}</p>
          <span className="text-[10px] text-gray-500">Uncertain / ambiguous typos</span>
        </div>
      </div>

      {/* NAVIGATION TABS & SEARCH BAR */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAE6DE] pb-2">
          <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveTab('verified')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'verified'
                  ? 'bg-[#2D8B5C] text-white shadow-2xs'
                  : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-gray-100'
              }`}
            >
              <span>Verified Words ({filteredVerifiedSpelling.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('phrases')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'phrases'
                  ? 'bg-[#2D8B5C] text-white shadow-2xs'
                  : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-gray-100'
              }`}
            >
              <span>Phrases ({filteredPhrases.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('protected')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'protected'
                  ? 'bg-[#2D8B5C] text-white shadow-2xs'
                  : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-gray-100'
              }`}
            >
              <span>Protected Terms ({protectedTerms.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('review')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'review'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-gray-100'
              }`}
            >
              <span>Review Queue ({filteredReview.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tester')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === 'tester'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-[#5A6B61] hover:text-[#161F1A] hover:bg-gray-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Live Simulator</span>
            </button>
          </div>

          {activeTab !== 'tester' && (
            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rules..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#D5D0C6] bg-white focus:outline-none focus:border-[#2D8B5C]"
                />
              </div>

              {(activeTab === 'verified' || activeTab === 'phrases' || activeTab === 'protected') && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="text-xs border border-[#D5D0C6] rounded-lg px-2 py-1.5 bg-white text-[#161F1A] focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  <option value="Adaab">Adaab</option>
                  <option value="Dua">Dua</option>
                  <option value="Quran">Quran</option>
                  <option value="Qaida">Qaida</option>
                  <option value="Salah">Salah</option>
                  <option value="Kalma">Kalma</option>
                  <option value="Islamic Studies">Islamic Studies</option>
                  <option value="Common">Common</option>
                </select>
              )}
            </div>
          )}
        </div>

        {/* 1. VERIFIED SPELLING TAB */}
        {activeTab === 'verified' && (
          <div className="bg-white rounded-xl border border-[#E3DFD7] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F7] text-[#5A6B61] border-b border-[#E3DFD7]">
                    <th className="py-2.5 px-3 font-semibold">Tutor Typo (Wrong)</th>
                    <th className="py-2.5 px-3 font-semibold">Clean Replacement (Correct)</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold">Confidence</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE6DE]">
                  {filteredVerifiedSpelling.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 text-xs">
                        No spelling rules found matching your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredVerifiedSpelling.map((rule) => (
                      <tr key={rule.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-700">
                          {rule.wrong}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1E5C3D]">
                          {rule.correct}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-800">
                            {rule.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Verified (High)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEntry(rule);
                                setFormWrong(rule.wrong);
                                setFormCorrect(rule.correct);
                                setFormType(rule.type as any);
                                setFormCategory(rule.category);
                                setFormStatus(rule.status);
                                setFormNotes(rule.notes || '');
                                setIsAddModalOpen(true);
                              }}
                              className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                              title="Edit rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(rule.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                              title="Delete rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. PHRASES TAB */}
        {activeTab === 'phrases' && (
          <div className="bg-white rounded-xl border border-[#E3DFD7] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F7] text-[#5A6B61] border-b border-[#E3DFD7]">
                    <th className="py-2.5 px-3 font-semibold">Tutor Phrase (Wrong / Short)</th>
                    <th className="py-2.5 px-3 font-semibold">Clean Phrase (Correct)</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE6DE]">
                  {filteredPhrases.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500 text-xs">
                        No phrase rules found matching your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPhrases.map((phrase) => (
                      <tr key={phrase.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-rose-700 font-semibold">
                          "{phrase.wrong}"
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[#1E5C3D] font-bold">
                          "{phrase.correct}"
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-800">
                            {phrase.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEntry(phrase);
                                setFormWrong(phrase.wrong);
                                setFormCorrect(phrase.correct);
                                setFormType('phrase');
                                setFormCategory(phrase.category);
                                setFormStatus(phrase.status);
                                setFormNotes(phrase.notes || '');
                                setIsAddModalOpen(true);
                              }}
                              className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                              title="Edit phrase"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(phrase.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                              title="Delete phrase"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. PROTECTED TERMS TAB */}
        {activeTab === 'protected' && (
          <div className="bg-white rounded-xl border border-[#E3DFD7] overflow-hidden shadow-2xs space-y-4 p-4">
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-start space-x-2">
              <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block">Sacred & Academic Terminology Guard</strong>
                <span>
                  These terms are strictly preserved and never aggressively auto-corrected or rewritten. Standard title-casing is respected.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {filteredProtected.map((prot) => (
                <div
                  key={prot.id}
                  className="p-2.5 bg-[#FAF9F7] border border-[#E3DFD7] rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-[#161F1A] text-xs font-mono block truncate">
                      {prot.term}
                    </span>
                    <span className="text-[10px] text-[#5A6B61] block truncate">
                      {prot.category} {prot.description ? `• ${prot.description}` : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteProtected(prot.id)}
                    className="text-gray-400 hover:text-rose-600 p-1 cursor-pointer shrink-0"
                    title="Remove from protected list"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. REVIEW QUEUE TAB */}
        {activeTab === 'review' && (
          <div className="bg-white rounded-xl border border-[#E3DFD7] overflow-hidden shadow-2xs space-y-4 p-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block">Ambiguous & Unverified Submissions Queue</strong>
                <span>
                  These typos appeared in lesson logs but were NOT auto-applied to tutors to prevent false corrections. You can approve or edit them into verified rules.
                </span>
              </div>
            </div>

            <div className="divide-y divide-[#EAE6DE] border border-[#E3DFD7] rounded-xl overflow-hidden">
              {filteredReview.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  Review queue is clean! No unverified typos pending.
                </div>
              ) : (
                filteredReview.map((rev) => (
                  <div key={rev.id} className="p-3 flex flex-wrap items-center justify-between gap-3 bg-white hover:bg-gray-50">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-rose-700 text-xs">"{rev.wrong}"</span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="font-mono font-bold text-emerald-800 text-xs">"{rev.correct}"</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                          {rev.category}
                        </span>
                      </div>
                      {rev.notes && <p className="text-[11px] text-gray-500">{rev.notes}</p>}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveReview(rev)}
                        className="px-3 py-1 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer shadow-2xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve to Verified</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(rev.id)}
                        className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 5. LIVE SIMULATOR / TEST PLAYGROUND */}
        {activeTab === 'tester' && (
          <div className="bg-white rounded-xl border border-[#E3DFD7] p-5 space-y-4 shadow-2xs">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-[#2D8B5C]" />
              <h3 className="text-sm font-bold text-[#161F1A]">Live Correction Engine Playground</h3>
            </div>
            <p className="text-xs text-[#5A6B61]">
              Type or paste any lesson notes below to test how the rule-based engine evaluates formatting, spelling, phrases, and sacred terminology.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#161F1A]">Tutor Input Text:</label>
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                rows={3}
                className="w-full border border-[#D5D0C6] rounded-xl p-3 text-xs font-mono bg-[#FAF9F7] focus:outline-none focus:border-[#2D8B5C]"
                placeholder="Type lesson notes..."
              />
            </div>

            {/* Quick Test Samples */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-gray-500 font-medium mr-1">Try samples:</span>
              {[
                'after etting dua',
                'after ettin dua',
                'about neigbours',
                'respect our brother and sister',
                'drink milking',
                'page page no-----11',
                'MEMORIZATION',
                'Quran page 224',
                'Juz 30 Surah An-Nas Ayah 1',
                'salipingmunner'
              ].map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setTestInput(sample)}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-900 text-gray-700 rounded-md font-mono text-[10px] cursor-pointer transition-colors"
                >
                  {sample}
                </button>
              ))}
            </div>

            {/* Live Result Card */}
            <div className="p-4 rounded-xl border border-[#E3DFD7] bg-[#FAF9F7] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#161F1A] flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 ${testResult.hasChanges ? 'text-[#2D8B5C]' : 'text-gray-400'}`} />
                  <span>Engine Output:</span>
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  testResult.hasChanges ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-700'
                }`}>
                  {testResult.hasChanges ? 'Suggestion Generated' : 'No Changes Needed'}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-[#E3DFD7] font-mono text-xs text-[#1E5C3D] font-bold">
                {testResult.suggestedText}
              </div>

              {testResult.explanations.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-[#EAE6DE]">
                  <span className="text-[10px] font-bold text-gray-500 uppercase">Rules Applied:</span>
                  <ul className="text-[11px] text-slate-700 list-disc list-inside space-y-0.5">
                    {testResult.explanations.map((exp, i) => (
                      <li key={i}>{exp}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ADD / EDIT RULE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE6DE] pb-3">
              <h3 className="font-bold text-sm text-[#161F1A]">
                {editingEntry ? 'Edit Correction Rule' : 'Add New Correction Rule'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                  Rule Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white font-medium focus:outline-none"
                >
                  <option value="spelling">Spelling Mistake (Single Word)</option>
                  <option value="phrase">Phrase Correction (Multiple Words)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                  Tutor Typo (Wrong text to detect) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formWrong}
                  onChange={(e) => setFormWrong(e.target.value)}
                  placeholder="e.g. etting or after etting dua"
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-1.5 font-mono text-xs bg-white focus:outline-none focus:border-[#2D8B5C]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                  Clean Replacement (Correct Text) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formCorrect}
                  onChange={(e) => setFormCorrect(e.target.value)}
                  placeholder="e.g. eating or After eating dua"
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-1.5 font-mono text-xs bg-white focus:outline-none focus:border-[#2D8B5C]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-[#161F1A] mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as any)}
                    className="w-full border border-[#D5D0C6] rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                  >
                    <option value="Adaab">Adaab</option>
                    <option value="Dua">Dua</option>
                    <option value="Quran">Quran</option>
                    <option value="Qaida">Qaida</option>
                    <option value="Salah">Salah</option>
                    <option value="Kalma">Kalma</option>
                    <option value="Islamic Studies">Islamic Studies</option>
                    <option value="Common">Common</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#161F1A] mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full border border-[#D5D0C6] rounded-lg px-2 py-1.5 bg-white focus:outline-none"
                  >
                    <option value="verified">Verified (High Confidence)</option>
                    <option value="suggested_review">Suggested Review Queue</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Reason or lesson context..."
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#EAE6DE]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD PROTECTED TERM MODAL */}
      {isAddProtectedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE6DE] pb-3">
              <h3 className="font-bold text-sm text-[#161F1A]">Add Protected Term</h3>
              <button
                type="button"
                onClick={() => setIsAddProtectedModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProtected} className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                  Term Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={protectedTermName}
                  onChange={(e) => setProtectedTermName(e.target.value)}
                  placeholder="e.g. Makharij, Ghunnah, Kalima, Surah..."
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-1.5 font-mono text-xs bg-white focus:outline-none focus:border-[#2D8B5C]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">Category</label>
                <select
                  value={protectedCategory}
                  onChange={(e) => setProtectedCategory(e.target.value as any)}
                  className="w-full border border-[#D5D0C6] rounded-lg px-2.5 py-1.5 bg-white focus:outline-none"
                >
                  <option value="Quran">Quran</option>
                  <option value="Qaida">Qaida</option>
                  <option value="Dua">Dua</option>
                  <option value="Islamic Studies">Islamic Studies</option>
                  <option value="Arabic / Tajweed">Arabic / Tajweed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={protectedDesc}
                  onChange={(e) => setProtectedDesc(e.target.value)}
                  placeholder="e.g. Tajweed rule for nunation..."
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#EAE6DE]">
                <button
                  type="button"
                  onClick={() => setIsAddProtectedModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-gray-600 hover:text-gray-900 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                >
                  Save Protected Term
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
