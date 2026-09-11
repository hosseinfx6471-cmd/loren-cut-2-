import React from 'react';
import {
  Scissors,
  Home,
  Crown,
  Sparkles,
  Flame,
  MessageSquare,
  ShieldCheck,
  ArrowLeft,
  Star,
  CheckCircle2,
  Gem
} from 'lucide-react';

interface SpecialServicesGridProps {
  whatsappUrl?: string;
}

export const SpecialServicesGrid: React.FC<SpecialServicesGridProps> = ({
  whatsappUrl = 'https://wa.me/989167209686'
}) => {
  const getWaLink = (serviceName: string) => {
    const cleanUrl = whatsappUrl || 'https://wa.me/989167209686';
    const msg = encodeURIComponent(`سلام آقای سبزوار 👋\nجهت مشاوره و رزرو خدمت "${serviceName}" در سالن Loren Cut پیام می‌دهم.`);
    return cleanUrl.includes('?') ? `${cleanUrl}&text=${msg}` : `${cleanUrl}?text=${msg}`;
  };

  return (
    <section id="special-services" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
      {/* Section Header */}
      <div className="flex flex-col items-center text-center space-y-3 mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black text-[#c5a059] text-xs font-bold shadow-md border border-[#c5a059]/30">
          <Crown className="w-3.5 h-3.5 text-[#c5a059]" />
          <span>خدمات ویژه و پکیج‌های VIP لورن کات</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-serif text-black tracking-tight">
          پکیج‌های اختصاصی و خدمات VIP
        </h2>
        <p className="text-gray-600 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
          خدمات اختصاصی کوتاهی، استایل مراسم، مراقبت و اصلاح در محل با تعیین وقت قبلی و هماهنگی مستقیم در واتساپ.
        </p>
      </div>

      {/* 3-Card Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

        {/* Card 1: Dual Package (اصلاح VIP سر و صورت + اصلاح در منزل) */}
        <div className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-black/10 shadow-sm hover:shadow-xl hover:border-[#c5a059]/60 transition-all duration-300 flex flex-col justify-between space-y-4 group relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-[#c5a059]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Card Top Title */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#c5a059]/15 text-[#c5a059] flex items-center justify-center font-bold">
                <Scissors className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-950">پکیج اصلاح و استایل VIP</h3>
                <span className="text-[10px] text-gray-500 font-medium">خدمات تخصصی پیرایش و استایل</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#c5a059] bg-[#c5a059]/10 px-2.5 py-0.5 rounded-full">
              ۲ سرویس اختصاصی
            </span>
          </div>

          {/* Sub-Service 1: اصلاح VIP سر و صورت */}
          <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-100/80 hover:bg-amber-50/80 transition-colors space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-[#c5a059]" />
                  <h4 className="text-sm font-extrabold text-gray-950">اصلاح VIP سر و صورت</h4>
                </div>
                <p className="text-[11px] text-gray-600 leading-snug">
                  کوتاهی تخصصی بر پایه آناتومی چهره، فید حرفه‌ای، فرم‌دهی ریش و پاکسازی سطحی پوست.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                استایل کامل
              </span>
              <a
                href={getWaLink('اصلاح VIP سر و صورت')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-950 hover:bg-black text-[#f5f2eb] hover:text-[#c5a059] text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>رزرو در واتساپ</span>
              </a>
            </div>
          </div>

          {/* Sub-Service 2: اصلاح در منزل */}
          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 hover:bg-amber-50/40 transition-colors space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-blue-600" />
                  <h4 className="text-sm font-extrabold text-gray-950">اصلاح در منزل (محل مشتری)</h4>
                </div>
                <p className="text-[11px] text-gray-600 leading-snug">
                  ارائه خدمات کوتاهی و پیرایش در لوکیشن انتخابی شما با کلیه تجهیزات استریل و کامل.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                اعزام با هماهنگی قبلی
              </span>
              <a
                href={getWaLink('اصلاح در منزل')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-950 hover:bg-black text-[#f5f2eb] hover:text-[#c5a059] text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>رزرو در واتساپ</span>
              </a>
            </div>
          </div>
        </div>

        {/* Card 2 (Rank #2): گریم داماد و استایل ویژه (Ultra-Luxury Standout Design) */}
        <div className="relative rounded-3xl p-6 sm:p-7 bg-gradient-to-b from-[#1c1c1c] via-[#141414] to-[#0d0d0d] text-white border-2 border-[#c5a059] shadow-2xl hover:shadow-[0_0_35px_rgba(197,160,89,0.35)] transition-all duration-300 flex flex-col justify-between space-y-5 group overflow-hidden transform lg:-translate-y-1">
          {/* Subtle gold luxury background glow */}
          <div className="absolute top-0 right-1/4 w-36 h-36 bg-[#c5a059]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-36 h-36 bg-[#c5a059]/10 rounded-full blur-2xl pointer-events-none" />

          <div className="space-y-4 relative z-10">
            {/* Title & Icon */}
            <div className="flex items-start justify-between gap-3 pt-1">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white group-hover:text-[#c5a059] transition-colors leading-tight">
                  گریم داماد و استایل ویژه
                </h3>
                <p className="text-xs text-amber-200/80 font-medium mt-1">
                  پکیج ویژه روز مراسم ،عقد و عکاسی
                </p>
              </div>
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#c5a059] to-[#8d6f31] text-black flex items-center justify-center shadow-lg shrink-0 group-hover:rotate-6 group-hover:scale-105 transition-all">
                <Gem className="w-6 h-6 text-black" />
              </div>
            </div>

            {/* Detailed Description */}
            <p className="text-xs text-gray-300 leading-relaxed">
              آماده سازی تخصصی روز مراسم شامل گریم کانتورینگ فیشیال شاداب کننده پاکسازی پوست اصلاح و فرم دهی مو و ریش میباشد.
            </p>

            {/* Feature Pills */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-200 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
                <span>متریال و گریم ضدتعریق</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-200 bg-white/5 px-2.5 py-1.5 rounded-xl border border-white/10">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#c5a059] shrink-0" />
                <span>تایم اختصاصی و VIP</span>
              </div>
            </div>
          </div>

          {/* Standout CTA Button */}
          <div className="pt-3 border-t border-white/10 relative z-10">
            <a
              href={getWaLink('گریم داماد و استایل ویژه')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-[#c5a059] via-[#dfba6d] to-[#c5a059] hover:from-[#dfba6d] hover:to-[#b08c47] text-black font-black text-xs sm:text-sm transition-all duration-300 shadow-lg hover:shadow-2xl active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-black" />
              <span>هماهنگی و مشاوره پکیج داماد در واتساپ</span>
              <ArrowLeft className="w-4 h-4 text-black" />
            </a>
          </div>
        </div>

        {/* Card 3: Dual Package (کراتینه و صافی مو + پاکسازی پوست و اسکراب) */}
        <div className="bg-white/95 rounded-3xl p-5 sm:p-6 border border-black/10 shadow-sm hover:shadow-xl hover:border-[#c5a059]/60 transition-all duration-300 flex flex-col justify-between space-y-4 group relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-transparent via-[#c5a059]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Card Top Title */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#c5a059]/15 text-[#c5a059] flex items-center justify-center font-bold">
                <Sparkles className="w-5 h-5 text-gray-900" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-950">پکیج احیا و مراقبت تخصصی</h3>
                <span className="text-[10px] text-gray-500 font-medium">سلامت پوست و لطافت مو</span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#c5a059] bg-[#c5a059]/10 px-2.5 py-0.5 rounded-full">
              ۲ سرویس تخصصی
            </span>
          </div>

          {/* Sub-Service 1: کراتینه و صافی مو */}
          <div className="p-3.5 rounded-2xl bg-amber-50/40 border border-amber-100/80 hover:bg-amber-50/80 transition-colors space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-600" />
                  <h4 className="text-sm font-extrabold text-gray-950">کراتینه و صافی مو</h4>
                </div>
                <p className="text-[11px] text-gray-600 leading-snug">
                  احیا و پروتئین‌تراپی عمقی تار مو، رفع خشکی و وزی، با صافی ابریشمی ماندگار.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                متریال احیایی و صافی
              </span>
              <a
                href={getWaLink('کراتینه و صافی مو')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-950 hover:bg-black text-[#f5f2eb] hover:text-[#c5a059] text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>رزرو در واتساپ</span>
              </a>
            </div>
          </div>

          {/* Sub-Service 2: پاکسازی پوست و اسکراب */}
          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 hover:bg-amber-50/40 transition-colors space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <h4 className="text-sm font-extrabold text-gray-950">پاکسازی پوست و اسکراب</h4>
                </div>
                <p className="text-[11px] text-gray-600 leading-snug">
                  فیشیال عمقی، تخلیه چربی و دانه‌های سرسیاه، لایه‌برداری و ماسک آبرسان جوان‌ساز.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                پاکسازی چندمرحله‌ای
              </span>
              <a
                href={getWaLink('پاکسازی پوست و اسکراب')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-950 hover:bg-black text-[#f5f2eb] hover:text-[#c5a059] text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#c5a059]" />
                <span>رزرو در واتساپ</span>
              </a>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
