import React from 'react';
import { Calendar, ShieldCheck, Clock, Scissors, CreditCard, Sparkles, Send, Crown } from 'lucide-react';
import { InstallPwaModal } from './InstallPwaModal';
import heroImg from '../assets/images/loren_cut_hero_1784730868504.jpg';

interface HeroSectionProps {
  onOpenBooking: () => void;
  telegramUsername: string;
  telegramUrl: string;
  whatsappUrl?: string;
  customTimeSlots?: string[];
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenBooking,
  telegramUsername,
  telegramUrl,
  whatsappUrl = 'https://wa.me/989167209686',
  customTimeSlots = []
}) => {
  const workingHoursDisplay =
    customTimeSlots && customTimeSlots.length > 0
      ? `${customTimeSlots[0]} الی ${customTimeSlots[customTimeSlots.length - 1]}`
      : '۱۱:۰۰ الی ۱۹:۰۰';
  return (
    <section id="hero" className="relative min-h-[80vh] flex items-center justify-center overflow-hidden py-16 px-4 sm:px-6 lg:px-8">
      {/* Background Hero Image with Soft Cream Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src={heroImg}
          alt="Loren Cut Barber Salon"
          className="w-full h-full object-cover object-center opacity-20 filter brightness-95 scale-105 transform transition-transform duration-1000"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f5f2eb] via-[#f5f2eb]/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f5f2eb] via-transparent to-[#f5f2eb]" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
        {/* Top Luxury Pill Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-black text-xs sm:text-sm font-semibold shadow-sm">
          <Sparkles className="w-4 h-4 text-[#c5a059] animate-pulse" />
          <span>سالن اختصاصی کوتاهی استایل و داماد لورن کات | محمدمهدی سبزوار</span>
        </div>

        {/* Main Headings */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight">
            <span className="font-cinzel text-black tracking-widest block mb-2">
              LOREN CUT
            </span>
            <span className="gold-gradient-text font-bold text-3xl sm:text-5xl md:text-6xl">
              هنر کوتاهی و استایل به سبک حرفه‌ای‌ها
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-gray-700 text-base sm:text-lg leading-relaxed font-normal">
            تجربه نوبت‌دهی آنلاین سریع، انتخاب روز و ساعت دلخواه، و دریافت خدمات اختصاصی کوتاهی، گریم و فید در محیطی مدرن.
          </p>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto pt-2">
          <div className="p-4 rounded-2xl glass flex flex-col items-center gap-1.5 text-center shadow-sm">
            <Clock className="w-5 h-5 text-[#c5a059]" />
            <span className="text-xs text-gray-500 font-medium">ساعت نوبت‌دهی</span>
            <span className="text-sm font-bold text-black">{workingHoursDisplay}</span>
          </div>

          <div className="p-4 rounded-2xl glass flex flex-col items-center gap-1.5 text-center shadow-sm">
            <Calendar className="w-5 h-5 text-[#c5a059]" />
            <span className="text-xs text-gray-500 font-medium">روزهای فعالیت</span>
            <span className="text-sm font-bold text-black">یکشنبه تا جمعه (شنبه تعطیل)</span>
          </div>

          <div className="p-4 rounded-2xl glass flex flex-col items-center gap-1.5 text-center shadow-sm">
            <CreditCard className="w-5 h-5 text-[#c5a059]" />
            <span className="text-xs text-gray-500 font-medium">پرداخت آسان</span>
            <span className="text-sm font-bold text-black">کارت به کارت + ثبت رسید</span>
          </div>

          <div className="p-4 rounded-2xl glass flex flex-col items-center gap-1.5 text-center shadow-sm">
            <Send className="w-5 h-5 text-[#c5a059]" />
            <span className="text-xs text-gray-500 font-medium">ارسال نوبت</span>
            <span className="text-sm font-bold text-black">ارسال مستقیم به تلگرام</span>
          </div>
        </div>

        {/* Call To Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 pt-4">
          <button
            onClick={onOpenBooking}
            className="w-full sm:w-auto px-7 py-3.5 sm:py-4 rounded-2xl btn-dark text-[#f5f2eb] font-bold text-sm sm:text-base shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <Calendar className="w-5 h-5 text-[#c5a059]" />
            <span>رزرو آنلاین نوبت همین حالا</span>
          </button>

          {/* VIP Services Smooth Scroll Button */}
          <button
            onClick={() => {
              const el = document.getElementById('special-services');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="w-full sm:w-auto px-7 py-3.5 sm:py-4 rounded-2xl bg-white hover:bg-amber-50/60 border-2 border-[#c5a059] text-gray-950 font-extrabold text-sm sm:text-base shadow-md hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer group"
          >
            <Crown className="w-5 h-5 text-[#c5a059] group-hover:scale-110 transition-transform" />
            <span>خدمات VIP</span>
          </button>

          <InstallPwaModal variant="hero" />
        </div>

      </div>
    </section>
  );
};
