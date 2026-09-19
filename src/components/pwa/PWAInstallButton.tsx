import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../../utils/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'compact' | 'floating' }> = ({
  variant = 'header',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If already installed and launched standalone, hide prompt entirely
  if (isInstalled || dismissed) {
    return null;
  }

  // Android / Chrome / Edge / Desktop flow with native deferred prompt
  if (isInstallable) {
    if (variant === 'compact') {
      return (
        <button
          onClick={install}
          title="Install App to Home Screen"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#143A27] text-white text-xs font-semibold hover:bg-[#1A4A32] shadow-sm transition-all cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-[#F5C042]" />
          <span>Install App</span>
        </button>
      );
    }

    return (
      <button
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#143A27] text-white text-xs font-semibold hover:bg-[#1A4A32] shadow-sm transition-all cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#F5C042]" />
        <span>Add to Home Screen</span>
      </button>
    );
  }

  // iOS Safari flow (Safari does not emit beforeinstallprompt, provide clean 2-step guide)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-[#143A27] border border-emerald-200 text-xs font-semibold hover:bg-emerald-100 transition-all cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5 text-[#2D8B5C]" />
          <span>Install App (iOS)</span>
        </button>

        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-[#D5D0C6] relative">
              <button
                onClick={() => setShowIOSModal(false)}
                className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#143A27] flex items-center justify-center p-2 shadow-inner">
                  <img src="/pwa-192x192.png" alt="IslamicTuition Logo" className="w-full h-full object-contain rounded-lg" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#161F1A]">Install IslamicTuition</h3>
                  <p className="text-xs text-[#5A6B61]">Add to your iPhone / iPad Home Screen</p>
                </div>
              </div>

              <div className="space-y-3 bg-[#F8F6F0] p-4 rounded-xl text-xs text-[#161F1A]">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#143A27] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="flex-1">
                    Tap the <strong className="font-semibold inline-flex items-center gap-1">Share <Share className="w-3.5 h-3.5 text-[#2D8B5C] inline" /></strong> button in your Safari navigation bar.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#143A27] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="flex-1">
                    Scroll down and select <strong className="font-semibold inline-flex items-center gap-1">Add to Home Screen <PlusSquare className="w-3.5 h-3.5 text-[#2D8B5C] inline" /></strong>.
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={() => setShowIOSModal(false)}
                  className="w-full py-2.5 rounded-xl bg-[#143A27] text-white text-xs font-semibold hover:bg-[#1A4A32] transition-colors"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
