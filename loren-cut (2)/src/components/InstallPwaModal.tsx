import React, { useState, useEffect } from 'react';
import { Download, X, Share, Scissors } from 'lucide-react';

interface InstallPwaModalProps {
  className?: string;
  variant?: 'header' | 'hero';
}

export const InstallPwaModal: React.FC<InstallPwaModalProps> = ({
  className,
  variant = 'header'
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // Listen for BeforeInstallPrompt on Android / Chrome
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Listen for app installed
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setIsOpen(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsOpen(false);
        return;
      }
    }
    setIsOpen(true);
  };

  if (isInstalled && variant === 'header') {
    return null;
  }

  return (
    <>
      {/* Trigger Button */}
      {variant === 'hero' ? (
        <button
          type="button"
          onClick={handleInstallClick}
          id="install-pwa-hero-btn"
          className={className || "w-full sm:w-auto px-8 py-4 rounded-2xl glass hover:bg-black hover:text-white text-black font-semibold text-base border border-black/10 transition-all duration-300 flex items-center justify-center gap-3 shadow-sm group cursor-pointer"}
          title="نصب اپلیکیشن لورن کات روی گوشی"
        >
          <Download className="w-5 h-5 text-[#c5a059] group-hover:scale-110 transition-transform" />
          <span>نصب اپلیکیشن</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          id="install-pwa-btn"
          className={className || "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-[#c5a059] hover:bg-[#1f1f1f] text-xs font-semibold border border-[#c5a059]/40 shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"}
          title="نصب اپلیکیشن لورن کات"
        >
          <Download className="w-3.5 h-3.5 text-[#c5a059]" />
          <span>نصب اپلیکیشن</span>
        </button>
      )}

      {/* Guidance Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm bg-[#18181b] border border-[#c5a059]/40 rounded-2xl shadow-2xl p-6 text-white text-center">
            
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 left-4 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Brand Logo & Name */}
            <div className="flex flex-col items-center justify-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-black border border-[#c5a059] flex items-center justify-center shadow-lg mb-2.5">
                <Scissors className="w-7 h-7 text-[#c5a059] transform -rotate-45" />
              </div>
              <h3 className="text-lg font-bold text-white font-cinzel tracking-widest">LOREN CUT</h3>
              <p className="text-xs text-[#c5a059] font-medium mt-0.5">نصب اپلیکیشن</p>
            </div>

            {/* Instruction Box */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3 text-right mb-5">
              <div className="p-2 rounded-lg bg-black border border-[#c5a059]/30 text-[#c5a059] shrink-0">
                <Share className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-gray-200 leading-relaxed">
                دکمه Share سفری را بزنید و سپس «Add to Home Screen» را انتخاب کنید.
              </p>
            </div>

            {/* Confirm Button */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 rounded-xl bg-[#c5a059] hover:bg-[#b38f4a] text-black font-bold text-xs transition-all shadow-md"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};
