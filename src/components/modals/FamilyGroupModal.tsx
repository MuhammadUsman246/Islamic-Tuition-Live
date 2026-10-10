import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Check, Trash2, Search } from 'lucide-react';
import { Student } from '../../types';
import { getNextSequentialFamilyId } from '../../services/dataService';

interface FamilyGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onSaveFamilyGroup: (groupName: string, selectedStudentIds: string[], customGroupId?: string) => Promise<void>;
  onRemoveFromFamily: (studentId: string) => Promise<void>;
}

export const FamilyGroupModal: React.FC<FamilyGroupModalProps> = ({
  isOpen,
  onClose,
  students,
  onSaveFamilyGroup,
  onRemoveFromFamily
}) => {
  const [familyGroupId, setFamilyGroupId] = useState('');
  const [familyGroupName, setFamilyGroupName] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [familySearchQuery, setFamilySearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFamilyGroupId(getNextSequentialFamilyId(students));
    }
  }, [isOpen, students]);

  if (!isOpen) return null;

  // Group existing students by family
  const familyMap: { [key: string]: { id: string; name: string; students: Student[] } } = {};
  students.forEach(st => {
    if (st.familyGroupName || st.familyGroupId) {
      const key = st.familyGroupId || st.familyGroupName || 'Unknown';
      const id = st.familyGroupId || key;
      const name = st.familyGroupName || 'Family Group';
      if (!familyMap[key]) {
        familyMap[key] = { id, name, students: [] };
      }
      familyMap[key].students.push(st);
    }
  });

  const filteredFamilies = Object.entries(familyMap).filter(([key, group]) => {
    const q = familySearchQuery.trim().toLowerCase();
    if (!q) return true;
    if (key.toLowerCase().includes(q) || group.id.toLowerCase().includes(q) || group.name.toLowerCase().includes(q)) {
      return true;
    }
    return group.students.some(
      st =>
        st.name.toLowerCase().includes(q) ||
        st.studentId.toLowerCase().includes(q) ||
        (st.parentName && st.parentName.toLowerCase().includes(q)) ||
        (st.parentEmail && st.parentEmail.toLowerCase().includes(q))
    );
  });

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleCreateOrUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!familyGroupName.trim()) {
      setFeedbackMsg('Please enter a Family Group name (e.g., "The Al-Farsi Family").');
      return;
    }

    const cleanFamId = familyGroupId.trim() || getNextSequentialFamilyId(students);

    setIsSaving(true);
    try {
      await onSaveFamilyGroup(familyGroupName.trim(), selectedStudentIds, cleanFamId);
      setFeedbackMsg(`Successfully grouped ${selectedStudentIds.length} member(s) under ${cleanFamId} ("${familyGroupName.trim()}").`);
      setFamilyGroupName('');
      setSelectedStudentIds([]);
      setFamilyGroupId(getNextSequentialFamilyId(students));
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err: any) {
      setFeedbackMsg('Failed to save family group: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectGroupForEditing = (id: string, name: string, members: Student[]) => {
    setFamilyGroupId(/^FAM-\d+$/i.test(id) ? id : getNextSequentialFamilyId(students));
    setFamilyGroupName(name);
    setSelectedStudentIds(members.map(m => m.studentId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-[#E3DFD7] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#1E5C3D] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-lg bg-white/10">
              <Users className="w-5 h-5 text-[#E8A93E]" />
            </span>
            <div>
              <h3 className="font-bold text-base">Family Tree &amp; Sequential Family ID Manager</h3>
              <p className="text-xs text-[#b8dbca]">
                Auto-assign sequential Family IDs (FAM-1001, FAM-1002...) &amp; manage linked children + Dual-Mode Parents
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {feedbackMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* Existing Family Groups + Search Bar */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider">
                Academy Family Trees ({filteredFamilies.length} of {Object.keys(familyMap).length})
              </h4>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-[#5A6B61] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={familySearchQuery}
                  onChange={e => setFamilySearchQuery(e.target.value)}
                  placeholder="Search FAM-1001, family, or student..."
                  className="w-full pl-8 pr-3 py-1.5 bg-[#FAF9F7] border border-[#D5D0C6] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#2D8B5C]"
                />
              </div>
            </div>
            {filteredFamilies.length === 0 ? (
              <p className="text-xs text-[#5A6B61] bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7]">
                {Object.keys(familyMap).length === 0
                  ? 'No students grouped into families yet. Use the form below to create your first family group (starting at FAM-1001).'
                  : `No family trees match "${familySearchQuery}".`}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredFamilies.map(([key, group]) => (
                  <div
                    key={key}
                    className="p-3.5 rounded-xl border border-[#D5D0C6] bg-[#FAF9F7] flex flex-col justify-between hover:border-[#2D8B5C] transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 px-1.5 py-0.5 rounded">
                            {group.id}
                          </span>
                          <span className="text-xs font-bold text-[#1E5C3D] flex items-center gap-1">
                            {group.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSelectGroupForEditing(group.id, group.name, group.students)}
                          className="text-[11px] font-semibold text-[#2D8B5C] hover:underline cursor-pointer shrink-0"
                        >
                          Edit Tree
                        </button>
                      </div>
                      <div className="mt-2 space-y-1">
                        {group.students.map(st => (
                          <div key={st.studentId} className="flex items-center justify-between text-xs text-[#161F1A] bg-white px-2 py-1 rounded border border-[#EAE6DE]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate font-medium">{st.name}</span>
                              <span className="font-mono text-[10px] text-[#5A6B61] shrink-0">({st.studentId})</span>
                              {st.studentType === 'adult' ? (
                                <span className="text-[9px] font-bold bg-sky-100 text-sky-800 px-1 rounded shrink-0">
                                  Parent/Student
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 px-1 rounded shrink-0">
                                  Child
                                </span>
                              )}
                            </div>
                            <div className="flex items-center space-x-1.5 shrink-0">
                              {st.monthlyFee && (
                                <span className="text-[10px] font-bold text-emerald-700">
                                  ${st.monthlyFee}
                                </span>
                              )}
                              <button
                                type="button"
                                title="Remove from family group"
                                onClick={() => onRemoveFromFamily(st.studentId)}
                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form to Create or Edit a Family Group */}
          <form onSubmit={handleCreateOrUpdateGroup} className="bg-white p-4 rounded-xl border border-[#D5D0C6] space-y-4">
            <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#2D8B5C]" />
              Create or Update Sibling Family Tree
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#161F1A]">
                    Sequential Family ID
                  </label>
                  <button
                    type="button"
                    onClick={() => setFamilyGroupId(getNextSequentialFamilyId(students))}
                    className="text-[10px] font-bold text-[#2D8B5C] hover:underline cursor-pointer"
                  >
                    Next Auto ID
                  </button>
                </div>
                <input
                  type="text"
                  value={familyGroupId}
                  onChange={e => setFamilyGroupId(e.target.value)}
                  placeholder="FAM-1001"
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-mono font-bold text-[#1E5C3D] bg-[#FAF9F7]"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#161F1A] mb-1">
                  Family Group Name
                </label>
                <input
                  type="text"
                  value={familyGroupName}
                  onChange={e => setFamilyGroupName(e.target.value)}
                  placeholder='e.g., "The Al-Farsi Family" or "The Khan Family"'
                  className="w-full border border-[#D5D0C6] rounded-lg px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-[#2D8B5C] focus:border-[#2D8B5C]"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#161F1A]">
                  Select Sibling Children to Include in this Family Group ({selectedStudentIds.length} selected)
                </label>
                <span className="text-[11px] text-[#5A6B61]">
                  Click to toggle siblings
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto p-2 border border-[#E3DFD7] rounded-lg bg-[#FAF9F7]">
                {students.map(st => {
                  const isChecked = selectedStudentIds.includes(st.studentId);
                  const isAlreadyInGroup = st.familyGroupName && st.familyGroupName !== familyGroupName;
                  return (
                    <label
                      key={st.studentId}
                      className={`flex items-start space-x-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-[#2D8B5C]/10 border-[#2D8B5C] text-[#161F1A] font-medium'
                          : 'bg-white border-[#E3DFD7] text-[#5A6B61] hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleStudent(st.studentId)}
                        className="mt-0.5 rounded text-[#2D8B5C] focus:ring-[#2D8B5C]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold truncate text-[#161F1A]">{st.name}</span>
                          <span className="font-mono text-[10px] text-gray-500">{st.studentId}</span>
                        </div>
                        <p className="text-[10px] text-[#5A6B61] truncate">
                          Parent: {st.parentName || 'N/A'} {st.monthlyFee ? `• Fee: $${st.monthlyFee}` : ''}
                        </p>
                        {isAlreadyInGroup && (
                          <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded mt-0.5 inline-block">
                            Currently in: {st.familyGroupName}
                          </span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setFamilyGroupName('');
                  setSelectedStudentIds([]);
                }}
                className="px-3 py-1.5 text-xs text-[#5A6B61] hover:bg-gray-100 rounded-lg"
              >
                Clear Selection
              </button>
              <button
                type="submit"
                disabled={isSaving || !familyGroupName.trim()}
                className="px-4 py-2 bg-[#2D8B5C] hover:bg-[#1E5C3D] text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 shadow-xs disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Saving...' : 'Save Family Group'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-[#FAF9F7] border-t border-[#E3DFD7] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-[#5A6B61] hover:bg-gray-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
