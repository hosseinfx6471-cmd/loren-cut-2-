import React, { useState, useEffect, useRef } from 'react';
import { Appointment, ServiceItem } from '../types';
import {
  getAvailableBookingDates,
  getAvailableTimeSlots,
  generateTrackingCode,
  AvailableDate
} from '../utils/dateUtils';
import { BankCardBadge } from './BankCardBadge';
import {
  Calendar,
  Clock,
  User,
  Phone,
  Upload,
  Send,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Scissors,
  Sparkles,
  Info,
  AlertTriangle,
  Copy,
  Check,
  Eye,
  X
} from 'lucide-react';

import { compressImage } from '../utils/imageUtils';

interface BookingSectionProps {
  services: ServiceItem[];
  appointments?: Appointment[];
  preSelectedService?: ServiceItem | null;
  onBookingComplete: (newAppointment: Appointment) => Promise<{ success: boolean; error?: string } | void> | void;
  cardNumber: string;
  cardHolder: string;
  bankName: string;
  telegramUsername: string;
  telegramUrl: string;
  customTimeSlots?: string[];
  disabledTimeSlots?: string[];
  depositAmount?: string;
}

export const BookingSection: React.FC<BookingSectionProps> = ({
  services,
  appointments = [],
  preSelectedService,
  onBookingComplete,
  cardNumber,
  cardHolder,
  bankName,
  telegramUsername,
  telegramUrl,
  customTimeSlots,
  disabledTimeSlots = [],
  depositAmount
}) => {
  // Available Dates (excluding Saturdays)
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const timeSlots = (customTimeSlots && customTimeSlots.length > 0)
    ? customTimeSlots
    : getAvailableTimeSlots();

  // Form State
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    preSelectedService?.id || services[0]?.id || ''
  );
  const [selectedDate, setSelectedDate] = useState<AvailableDate | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');
  
  // Receipt Image Upload
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string>('');

  // UI State
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedBooking, setCompletedBooking] = useState<Appointment | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [viewReceiptModal, setViewReceiptModal] = useState<string | null>(null);
  const successContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to confirmation receipt when booking completes (crucial for mobile experience)
  useEffect(() => {
    if (completedBooking && successContainerRef.current) {
      setTimeout(() => {
        successContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [completedBooking]);

  // Copy tracking code helper
  const handleCopyTrackingCode = (code: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  // Initialize Available Dates
  useEffect(() => {
    const dates = getAvailableBookingDates();
    setAvailableDates(dates);
    if (dates.length > 0) {
      setSelectedDate(dates[0]);
    }
  }, []);

  // Update selected service if parent passes preSelectedService
  useEffect(() => {
    if (preSelectedService) {
      setSelectedServiceId(preSelectedService.id);
    }
  }, [preSelectedService]);

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFileName(file.name);
      try {
        const compressed = await compressImage(file, 1000, 0.82);
        setReceiptImage(compressed);
        setErrorMsg('');
      } catch (err) {
        console.error('Failed to compress receipt image:', err);
        setErrorMsg('خطا در بارگذاری تصویر رسید. لطفاً مجدداً تلاش کنید.');
      }
    }
  };

  // Check if a time slot is already booked on the selected date
  const isSlotBooked = (slot: string) => {
    if (!selectedDate || !appointments || appointments.length === 0) return false;
    return appointments.some((app) => {
      if (app.status === 'canceled' || app.archived === true || app.status === 'archived') return false;
      const isSameDate =
        (app.dateStr && app.dateStr === selectedDate.dateStr) ||
        (app.dayName && (app.dayName.includes(selectedDate.dateStr) || app.dayName.includes(selectedDate.dayName) || app.dayName === selectedDate.fullLabel));
      const isSameSlot = app.timeSlot === slot || app.timeSlot.includes(slot) || slot.includes(app.timeSlot);
      return isSameDate && isSameSlot;
    });
  };

  // Check if a time slot is less than 15 minutes away or already passed on today's date
  const isSlotExpired = (slot: string) => {
    if (!selectedDate) return false;

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const isToday = selectedDate.isToday || selectedDate.dateStr === todayStr;
    if (!isToday) return false;

    if (!slot) return false;
    const engSlot = String(slot).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    const parts = engSlot.split(':');
    if (parts.length !== 2) return false;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return false;

    const slotTotalMinutes = hours * 60 + minutes;
    const currentTotalMinutes = today.getHours() * 60 + today.getMinutes();

    return currentTotalMinutes >= (slotTotalMinutes - 15);
  };

  // Check if slot is disabled by admin
  const isSlotDisabledByAdmin = (slot: string) => {
    if (!disabledTimeSlots || disabledTimeSlots.length === 0) return false;
    if (disabledTimeSlots.includes(slot)) return true;
    if (selectedDate && disabledTimeSlots.includes(`${selectedDate.dateStr}_${slot}`)) return true;
    return false;
  };

  const selectedService = services.find((s) => s.id === selectedServiceId) || services[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validations
    if (!clientName.trim()) {
      setErrorMsg('لطفاً نام و نام خانوادگی خود را وارد کنید.');
      return;
    }

    if (!phone.trim() || phone.trim().length < 10) {
      setErrorMsg('لطفاً شماره تلفن معتبر (مثلاً ۰۹۱۲۳۴۵۶۷۸۹) وارد کنید.');
      return;
    }

    if (!selectedDate) {
      setErrorMsg('لطفاً روز نوبت را انتخاب کنید.');
      return;
    }

    if (!selectedTimeSlot) {
      setErrorMsg('لطفاً ساعت نوبت را انتخاب کنید.');
      return;
    }

    if (isSlotBooked(selectedTimeSlot)) {
      setErrorMsg('این سانس زمانی قبلاً توسط فرد دیگری رزرو شده است. لطفاً سانس دیگری انتخاب کنید.');
      return;
    }

    if (isSlotExpired(selectedTimeSlot)) {
      setErrorMsg('زمان این سانس گذشته یا کمتر از ۱۵ دقیقه به شروع آن باقی مانده است. لطفاً سانس دیگری انتخاب کنید.');
      return;
    }

    if (isSlotDisabledByAdmin(selectedTimeSlot)) {
      setErrorMsg('این سانس زمانی قبلاً رزرو شده است. لطفاً سانس دیگری انتخاب کنید.');
      return;
    }

    if (!receiptImage) {
      setErrorMsg('لطفاً تصویر رسید پرداخت کارت به کارت را آپلود کنید.');
      return;
    }

    setIsSubmitting(true);

    const trackingCode = generateTrackingCode();
    const nowStr = new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    const newAppointment: Appointment = {
      id: 'app-' + Date.now(),
      clientName: clientName.trim(),
      phone: phone.trim(),
      dateStr: selectedDate.dateStr,
      dayName: selectedDate.fullLabel,
      timeSlot: selectedTimeSlot,
      serviceId: selectedService.id,
      serviceName: selectedService.title,
      servicePrice: selectedService.price,
      receiptImage: receiptImage,
      status: 'pending',
      createdAt: nowStr,
      trackingCode
    };

    try {
      const res = await onBookingComplete(newAppointment);
      if (res && res.success === false) {
        setErrorMsg(res.error || 'این سانس زمانی قبلاً توسط فرد دیگری رزرو شده است. لطفاً سانس دیگری انتخاب کنید.');
        setIsSubmitting(false);
        return;
      }
      setCompletedBooking(newAppointment);
      setIsSubmitting(false);
      // Clear temporary customer input form state upon successful booking
      setClientName('');
      setPhone('');
      setSelectedTimeSlot('');
      setReceiptImage(null);
      setReceiptFileName('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'خطا در ثبت نوبت. لطفاً مجدداً تلاش کنید.');
      setIsSubmitting(false);
    }
  };

  // Helper to build Telegram Message Text
  const buildTelegramLink = (booking: Appointment) => {
    const rawUsername = telegramUsername ? String(telegramUsername) : '@Mohamadsabzevar';
    const cleanUsername = rawUsername.replace('@', '').trim() || 'Mohamadsabzevar';
    const text = `سلام آقای محمدمهدی سبزوار 👋\nیک نوبت جدید در وب‌سایت Loren Cut ثبت شد:\n\n👤 نام متقاضی: ${booking.clientName || 'مشتری'}\n📞 شماره تماس: ${booking.phone || 'ثبت نشده'}\n✂️ خدمت انتخابی: ${booking.serviceName || 'اصلاح سر'}\n💰 مبلغ: ${booking.servicePrice || '۱,۵۰۰,۰۰۰ تومان'}\n📅 تاریخ نوبت: ${booking.dayName || ''}\n⏰ ساعت نوبت: ${booking.timeSlot || ''}\n🔑 کد پیگیری: ${booking.trackingCode || ''}\n\n📎 تصویر رسید پرداخت نیز جهت تایید نوبت پیوست شد.`;
    return `https://t.me/${cleanUsername}?text=${encodeURIComponent(text)}`;
  };

  return (
    <section id="booking" className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Section Header */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass text-[#c5a059] text-xs font-semibold shadow-sm">
          <Calendar className="w-3.5 h-3.5" />
          <span>سیستم نوبت‌دهی آنلاین Loren Cut</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-serif text-black">
          رزرو نوبت و پرداخت آنلاین
        </h2>
        <p className="text-gray-600 text-sm max-w-lg mx-auto">
          مشخصات خود را وارد کنید، روز و ساعت نوبت را انتخاب کرده و به‌صورت آنلاین از طریق درگاه شتاب یا کارت‌به‌کارت پرداخت را انجام دهید.
        </p>
      </div>

      {/* Main Booking Container */}
      <div className="rounded-3xl glass border border-black/10 p-5 sm:p-10 shadow-sm relative overflow-hidden">
        
        {/* Success Modal View when Booking is Complete (Card to Card) */}
        {completedBooking ? (
          <div ref={successContainerRef} className="text-center space-y-6 py-4 sm:py-6 animate-fadeIn">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-black">
                نوبت شما با موفقیت ثبت گردید!
              </h3>
              <p className="text-gray-700 text-xs sm:text-sm max-w-md mx-auto">
                کد پیگیری اختصاصی نوبت شما:
              </p>
              <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-black/20 shadow-sm">
                <span className="font-mono text-base sm:text-lg font-black text-black dir-ltr">
                  {completedBooking.trackingCode}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyTrackingCode(completedBooking.trackingCode)}
                  className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer transition-all"
                  title="کپی کد پیگیری"
                >
                  {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Summary Box */}
            <div className="max-w-md mx-auto text-right bg-white/95 p-5 rounded-2xl border border-black/10 space-y-3 text-xs sm:text-sm shadow-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">نام متقاضی:</span>
                <span className="font-bold text-black">{completedBooking.clientName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">شماره تلفن:</span>
                <span className="font-bold text-black dir-ltr">{completedBooking.phone}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">خدمت انتخابی:</span>
                <span className="font-bold text-[#c5a059]">{completedBooking.serviceName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">تاریخ نوبت:</span>
                <span className="font-bold text-black">{completedBooking.dayName}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <span className="text-gray-500">ساعت نوبت:</span>
                <span className="font-bold text-emerald-700">{completedBooking.timeSlot}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-b border-gray-100 pb-2">
                <span className="text-gray-500">وضعیت پرداخت:</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1 text-xs">
                  <FileCheck className="w-3.5 h-3.5" />
                  رسید کارت‌به‌کارت ثبت شد
                </span>
              </div>

              {/* Uploaded Receipt Preview on Mobile & Desktop */}
              {completedBooking.receiptImage && (
                <div className="pt-2">
                  <span className="text-[11px] text-gray-500 block mb-1.5">تصویر فیش واریزی ارسال شده:</span>
                  <div className="flex items-center gap-3 bg-gray-50 p-2.5 rounded-xl border border-gray-200">
                    <img
                      src={completedBooking.receiptImage}
                      alt="فیش پرداخت"
                      className="w-14 h-14 object-cover rounded-lg border border-gray-300 cursor-pointer shadow-sm"
                      onClick={() => setViewReceiptModal(completedBooking.receiptImage || null)}
                    />
                    <div className="flex-1 text-right">
                      <p className="text-xs font-bold text-gray-800">تصویر فیش دریافت شد</p>
                      <button
                        type="button"
                        onClick={() => setViewReceiptModal(completedBooking.receiptImage || null)}
                        className="text-[11px] text-sky-700 hover:text-sky-900 font-semibold inline-flex items-center gap-1 mt-0.5 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>مشاهده تصویر بزرگ‌تر</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <a
                href={buildTelegramLink(completedBooking)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto min-h-[48px] px-6 py-3.5 rounded-xl bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>ارسال فیش به تلگرام</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setCompletedBooking(null);
                  setClientName('');
                  setPhone('');
                  setSelectedTimeSlot('');
                  setReceiptImage(null);
                  setReceiptFileName('');
                }}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3.5 rounded-xl bg-white hover:bg-gray-100 text-black font-semibold text-sm border border-black/20 shadow-sm cursor-pointer"
              >
                ثبت نوبت جدید
              </button>
            </div>
          </div>
        ) : (
          /* Form Content */
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Step 1: Personal Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-black/10">
                <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs">
                  ۱
                </div>
                <h3 className="text-base font-bold text-black">اطلاعات شخص متقاضی</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#c5a059]" />
                    <span>نام و نام خانوادگی *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="مثال: محمدمهدی سبزوار"
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[#d1ccc0] text-black placeholder-gray-400 text-sm focus:outline-none focus:border-black transition-colors"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-[#c5a059]" />
                    <span>شماره تلفن همراه *</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: 09123456789"
                    className="w-full px-4 py-3 rounded-xl bg-white border border-[#d1ccc0] text-black placeholder-gray-400 text-sm dir-ltr text-right focus:outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Date & Time Selection */}
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-2 border-b border-black/10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs">
                    ۲
                  </div>
                  <h3 className="text-base font-bold text-black">انتخاب روز و ساعت نوبت</h3>
                </div>
                <span className="text-[11px] text-[#c5a059] bg-white px-2.5 py-1 rounded-full border border-black/10 font-medium">
                  روزهای شنبه تعطیل است
                </span>
              </div>

              {/* Saturday Exclusion Notice */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0 text-[#c5a059]" />
                <span>
                  روزهای فعالیت: <strong>یکشنبه تا جمعه</strong> (نوبت‌دهی تا ۳ روز کاری آینده). روزهای <strong>شنبه</strong> سالن تعطیل می‌باشد.
                </span>
              </div>

              {/* Date Options */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-700">انتخاب روز نوبت *</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {availableDates.map((dateObj) => {
                    const isSelected = selectedDate?.dateStr === dateObj.dateStr;
                    return (
                      <button
                        key={dateObj.dateStr}
                        type="button"
                        onClick={() => setSelectedDate(dateObj)}
                        className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-[#132c25] text-white border-[#132c25] shadow-md'
                            : 'bg-white border-black/10 hover:border-black/30 text-gray-800'
                        }`}
                      >
                        <Calendar className={`w-4 h-4 ${isSelected ? 'text-[#c5a059]' : 'text-gray-500'}`} />
                        <span className="font-bold text-sm">{dateObj.fullLabel}</span>
                        {dateObj.isToday && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-green-100 text-green-800'
                          }`}>
                            در دسترس (امروز)
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time Slot Selection Grid */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                  <h4 className="text-sm font-extrabold text-black">ساعت‌های آزاد</h4>
                  <span className="text-xs text-gray-500 font-medium">
                    {selectedDate?.dayName || ''} — خدمت و قیمت روی هر ساعت
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {timeSlots.map((slot) => {
                    const isSelected = selectedTimeSlot === slot;
                    const isBooked = isSlotBooked(slot);
                    const isExpired = isSlotExpired(slot);
                    const isDisabledByAdmin = isSlotDisabledByAdmin(slot);

                    if (isBooked) {
                      return (
                        <div
                          key={slot}
                          className="p-4 rounded-2xl border border-gray-300 bg-gray-200/70 text-center flex flex-col items-center justify-center gap-1.5 select-none opacity-60 shadow-none cursor-not-allowed"
                        >
                          <div className="text-base font-black font-mono tracking-wider text-gray-500 line-through">
                            {slot}
                          </div>
                          <div className="text-xs font-bold text-red-700 bg-red-100/90 px-2.5 py-0.5 rounded-full">
                            رزرو شده
                          </div>
                          <div className="text-[11px] font-semibold text-gray-500">
                            {selectedService?.price || services[0]?.price || '۱,۵۰۰,۰۰۰ تومان'}
                          </div>
                        </div>
                      );
                    }

                    if (isExpired) {
                      return (
                        <div
                          key={slot}
                          className="p-4 rounded-2xl border border-gray-200 bg-gray-200/50 text-center flex flex-col items-center justify-center gap-1.5 select-none opacity-50 shadow-none cursor-not-allowed"
                        >
                          <div className="text-base font-black font-mono tracking-wider text-gray-400 line-through">
                            {slot}
                          </div>
                          <div className="text-[11px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full">
                            غیرقابل رزرو (زمان گذشته)
                          </div>
                          <div className="text-[11px] font-semibold text-gray-400">
                            {selectedService?.price || services[0]?.price || '۱,۵۰۰,۰۰۰ تومان'}
                          </div>
                        </div>
                      );
                    }

                    if (isDisabledByAdmin) {
                      return (
                        <div
                          key={slot}
                          className="p-4 rounded-2xl border border-gray-300 bg-gray-200/70 text-center flex flex-col items-center justify-center gap-1.5 select-none opacity-60 shadow-none cursor-not-allowed"
                        >
                          <div className="text-base font-black font-mono tracking-wider text-gray-500 line-through">
                            {slot}
                          </div>
                          <div className="text-xs font-bold text-red-700 bg-red-100/90 px-2.5 py-0.5 rounded-full">
                            رزرو شده
                          </div>
                          <div className="text-[11px] font-semibold text-gray-500">
                            {selectedService?.price || services[0]?.price || '۱,۵۰۰,۰۰۰ تومان'}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTimeSlot(slot)}
                        className={`p-4 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                          isSelected
                            ? 'bg-[#123e32] text-white border-[#123e32] shadow-lg ring-2 ring-[#c5a059]'
                            : 'bg-[#f4f2ee] hover:bg-[#eae6df] border-gray-300 text-gray-900'
                        }`}
                      >
                        {/* Time */}
                        <div className={`text-base font-black font-mono tracking-wider ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {slot}
                        </div>
                        {/* Service Title */}
                        <div className={`text-xs font-bold ${isSelected ? 'text-gray-100' : 'text-gray-800'}`}>
                          {selectedService?.title || services[0]?.title || 'اصلاح سر'}
                        </div>
                        {/* Price */}
                        <div className={`text-[11px] font-semibold ${isSelected ? 'text-emerald-300' : 'text-gray-600'}`}>
                          {selectedService?.price || services[0]?.price || '۱,۵۰۰,۰۰۰ تومان'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Step 3: Receipt Upload & Execution */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-black/10">
                <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center font-bold text-xs">
                  ۳
                </div>
                <h3 className="text-base font-bold text-black">پرداخت و ثبت نهایی رزرو</h3>
              </div>

              {/* Card to Card Display & Upload */}
              <div className="space-y-4 pt-2">
                <BankCardBadge
                  cardNumber={cardNumber || '6219861929212669'}
                  cardHolder={cardHolder || 'محمدمهدی سبزوار'}
                  depositAmount={depositAmount || '۷۰۰,۰۰۰ تومان'}
                />

                <div className="space-y-2 pt-1">
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-[#c5a059]" />
                    <span>آپلود تصویر رسید پرداخت *</span>
                  </label>

                  <div className="relative border-2 border-dashed border-black/20 hover:border-[#c5a059] rounded-2xl p-6 bg-white/70 text-center transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />

                    {receiptImage ? (
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-black/20 shadow-md">
                          <img
                            src={receiptImage}
                            alt="رسید پرداخت"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تصویر رسید با موفقیت بارگذاری شد</span>
                        </div>
                        <span className="text-[11px] text-gray-600 underline">
                          جهت تغییر تصویر کلیک کنید
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center space-y-2 py-2">
                        <div className="p-3 rounded-full bg-black text-[#f5f2eb]">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-semibold text-black">
                          برای آپلود تصویر رسید پرداخت کارت‌به‌کارت اینجا کلیک کنید
                        </p>
                        <p className="text-xs text-gray-500">
                          فرمت‌های مجاز: JPG, PNG, WEBP
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Error Display */}
            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 text-xs sm:text-sm flex items-center gap-2 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 rounded-2xl bg-[#c5a059] hover:bg-[#b59049] text-black font-bold text-base shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <span>در حال ثبت نوبت...</span>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  <span>ثبت نوبت و ارسال رسید به تلگرام</span>
                </>
              )}
            </button>

          </form>
        )}

      </div>
      {/* Receipt Image Modal */}
      {viewReceiptModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setViewReceiptModal(null)}
        >
          <div
            className="bg-white rounded-3xl p-4 max-w-lg w-full relative shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h4 className="text-sm font-bold text-black flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                تصویر فیش پرداخت واریزی
              </h4>
              <button
                type="button"
                onClick={() => setViewReceiptModal(null)}
                className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center p-2">
              <img
                src={viewReceiptModal}
                alt="تصویر فیش"
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
            <button
              type="button"
              onClick={() => setViewReceiptModal(null)}
              className="w-full py-2.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-black cursor-pointer transition-all"
            >
              بستن پنجره
            </button>
          </div>
        </div>
      )}

    </section>
  );
};

