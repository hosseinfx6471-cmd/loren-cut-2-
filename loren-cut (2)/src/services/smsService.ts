/**
 * Universal SMS Notification Service (Server-Side)
 * Supports MeliPayamak (SendSimpleSMS2 / REST), IPPanel / FarazSMS, Kavenegar, and SMS.ir
 * Configured dynamically from SiteConfig (Admin UI) and environment variables.
 */

import { SiteConfig } from '../types';

interface AppointmentForSMS {
  clientName: string;
  phone?: string;
  dateStr?: string;
  dayName?: string;
  timeSlot: string;
  serviceName?: string;
  servicePrice?: string;
  trackingCode?: string;
}

export function parseMelipayamakResponse(rawResponse: string, httpOk: boolean): { success: boolean; error?: string; code?: string } {
  const cleanVal = rawResponse.replace(/<[^>]*>?/gm, '').trim();
  
  if (/^\d+$/.test(cleanVal)) {
    const num = Number(cleanVal);
    if (num > 1000) {
      return { success: true, code: cleanVal };
    }
    const errorMap: Record<string, string> = {
      '0': 'نام کاربری یا رمز عبور سامانه پیامک اشتباه است.',
      '2': 'اعتبار پنل پیامک شما کافی نیست. لطفاً پنل پیامک را شارژ فرمایید.',
      '3': 'محدودیت تعداد ارسال روزانه وجود دارد.',
      '4': 'محدودیت حجم ارسال پیامک وجود دارد.',
      '5': 'شماره فرستنده در سامانه پیامک نامعتبر یا تایید نشده است.',
      '6': 'سامانه پیامک موقتاً در حال بروزرسانی است.',
      '7': 'متن پیامک شامل کلمات فیلتر شده است.',
      '11': 'شماره گیرنده در لیست سیاه مخابرات (عدم دریافت پیامک تبلیغاتی) است یا نامعتبر می‌باشد.',
      '12': 'مدارک پنل پیامک هنوز تایید نهایی نشده است.'
    };
    return {
      success: false,
      code: cleanVal,
      error: errorMap[cleanVal] || `کد خطای سامانه پیامک: ${cleanVal}`
    };
  }

  if (httpOk && rawResponse.length > 0) {
    return { success: true };
  }

  return { success: false, error: 'پاسخ نامعتبر از درگاه پیامک', code: cleanVal };
}

/**
 * Universal SMS Sender
 */
export async function sendUniversalSMS(
  toPhone: string,
  text: string,
  config?: Partial<SiteConfig>
): Promise<{ success: boolean; rawResponse?: string; error?: string; provider?: string }> {
  try {
    if (!toPhone || !text) {
      return { success: false, error: 'شماره گیرنده یا متن پیام خالی است.' };
    }

    const cleanPhone = toPhone.replace(/[^0-9]/g, '');
    const formattedTo = cleanPhone.startsWith('0')
      ? '98' + cleanPhone.substring(1)
      : cleanPhone.startsWith('98')
      ? cleanPhone
      : '98' + cleanPhone;
    const localPhone = cleanPhone.startsWith('98')
      ? '0' + cleanPhone.substring(2)
      : cleanPhone.startsWith('0')
      ? cleanPhone
      : '0' + cleanPhone;

    const provider = (config?.smsProvider || 'melipayamak').toLowerCase();

    const username = (
      config?.smsUsername ||
      config?.smsApiKey ||
      process.env.MELIPAYAMAK_USERNAME ||
      process.env.SMS_USERNAME ||
      process.env.SMS_API_KEY ||
      ''
    ).trim();

    const password = (
      config?.smsPassword ||
      config?.smsApiKey ||
      process.env.MELIPAYAMAK_PASSWORD ||
      process.env.SMS_PASSWORD ||
      ''
    ).trim();

    const apiKey = (
      config?.smsApiKey ||
      config?.smsPassword ||
      config?.smsUsername ||
      process.env.SMS_API_KEY ||
      ''
    ).trim();

    const from = (
      config?.smsSenderNumber ||
      process.env.MELIPAYAMAK_FROM ||
      process.env.SMS_SENDER ||
      '50004001'
    ).trim();

    // 1. IPPanel / FarazSMS Provider
    if (provider === 'ippanel' || provider === 'farazsms') {
      if (!apiKey && (!username || !password)) {
        return {
          success: false,
          error: 'اطلاعات سامانه فراز اس‌ام‌اس (کلید API یا نام کاربری و رمز) در تنظیمات ثبت نشده است.'
        };
      }

      // Try IPPanel REST API
      const ippanelKey = apiKey || username;
      const res = await fetch('https://api2.ippanel.com/api/v1/sms/send/webservice/single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `AccessKey ${ippanelKey}`
        },
        body: JSON.stringify({
          recipient: [localPhone],
          sender: from || '+983000505',
          message: text
        })
      });

      const resData = await res.json().catch(() => null);
      if (res.ok && resData && resData.status === 'OK') {
        return { success: true, provider: 'ippanel', rawResponse: JSON.stringify(resData) };
      }

      // Fallback to legacy select endpoint
      const legacyParams = new URLSearchParams({
        op: 'send',
        uname: username,
        pass: password,
        from: from || '3000505',
        to: `["${localPhone}"]`,
        msg: text
      });

      const legacyRes = await fetch('http://ippanel.com/api/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: legacyParams.toString()
      });
      const legacyText = await legacyRes.text();
      return {
        success: legacyRes.ok && !legacyText.includes('error'),
        provider: 'ippanel',
        rawResponse: legacyText
      };
    }

    // 2. Kavenegar Provider
    if (provider === 'kavenegar') {
      const kaveKey = apiKey || username;
      if (!kaveKey) {
        return { success: false, error: 'کلید API کاوانگار در تنظیمات وارد نشده است.' };
      }
      const url = `https://api.kavenegar.com/v1/${encodeURIComponent(kaveKey)}/sms/send.json?receptor=${encodeURIComponent(localPhone)}&message=${encodeURIComponent(text)}${from ? `&sender=${encodeURIComponent(from)}` : ''}`;
      const kaveRes = await fetch(url);
      const kaveData: any = await kaveRes.json().catch(() => null);
      if (kaveRes.ok && kaveData?.return?.status === 200) {
        return { success: true, provider: 'kavenegar', rawResponse: JSON.stringify(kaveData) };
      }
      return {
        success: false,
        provider: 'kavenegar',
        error: kaveData?.return?.message || 'خطا در وب‌سرویس کاوانگار'
      };
    }

    // 3. Default: MeliPayamak (SendSimpleSMS2)
    if (!username || !password || !from) {
      return {
        success: false,
        error: 'اطلاعات سامانه ملی‌پیامک (نام کاربری، رمز عبور یا شماره خط فرستنده) در تنظیمات ثبت نشده است.'
      };
    }

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);
    params.append('from', from);
    params.append('to', formattedTo);
    params.append('text', text);
    params.append('isflash', 'false');

    const response = await fetch('https://api.payamak-panel.com/post/Send.asmx/SendSimpleSMS2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const rawResponse = await response.text();
    const result = parseMelipayamakResponse(rawResponse, response.ok);

    return {
      success: result.success,
      error: result.error,
      provider: 'melipayamak',
      rawResponse,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || String(err),
    };
  }
}

