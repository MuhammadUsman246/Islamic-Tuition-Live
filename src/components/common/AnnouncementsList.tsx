import React from 'react';
import { Bell, Calendar, Megaphone, Trash2 } from 'lucide-react';
import { Announcement } from '../../types';

interface AnnouncementsListProps {
  announcements: Announcement[];
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
}

export const AnnouncementsList: React.FC<AnnouncementsListProps> = ({
  announcements,
  isAdmin = false,
  onDelete
}) => {
  if (!announcements || announcements.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-[#E3DFD7] text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#2D8B5C] flex items-center justify-center mx-auto">
          <Megaphone className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-[#161F1A]">No Active Announcements</h4>
        <p className="text-xs text-[#5A6B61] max-w-sm mx-auto">
          There are no scheduled or active announcements for you right now. Check back later for updates from the Academy Directorate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold text-[#161F1A] flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#2D8B5C]" />
            Academy Announcements & Bulletins
          </h3>
          <p className="text-xs text-[#5A6B61]">Important updates, policy notices, and time-based announcements.</p>
        </div>
        <span className="text-xs bg-emerald-100 text-[#1E5C3D] font-bold px-3 py-1 rounded-full">
          {announcements.length} Active
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {announcements.map((ann) => (
          <div
            key={ann.id}
            className="bg-white p-5 rounded-2xl border border-[#E3DFD7] shadow-xs hover:border-[#2D8B5C] transition-all space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2D8B5C]" />
                  <h4 className="text-sm font-bold text-[#161F1A]">{ann.title}</h4>
                  {ann.pinned && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded">
                      Pinned
                    </span>
                  )}
                </div>
              </div>

              {isAdmin && onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(ann.id)}
                  className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete Announcement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-xs text-[#5A6B61] leading-relaxed whitespace-pre-wrap">{ann.content}</p>

            {ann.link && (
              <div className="pt-1">
                <a
                  href={ann.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2D8B5C] hover:underline"
                >
                  <span>🔗 Important Link / Resource</span>
                </a>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between text-[11px] text-[#5A6B61] pt-2 border-t border-[#F2EFE9]">
              <div className="flex items-center gap-1">
                <span>By {ann.authorName}</span>
                <span>•</span>
                <span>{new Date(ann.createdAt).toLocaleDateString()}</span>
              </div>

              {(ann.startDate || ann.endDate) && (
                <div className="flex items-center gap-1.5 font-medium bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                  <Calendar className="w-3 h-3" />
                  <span>Active: {ann.startDate || 'Now'} → {ann.endDate || 'No Expiry'}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
