import React, { useState, useEffect } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Users,
  Video,
  Shield,
  Bell,
  Share2,
  Clock,
  Search,
  Filter,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { TrashRecord, TrashItemType } from '../../types';
import {
  getTrashRecords,
  restoreTrashRecord,
  permanentlyDeleteTrashRecord,
  emptyTrash
} from '../../services/dataService';

interface TrashRecoveryManagerProps {
  onDataRestored?: () => Promise<void> | void;
}

export const TrashRecoveryManager: React.FC<TrashRecoveryManagerProps> = ({ onDataRestored }) => {
  const [trashList, setTrashList] = useState<TrashRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmEmptyOpen, setConfirmEmptyOpen] = useState(false);

  const loadTrash = async () => {
    setIsLoading(true);
    try {
      const records = await getTrashRecords();
      setTrashList(records);
    } catch (err) {
      console.error('Error loading trash records:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrash();
  }, []);

  const handleRestore = async (trashId: string) => {
    setActionLoadingId(trashId);
    setStatusMessage(null);
    try {
      const result = await restoreTrashRecord(trashId);
      setStatusMessage({ text: result.message, type: 'success' });
      await loadTrash();
      if (onDataRestored) {
        await onDataRestored();
      }
    } catch (err: any) {
      console.error('Failed to restore item:', err);
      setStatusMessage({
        text: err.message || 'Could not restore record due to a conflict.',
        type: 'error'
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePermanentDelete = async (trashId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this record? This action cannot be undone.')) {
      return;
    }
    setActionLoadingId(trashId);
    try {
      await permanentlyDeleteTrashRecord(trashId);
      setStatusMessage({ text: 'Record permanently deleted.', type: 'success' });
      await loadTrash();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to delete record.', type: 'error' });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEmptyTrash = async () => {
    setIsLoading(true);
    setConfirmEmptyOpen(false);
    try {
      await emptyTrash();
      setStatusMessage({ text: 'Trash successfully emptied.', type: 'success' });
      await loadTrash();
    } catch (err: any) {
      setStatusMessage({ text: err.message || 'Failed to empty trash.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const getItemIcon = (type: TrashItemType) => {
    switch (type) {
      case 'class':
        return <Calendar className="w-4 h-4 text-emerald-600" />;
      case 'student':
        return <Users className="w-4 h-4 text-blue-600" />;
      case 'tutor':
        return <Video className="w-4 h-4 text-purple-600" />;
      case 'user':
        return <Shield className="w-4 h-4 text-amber-600" />;
      case 'announcement':
        return <Bell className="w-4 h-4 text-rose-600" />;
      case 'referral':
        return <Share2 className="w-4 h-4 text-indigo-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getItemBadgeClass = (type: TrashItemType) => {
    switch (type) {
      case 'class':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'student':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'tutor':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'user':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'announcement':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'referral':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const filteredTrash = trashList.filter((item) => {
    const matchesFilter = filterType === 'all' || item.itemType === filterType;
    const matchesSearch =
      searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      item.itemType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center font-bold">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#161F1A]">Recently Deleted & Data Recovery</h3>
              <p className="text-xs text-[#5A6B61]">
                Safely restore accidentally removed timetable slots, student records, and faculty profiles without creating duplicate conflicts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadTrash}
            disabled={isLoading}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {trashList.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmEmptyOpen(true)}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Trash</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation for Empty Trash */}
      {confirmEmptyOpen && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-rose-900">Are you sure you want to permanently empty the trash?</h4>
              <p className="text-[11px] text-rose-700">All {trashList.length} deleted items will be irrevocably purged from the database.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmEmptyOpen(false)}
              className="px-3 py-1.5 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEmptyTrash}
              className="px-3 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 cursor-pointer"
            >
              Confirm Empty
            </button>
          </div>
        </div>
      )}

      {/* Status Feedback */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E3DFD7]">
        <div className="flex items-center space-x-2 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search deleted records by title, student, tutor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'All Records' },
            { id: 'class', label: 'Timetable Slots' },
            { id: 'student', label: 'Students' },
            { id: 'tutor', label: 'Faculty' },
            { id: 'user', label: 'Users' },
            { id: 'announcement', label: 'Announcements' },
            { id: 'referral', label: 'Referrals' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                filterType === tab.id
                  ? 'bg-[#2D8B5C] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Records Table / List */}
      <div className="bg-white rounded-2xl border border-[#E3DFD7] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-6 h-6 text-[#2D8B5C] animate-spin mx-auto" />
            <p className="text-xs text-[#5A6B61]">Loading deleted records repository...</p>
          </div>
        ) : filteredTrash.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h4 className="text-sm font-bold text-[#161F1A]">No Deleted Records in Trash</h4>
            <p className="text-xs text-[#5A6B61] max-w-sm mx-auto">
              {searchQuery || filterType !== 'all'
                ? 'No deleted records match your active search or filter.'
                : 'All your timetable slots, students, and faculty profiles are active with zero pending deletions.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF9F7] text-[#5A6B61] font-bold uppercase tracking-wider text-[11px] border-b border-[#E3DFD7]">
                <tr>
                  <th className="py-3 px-4">Item Type</th>
                  <th className="py-3 px-4">Record Title & Info</th>
                  <th className="py-3 px-4">Original ID</th>
                  <th className="py-3 px-4">Deleted Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE6DE]">
                {filteredTrash.map((record) => {
                  const isOperating = actionLoadingId === record.id;
                  return (
                    <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${getItemBadgeClass(
                            record.itemType
                          )}`}
                        >
                          {getItemIcon(record.itemType)}
                          <span className="capitalize">{record.itemType.replace('_', ' ')}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#161F1A] block">{record.title}</span>
                        {record.subtitle && (
                          <span className="text-[11px] text-[#5A6B61] block mt-0.5">{record.subtitle}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 font-semibold">
                        {record.originalId}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 text-[11px] whitespace-nowrap">
                        {new Date(record.deletedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => handleRestore(record.id)}
                          disabled={isOperating}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center space-x-1.5"
                          title="Restore record back to active database"
                        >
                          {isOperating ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePermanentDelete(record.id)}
                          disabled={isOperating}
                          className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 text-xs font-semibold rounded-lg hover:bg-rose-50 transition-colors cursor-pointer inline-flex items-center space-x-1"
                          title="Permanently remove from trash"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Purge</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