export async function sendMelipayamakSMS(
  toPhone: string,
  text: string,
  config?: Partial<SiteConfig>
): Promise<{ success: boolean; rawResponse?: string; error?: string }> {
  return sendUniversalSMS(toPhone, text, config);
}

/**
 * Sends SMS notification exclusively to the Admin when a new booking is registered
 */
export async function sendAdminAppointmentNotification(
  appointment: AppointmentForSMS,
  config?: Partial<SiteConfig>
): Promise<{ success: boolean; rawResponse?: string; error?: string }> {
  const adminPhoneRaw = (
    config?.adminPhoneNumber ||
    process.env.ADMIN_PHONE ||
    process.env.SMS_ADMIN_PHONE ||
    '09913272265'
  ).trim();

  const appointmentDate = appointment.dayName || appointment.dateStr || '';
  const appointmentTime = appointment.timeSlot;
  const clientPhone = appointment.phone || 'ثبت نشده';
  const text = `نوبت جدید در سالن Loren Cut ثبت شد 💈\n👤 مشتری: ${appointment.clientName}\n📞 تلفن: ${clientPhone}\n✂️ خدمت: ${appointment.serviceName || 'اصلاح سر'}\n📅 تاریخ: ${appointmentDate}\n⏰ ساعت: ${appointmentTime}\n🔑 کد پیگیری: ${appointment.trackingCode || ''}`;

  return sendUniversalSMS(adminPhoneRaw, text, config);
}

export async function sendCustomerAppointmentNotification(
  appointment: AppointmentForSMS,
  config?: Partial<SiteConfig>
): Promise<{ success: boolean; rawResponse?: string; error?: string }> {
  if (!appointment.phone) {
    return { success: false, error: 'شماره تلفن مشتری وارد نشده است.' };
  }

  const template = config?.smsConfirmTemplate && config.smsConfirmTemplate.trim().length > 0
    ? config.smsConfirmTemplate
    : 'سلام {نام} عزیز 💈\nنوبت شما در پیرایشگاه Loren Cut ثبت شد.\n📅 تاریخ: {تاریخ}\n⏰ ساعت: {ساعت}\n✂️ خدمت: {خدمت}\n🔑 کد پیگیری: {کد}\nمنتظر دیدارتان هستیم!';

  const text = template
    .replace(/\{نام\}/g, appointment.clientName || 'مشتری گرامی')
    .replace(/\{تاریخ\}/g, appointment.dayName || appointment.dateStr || '')
    .replace(/\{ساعت\}/g, appointment.timeSlot || '')
    .replace(/\{خدمت\}/g, appointment.serviceName || 'اصلاح')
    .replace(/\{مبلغ\}/g, appointment.servicePrice || '')
    .replace(/\{کد\}/g, appointment.trackingCode || '')
    .replace(/\{تلفن\}/g, appointment.phone || '');

  return sendUniversalSMS(appointment.phone, text, config);
}
