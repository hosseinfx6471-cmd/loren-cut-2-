import React from 'react';
import { Scissors, Send, Instagram, MessageCircle, MapPin, Lock, Clock } from 'lucide-react';

interface FooterProps {
  onOpenAdmin: () => void;
  telegramUrl: string;
  instagramUrl: string;
  whatsappUrl?: string;
  googleMapsUrl?: string;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenAdmin,
  telegramUrl,
  instagramUrl,
  whatsappUrl,
  googleMapsUrl
}) => {
  const tgUrl = telegramUrl || 'https://t.me/Mohamadsabzevar';
  const instaUrl = instagramUrl || 'https://www.instagram.com/lorencut_?igsh=MTU3ZXZ5cWtodTFqOQ==';
  const waUrl = whatsappUrl || 'https://wa.me/989167209686';
  const mapsUrl = googleMapsUrl || 'https://maps.app.goo.gl/treLYmP7oPh6RE468?g_st=ic';

  return (
    <footer id="contact" className="bg-[#000000] text-[#f5f2eb] border-t border-black/20 pt-16 pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
        
        {/* Brand Col */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] p-0.5 flex items-center justify-center border border-white/10">
              <Scissors className="w-5 h-5 text-[#c5a059]" />
            </div>
            <span className="font-cinzel text-xl font-bold tracking-widest text-white">
              LOREN CUT
            </span>
          </div>
          <div className="flex items-center gap-2.5 pt-2">
            <a
              href={tgUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-white/10 text-white hover:bg-[#0088cc] hover:text-white border border-white/10 transition-all shadow-sm"
              title="ارتباط در تلگرام"
            >
              <Send className="w-4 h-4 text-[#c5a059] group-hover:text-white" />
            </a>
            <a
              href={instaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-white/10 text-white hover:bg-rose-600 hover:text-white border border-white/10 transition-all shadow-sm"
              title="اینستاگرام"
            >
              <Instagram className="w-4 h-4 text-[#c5a059]" />
            </a>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-white/10 text-white hover:bg-emerald-600 hover:text-white border border-white/10 transition-all shadow-sm"
              title="ارتباط در واتساپ"
            >
              <MessageCircle className="w-4 h-4 text-[#c5a059]" />
            </a>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-3 rounded-xl bg-white/10 text-white hover:bg-[#c5a059] hover:text-black border border-white/10 transition-all shadow-sm"
              title="نشانی سالن روی گوگل مپ"
            >
              <MapPin className="w-4 h-4 text-[#c5a059]" />
            </a>
          </div>
        </div>

        {/* Navigation Col */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#c5a059] border-r-2 border-[#c5a059] pr-2">
            دسترسی سریع
          </h4>
          <ul className="space-y-2 text-xs text-gray-300">
            <li>
              <a href="#hero" className="hover:text-[#c5a059] transition-colors">
                صفحه اصلی
              </a>
            </li>
            <li>
              <a href="#booking" className="hover:text-[#c5a059] transition-colors">
                رزرو نوبت آنلاین
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:text-[#c5a059] transition-colors">
                ارتباط با ما و مسیریابی
              </a>
            </li>
          </ul>
        </div>

        {/* Working Hours Col */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#c5a059] border-r-2 border-[#c5a059] pr-2">
            ساعات کاری و روزهای پذیرش
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-gray-300">
              <Clock className="w-4 h-4 text-[#c5a059]" />
              <span>یکشنبه تا جمعه: از ۱۱:۰۰ صبح الی ۱۹:۰۰ عصر</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-gray-300">
              ⚠️ سالن در روزهای <strong className="text-[#c5a059]">شنبه</strong> تعطیل می‌باشد و نوبت‌دهی غیرفعال است.
            </div>
          </div>
        </div>

        {/* Contact & Address Col */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#c5a059] border-r-2 border-[#c5a059] pr-2">
            راه ارتباطی و نشانی سالن
          </h4>
          <div className="space-y-2.5 text-xs">
            
            {/* Social Buttons with icons only (No raw ID/numbers as requested) */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={tgUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-[#0088cc] text-white border border-white/10 transition-all"
              >
                <Send className="w-4 h-4 text-[#c5a059]" />
                <span className="font-medium text-xs">تلگرام</span>
              </a>

              <a
                href={instaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-rose-600 text-white border border-white/10 transition-all"
              >
                <Instagram className="w-4 h-4 text-[#c5a059]" />
                <span className="font-medium text-xs">اینستاگرام</span>
              </a>

              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-emerald-600 text-white border border-white/10 transition-all"
              >
                <MessageCircle className="w-4 h-4 text-[#c5a059]" />
                <span className="font-medium text-xs">واتساپ</span>
              </a>

              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-[#c5a059] hover:text-black text-white border border-white/10 transition-all"
              >
                <MapPin className="w-4 h-4 text-[#c5a059]" />
                <span className="font-medium text-xs">مسیریابی</span>
              </a>
            </div>

            {/* Google Maps Salon Address Location Box */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-white/10 to-white/5 border border-white/15 hover:border-[#c5a059] text-white transition-all group"
            >
              <div className="p-2 rounded-lg bg-[#c5a059]/20 text-[#c5a059] group-hover:bg-[#c5a059] group-hover:text-black transition-colors">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#c5a059]">نشانی سالن پیرایش لورن کات</span>
                <span className="text-[11px] text-gray-300">مسیریابی هوشمند در گوگل مپ</span>
              </div>
            </a>

            <div className="pt-2">
              <button
                onClick={onOpenAdmin}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>ورود به پنل مدیریت سایت</span>
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* Bottom Copyright */}
      <div className="max-w-7xl mx-auto pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-3">
        <p>© {new Date().getFullYear()} Loren Cut | تمامی حقوق محفوظ است - محمدمهدی سبزوار</p>
        <p className="flex items-center gap-1">
          <span>طراحی شده برای سالن Loren Cut</span>
          <Scissors className="w-3.5 h-3.5 text-[#c5a059]" />
        </p>
      </div>
    </footer>
  );
};
