import { Appointment, SiteConfig } from '../types';

/**
 * Format SMS confirmation text for a customer booking
 */
export function formatCustomerConfirmationSms(appointment: Appointment, customTemplate?: string): string {
  if (customTemplate && customTemplate.trim().length > 0) {
    return customTemplate
      .replace(/\{نام\}/g, appointment.clientName || 'مشتری گرامی')
      .replace(/\{تاریخ\}/g, appointment.dayName || '')
      .replace(/\{ساعت\}/g, appointment.timeSlot || '')
      .replace(/\{خدمت\}/g, appointment.serviceName || 'اصلاح')
      .replace(/\{مبلغ\}/g, appointment.servicePrice || '')
      .replace(/\{کد\}/g, appointment.trackingCode || '')
      .replace(/\{تلفن\}/g, appointment.phone || '');
  }

  return `سلام ${appointment.clientName} عزیز 💈
نوبت شما در پیرایشگاه Loren Cut با موفقیت ثبت شد.
📅 تاریخ: ${appointment.dayName}
⏰ ساعت: ${appointment.timeSlot}
✂️ خدمت: ${appointment.serviceName}
🔑 کد پیگیری: ${appointment.trackingCode}
نشانی: اهواز، زیتون کارمندی
منتظر دیدارتان هستیم!`;
}

/**
 * Format SMS notification text for Admin
 */
export function formatAdminBookingAlertSms(appointment: Appointment): string {
  return `💈 نوبت جدید در Loren Cut
👤 متقاضی: ${appointment.clientName}
📞 تماس: ${appointment.phone}
✂️ خدمت: ${appointment.serviceName}
📅 موعد: ${appointment.dayName} - ساعت ${appointment.timeSlot}
🔑 کد: ${appointment.trackingCode}`;
}

/**
 * Generates direct SMS link (e.g. sms:0916...&body=...) for mobile phones
 */
export function generateDirectSmsLink(phoneNumber: string, messageText: string): string {
  const cleanPhone = (phoneNumber || '').replace(/[^0-9+]/g, '');
  const encodedText = encodeURIComponent(messageText || '');
  // iOS and Android compatibility for sms: protocol
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    return `sms:${cleanPhone}&body=${encodedText}`;
  }
  return `sms:${cleanPhone}?body=${encodedText}`;
}

/**
 * Dispatches SMS through server API or webhook if configured
 */
export async function sendSmsNotification(
  phone: string,
  message: string,
  config?: SiteConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch('/api/send_sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        message,
        apiKey: config?.smsApiKey || '',
        sender: config?.smsSenderNumber || ''
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      return { success: data.success ?? true, message: data.message || 'پیامک با موفقیت ارسال شد.' };
    }
    return { success: false, message: 'سامانه پیامکی پاسخ نداد. می‌توانید از دکمه ارسال پیامک مستقیم گوشی استفاده کنید.' };
  } catch (e: any) {
    return { success: false, message: e?.message || 'خطا در ارتباط با وب‌سرویس پیامک.' };
  }
}
