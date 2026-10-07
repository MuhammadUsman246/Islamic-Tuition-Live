import React from 'react';
import { Sparkles, RefreshCw, X, ArrowUpCircle } from 'lucide-react';
import { useAppUpdateChecker } from '../../utils/useAppUpdateChecker';

export const AppUpdateBanner: React.FC = () => {
  const { isUpdateAvailable, newVersion, isUpdating, applyUpdate, dismissUpdate } = useAppUpdateChecker();

  if (!isUpdateAvailable) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[94%] sm:w-auto animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-auto"
    >
      <div className="bg-[#0B1510]/95 backdrop-blur-md border border-[#2D8B5C] rounded-2xl p-3 sm:px-4 sm:py-3 shadow-2xl text-white flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-white text-xs tracking-tight">
                New Update Live!
              </span>
              {newVersion && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-400/30">
                  {newVersion}
                </span>
              )}
            </div>
            <p className="text-[11px] text-emerald-200/80 truncate mt-0.5">
              Instant reload from local cache · Zero database reads
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            type="button"
            onClick={applyUpdate}
            disabled={isUpdating}
            className="px-3.5 py-1.5 rounded-xl bg-[#2D8B5C] hover:bg-[#1E5C3D] active:scale-95 text-white font-bold text-xs flex items-center space-x-1.5 cursor-pointer shadow-md transition-all ring-1 ring-emerald-300/40"
            title="Click to update in < 1 second"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <ArrowUpCircle className="w-3.5 h-3.5 text-amber-300" />
                <span>Update Now</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={dismissUpdate}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
