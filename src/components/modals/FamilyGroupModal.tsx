import React, { useState } from 'react';
import { X, Users, Plus, Check, Trash2 } from 'lucide-react';
import { Student } from '../../types';

interface FamilyGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onSaveFamilyGroup: (groupName: string, selectedStudentIds: string[]) => Promise<void>;
  onRemoveFromFamily: (studentId: string) => Promise<void>;
}

export const FamilyGroupModal: React.FC<FamilyGroupModalProps> = ({
  isOpen,
  onClose,
  students,
  onSaveFamilyGroup,
  onRemoveFromFamily
}) => {
  const [familyGroupName, setFamilyGroupName] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Group existing students by family
  const familyMap: { [key: string]: { name: string; students: Student[] } } = {};
  students.forEach(st => {
    if (st.familyGroupName || st.familyGroupId) {
      const key = st.familyGroupId || st.familyGroupName || 'Unknown';
      const name = st.familyGroupName || 'Family Group';
      if (!familyMap[key]) {
        familyMap[key] = { name, students: [] };
      }
      familyMap[key].students.push(st);
    }
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
      alert('Please enter a Family Group name (e.g., "The Al-Farsi Family").');
      return;
    }
    if (selectedStudentIds.length < 2) {
      if (!confirm('You have selected fewer than 2 children for this family group. Do you want to proceed?')) {
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSaveFamilyGroup(familyGroupName.trim(), selectedStudentIds);
      setFeedbackMsg(`Successfully grouped ${selectedStudentIds.length} students under "${familyGroupName.trim()}".`);
      setFamilyGroupName('');
      setSelectedStudentIds([]);
      setTimeout(() => setFeedbackMsg(null), 3000);
    } catch (err: any) {
      alert('Failed to save family group: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectGroupForEditing = (name: string, members: Student[]) => {
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
              <h3 className="font-bold text-base">Family Fee & Sibling Grouping</h3>
              <p className="text-xs text-[#b8dbca]">
                Group multiple children under a single Family Group (e.g., "The Al-Farsi Family")
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
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

          {/* Existing Family Groups */}
          <div>
            <h4 className="text-xs font-bold text-[#161F1A] uppercase tracking-wider mb-2">
              Existing Academy Family Groups ({Object.keys(familyMap).length})
            </h4>
            {Object.keys(familyMap).length === 0 ? (
              <p className="text-xs text-[#5A6B61] bg-[#FAF9F7] p-3 rounded-lg border border-[#E3DFD7]">
                No students grouped into families yet. Use the form below to create your first family group (e.g., "The Al-Farsi Family").
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(familyMap).map(([key, group]) => (
                  <div
                    key={key}
                    className="p-3.5 rounded-xl border border-[#D5D0C6] bg-[#FAF9F7] flex flex-col justify-between hover:border-[#2D8B5C] transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1E5C3D] flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-[#2D8B5C]" />
                          {group.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSelectGroupForEditing(group.name, group.students)}
                          className="text-[11px] font-semibold text-[#2D8B5C] hover:underline"
                        >
                          Edit Group
                        </button>
                      </div>
                      <div className="mt-2 space-y-1">
                        {group.students.map(st => (
                          <div key={st.studentId} className="flex items-center justify-between text-xs text-[#161F1A] bg-white px-2 py-1 rounded border border-[#EAE6DE]">
                            <span>{st.name} <span className="font-mono text-[10px] text-[#5A6B61]">({st.studentId})</span></span>
                            <div className="flex items-center space-x-1.5">
                              {st.monthlyFee && (
                                <span className="text-[10px] font-bold text-emerald-700">
                                  ${st.monthlyFee}
                                </span>
                              )}
                              <button
                                type="button"
                                title="Remove from family group"
                                onClick={() => onRemoveFromFamily(st.studentId)}
                                className="text-rose-500 hover:text-rose-700 p-0.5"
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
              Create or Update Sibling Family Group
            </h4>

            <div>
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
