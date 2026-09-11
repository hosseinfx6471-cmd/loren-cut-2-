import React, { useState } from 'react';
import { Scissors, Calendar, Lock, Menu, X, Send, Instagram, MessageCircle, MapPin } from 'lucide-react';
import { InstallPwaModal } from './InstallPwaModal';

interface HeaderProps {
  onOpenBooking: () => void;
  onOpenAdmin: () => void;
  telegramUrl: string;
  instagramUrl: string;
  whatsappUrl?: string;
  googleMapsUrl?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBooking,
  onOpenAdmin,
  telegramUrl,
  instagramUrl,
  whatsappUrl,
  googleMapsUrl
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const tgUrl = telegramUrl || 'https://t.me/Mohamadsabzevar';
  const instaUrl = instagramUrl || 'https://www.instagram.com/lorencut_?igsh=MTU3ZXZ5cWtodTFqOQ==';
  const waUrl = whatsappUrl || 'https://wa.me/989167209686';
  const mapsUrl = googleMapsUrl || 'https://maps.app.goo.gl/treLYmP7oPh6RE468?g_st=ic';

  const navLinks = [
    { label: 'صفحه اصلی', href: '#hero' },
    { label: 'خدمات VIP', href: '#special-services' },
    { label: 'نوبت‌دهی آنلاین', href: '#booking' },
    { label: 'ارتباط با ما', href: '#contact' },
  ];

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#f5f2eb]/85 border-b border-black/10 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Brand Logo */}
          <a href="#hero" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-xl bg-black p-0.5 flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-105">
              <div className="w-full h-full bg-[#121212] rounded-[10px] flex items-center justify-center">
                <Scissors className="w-5 h-5 text-[#c5a059] transform -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="font-cinzel text-xl md:text-2xl font-bold tracking-widest text-black">
                LOREN CUT
              </span>
              <span className="text-[10px] text-[#c5a059] tracking-wider -mt-1 font-semibold uppercase">
                Professional Grooming
              </span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium">
            {navLinks.map((link, idx) => (
              <button
                key={idx}
                onClick={() => handleNavClick(link.href)}
                className="text-gray-700 hover:text-black transition-colors duration-200 relative py-1 hover:after:w-full after:w-0 after:h-0.5 after:bg-[#c5a059] after:absolute after:bottom-0 after:right-0 after:transition-all after:duration-300"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Action Buttons & Social */}
          <div className="hidden md:flex items-center gap-2 sm:gap-3">
            {/* Install PWA Button */}
            <InstallPwaModal />

            {/* Social & Location Quick Links */}
            <a
              href={tgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white/80 text-black hover:text-white hover:bg-[#0088cc] border border-black/10 transition-all duration-200 shadow-sm"
              title="ارتباط در تلگرام"
            >
              <Send className="w-4 h-4" />
            </a>
            <a
              href={instaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white/80 text-black hover:text-white hover:bg-rose-600 border border-black/10 transition-all duration-200 shadow-sm"
              title="اینستاگرام Loren Cut"
            >
              <Instagram className="w-4 h-4" />
            </a>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white/80 text-black hover:text-white hover:bg-emerald-600 border border-black/10 transition-all duration-200 shadow-sm"
              title="ارتباط در واتساپ"
            >
              <MessageCircle className="w-4 h-4" />
            </a>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl bg-white/80 text-black hover:text-white hover:bg-amber-600 border border-black/10 transition-all duration-200 shadow-sm"
              title="مسیریابی سالن در گوگل مپ"
            >
              <MapPin className="w-4 h-4 text-[#c5a059]" />
            </a>

            {/* Admin Key Button */}
            <button
              onClick={onOpenAdmin}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 hover:bg-black text-gray-800 hover:text-white border border-black/10 text-xs font-semibold transition-all duration-200 shadow-sm"
              title="پنل مدیریت مدیر"
            >
              <Lock className="w-3.5 h-3.5 text-[#c5a059]" />
              <span>پنل مدیر</span>
            </button>

            {/* Main Booking Button */}
            <button
              onClick={onOpenBooking}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1a1a1a] hover:bg-[#333333] text-[#f5f2eb] font-bold text-sm shadow-md transition-all duration-200"
            >
              <Calendar className="w-4 h-4 text-[#c5a059]" />
              <span>رزرو سریع نوبت</span>
            </button>
          </div>

          {/* Mobile Hamburger Trigger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onOpenAdmin}
              className="p-2 rounded-xl bg-white/80 text-black border border-black/10"
              title="ورود مدیر"
            >
              <Lock className="w-4 h-4 text-[#c5a059]" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-white/80 text-black border border-black/10"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden glass border-b border-black/10 px-4 pt-3 pb-6 space-y-3 animate-fadeIn">
          <div className="flex flex-col space-y-2 pb-3 border-b border-black/10">
            {navLinks.map((link, idx) => (
              <button
                key={idx}
                onClick={() => handleNavClick(link.href)}
                className="text-right py-2 px-3 text-sm font-medium text-gray-800 hover:text-black hover:bg-black/5 rounded-lg"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <div className="w-full flex justify-center pb-1">
              <InstallPwaModal />
            </div>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenBooking();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1a1a1a] text-[#f5f2eb] font-bold text-sm shadow-sm cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-[#c5a059]" />
              <span>رزرو سریع نوبت</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAdmin();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/90 text-black border border-black/15 text-xs font-bold shadow-sm cursor-pointer hover:bg-black hover:text-white transition-all"
            >
              <Lock className="w-3.5 h-3.5 text-[#c5a059]" />
              <span>ورود به پنل مدیریت سالن</span>
            </button>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <a
                href={tgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-black bg-white/80 px-2.5 py-2 rounded-xl border border-black/10 font-semibold"
              >
                <Send className="w-3.5 h-3.5 text-[#0088cc]" />
                <span>تلگرام</span>
              </a>
              <a
                href={instaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-black bg-white/80 px-2.5 py-2 rounded-xl border border-black/10 font-semibold"
              >
                <Instagram className="w-3.5 h-3.5 text-rose-600" />
                <span>اینستاگرام</span>
              </a>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-black bg-white/80 px-2.5 py-2 rounded-xl border border-black/10 font-semibold"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span>واتساپ</span>
              </a>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-black bg-white/80 px-2.5 py-2 rounded-xl border border-black/10 font-semibold"
              >
                <MapPin className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>گوگل مپ</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
