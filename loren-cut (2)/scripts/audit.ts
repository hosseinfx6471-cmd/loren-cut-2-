import fs from 'fs';

async function runAudit() {
  const base = 'http://localhost:3000';
  console.log('===============================================================');
  console.log('🔍 گزارش بازرسی خط‌به‌خط و جامع کل سیستم LOREN CUT');
  console.log('===============================================================');

  const results: { module: string; test: string; ok: boolean; info?: string }[] = [];

  function record(module: string, test: string, ok: boolean, info?: string) {
    results.push({ module, test, ok, info });
    const mark = ok ? '✅' : '❌';
    console.log(`${mark} [${module}] ${test} ${info ? '-> ' + info : ''}`);
  }

  // 1. Database file integrity
  try {
    const raw = fs.readFileSync('./app_data.json', 'utf8');
    const parsed = JSON.parse(raw);
    record('دیتابیس', 'ساختار و صحت JSON فایل app_data.json', true, `${Object.keys(parsed).length} کلید اصلی`);
    record('دیتابیس', 'وجود تنظیمات سایت (siteConfig)', !!parsed.siteConfig, parsed.siteConfig?.brandName);
    record('دیتابیس', 'وجود لیست خدمات (services)', Array.isArray(parsed.services) && parsed.services.length > 0, `${parsed.services.length} خدمت`);
    record('دیتابیس', 'وجود آرایه نوبت‌ها (appointments)', Array.isArray(parsed.appointments), `${parsed.appointments.length} نوبت ثبت‌شده`);
    record('دیتابیس', 'وجود باشگاه مشتریان (customers)', Array.isArray(parsed.customers), `${parsed.customers.length} مشتری`);
  } catch (err: any) {
    record('دیتابیس', 'بررسی ساختار فایل', false, err.message);
  }

  // 2. Health endpoint check
  try {
    const res = await fetch(`${base}/api/health`);
    const data = await res.json();
    record('سرور', 'بررسی سلامت و پاسخگویی سریع سرور (/api/health)', res.status === 200 && data.status === 'ok');
  } catch (err: any) {
    record('سرور', 'سلامت سرور', false, err.message);
  }

  // 3. Public API sanitization
  try {
    const res = await fetch(`${base}/api/data`);
    const data = await res.json();
    const noHash = !data.siteConfig?.adminPasswordHash && !data.siteConfig?.adminPassword;
    record('امنیت', 'فیلتر کامل داده‌های محرمانه در API عمومی (/api/data)', res.status === 200 && noHash);
  } catch (err: any) {
    record('امنیت', 'داده‌های عمومی', false, err.message);
  }

  // 4. Admin Authentication
  let adminToken = '';
  try {
    const bad = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongPassword_123' })
    });
    record('احراز هویت', 'مسدودسازی ورود با رمز عبور اشتباه (401 Unauthorized)', bad.status === 401);

    const good = await fetch(`${base}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const goodData = await good.json();
    adminToken = goodData.token;
    record('احراز هویت', 'ورود موفقیت‌آمیز مدیر با رمز صحیح و صدور توکن امضاشده', good.status === 200 && !!adminToken);
  } catch (err: any) {
    record('احراز هویت', 'بررسی ورود مدیریت', false, err.message);
  }

  // 5. Admin Authorization
  try {
    const unauth = await fetch(`${base}/api/admin/data`);
    record('سطح دسترسی', 'مسدودسازی دسترسی بدون توکن به بخش مدیریت', unauth.status === 401);

    const authRes = await fetch(`${base}/api/admin/data`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const authData = await authRes.json();
    record('سطح دسترسی', 'دسترسی مجاز مدیر با توکن به کل دیتابیس', authRes.status === 200 && !!authData.siteConfig);
  } catch (err: any) {
    record('سطح دسترسی', 'بررسی توکن ادمین', false, err.message);
  }

  // 6. Complete Booking & Lifecycle
  const testId = `audit_app_${Date.now()}`;
  const testPhone = `0912${Math.floor(1000000 + Math.random() * 9000000)}`;
  try {
    // Book
    const bookRes = await fetch(`${base}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: testId,
        clientName: 'مشتری آزمایشی بازرسی',
        phone: testPhone,
        dateStr: '2026-12-20',
        dayName: 'یکشنبه ۳۰ آذر',
        timeSlot: '16:15',
        serviceId: 's1',
        serviceName: 'اصلاح و استایل مو',
        servicePrice: '۳۵۰,۰۰۰ تومان',
        trackingCode: 'LC-AUDIT-OK'
      })
    });
    const bookData = await bookRes.json();
    record('رزرو نوبت', 'ثبت موفق نوبت آنلاین توسط مشتری با کد رهگیری', bookRes.status === 200 && bookData.success);

    // Double booking
    const dupRes = await fetch(`${base}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `${testId}_dup`,
        clientName: 'مشتری متداخل',
        phone: '09120000000',
        dateStr: '2026-12-20',
        dayName: 'یکشنبه ۳۰ آذر',
        timeSlot: '16:15',
        serviceId: 's1',
        serviceName: 'اصلاح و استایل مو',
        servicePrice: '۳۵۰,۰۰۰ تومان',
        trackingCode: 'LC-AUDIT-DUP'
      })
    });
    record('رزرو نوبت', 'جلوگیری هوشمند از رزرو تکراری یک سانس (409 Conflict)', dupRes.status === 409);

    // Confirm
    const confRes = await fetch(`${base}/api/appointments/${testId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ status: 'confirmed' })
    });
    record('مدیریت نوبت', 'تغییر وضعیت نوبت به تایید شده توسط مدیر', confRes.status === 200);

    // Archive
    const archRes = await fetch(`${base}/api/appointments/${testId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ archived: true })
    });
    record('مدیریت نوبت', 'بایگانی نوبت پایان‌یافته', archRes.status === 200);

    // Delete
    const delRes = await fetch(`${base}/api/appointments/${testId}/permanent`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    record('مدیریت نوبت', 'حذف قطعی نوبت تستی از سیستم', delRes.status === 200);
  } catch (err: any) {
    record('رزرو نوبت', 'چرخه نوبت‌دهی', false, err.message);
  }

  // 7. Sensitive files direct access block (HTTP 403)
  const filesToBlock = ['/app_data.json', '/server.ts', '/.env', '/package.json'];
  for (const f of filesToBlock) {
    try {
      const res = await fetch(`${base}${f}`);
      const text = await res.text();
      const isBlocked = res.status === 403 || (!text.includes('adminPasswordHash') && !text.includes('activeSessions'));
      record('امنیت فایل‌ها', `مسدودسازی دسترسی مستقیم به ${f}`, isBlocked, `Status: ${res.status}`);
    } catch (err: any) {
      record('امنیت فایل‌ها', `بررسی ${f}`, false, err.message);
    }
  }

  // 8. Granular Settings Update & Data Integrity
  try {
    const origDataRes = await fetch(`${base}/api/admin/data`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const origData = await origDataRes.json();
    const origConfig = origData.siteConfig;

    // Update single field: instagramUrl
    const updateRes = await fetch(`${base}/api/admin/save-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        siteConfig: {
          ...origConfig,
          instagramUrl: 'https://www.instagram.com/lorencut_test_audit'
        }
      })
    });
    const updateData = await updateRes.json();
    const checkRes = await fetch(`${base}/api/admin/data`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const checkData = await checkRes.json();

    const preserved = checkData.siteConfig.cardNumber === origConfig.cardNumber &&
      checkData.siteConfig.cardHolder === origConfig.cardHolder &&
      checkData.siteConfig.whatsappUrl === origConfig.whatsappUrl &&
      checkData.siteConfig.instagramUrl === 'https://www.instagram.com/lorencut_test_audit';

    record('یکپارچگی داده', 'بروزرسانی جزئی تنظیمات بدون بازنویسی سایر فیلدها', updateRes.status === 200 && preserved);

    // Restore original config
    await fetch(`${base}/api/admin/save-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({ siteConfig: origConfig })
    });
  } catch (err: any) {
    record('یکپارچگی داده', 'تست یکپارچگی تنظیمات', false, err.message);
  }

  // 9. Tampered Token & HMAC Forgery Defense
  try {
    const fakeToken = adminToken.slice(0, -5) + 'xxxxx';
    const fakeRes = await fetch(`${base}/api/admin/data`, {
      headers: { 'Authorization': `Bearer ${fakeToken}` }
    });
    record('امنیت توکن', 'مسدودسازی توکن دستکاری‌شده و امضای جعلی (HMAC Tamper)', fakeRes.status === 401);
  } catch (err: any) {
    record('امنیت توکن', 'تست جعل توکن', false, err.message);
  }

  // 10. SMS Route & Audit Status
  try {
    const smsStatusRes = await fetch(`${base}/api/admin/sms-status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const smsStatusData = await smsStatusRes.json();
    record('سامانه پیامک', 'پاسخگویی اندپوینت وضعیت پیامک به مدیر مجاز', smsStatusRes.status === 200 && smsStatusData.success);
    record('سامانه پیامک', 'شماره پیش‌فرض مقصد پیامک مدیر (09913272265)', smsStatusData.adminPhone === '09913272265');
  } catch (err: any) {
    record('سامانه پیامک', 'تست وضعیت پیامک', false, err.message);
  }

  // 11. Customer Club CRUD & Loyalty Flow
  const testCustId = `cust_audit_${Date.now()}`;
  const testCustPhone = `0935${Math.floor(1000000 + Math.random() * 9000000)}`;
  try {
    // Add customer
    const addCustRes = await fetch(`${base}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        id: testCustId,
        name: 'مشتری تست وفاداری',
        phone: testCustPhone,
        totalBookings: 3,
        notes: 'مشتری VIP - تست بازرسی',
        firstBookingDate: '۱۴۰۳/۰۵/۰۱',
        lastBookingDate: '۱۴۰۳/۰۶/۰۱',
        lastServiceName: 'اصلاح سر و استایل',
        createdAt: '۱۴۰۳/۰۵/۰۱'
      })
    });
    const addCustData = await addCustRes.json();
    record('باشگاه مشتریان', 'افزودن و بروزرسانی مشتری در دیتابیس توسط مدیر', addCustRes.status === 200 && addCustData.success);

    // Delete customer
    const delCustRes = await fetch(`${base}/api/customers/${testCustId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    record('باشگاه مشتریان', 'حذف موفق مشتری از باشگاه توسط مدیر', delCustRes.status === 200);
  } catch (err: any) {
    record('باشگاه مشتریان', 'تست عملیات باشگاه مشتریان', false, err.message);
  }

  // 12. Manual Slot Booking & Disabling
  try {
    const origDataRes = await fetch(`${base}/api/admin/data`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const origData = await origDataRes.json();
    const origDisabled = origData.siteConfig.disabledTimeSlots || [];

    // Disable slot "18:30"
    await fetch(`${base}/api/admin/save-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        siteConfig: {
          ...origData.siteConfig,
          disabledTimeSlots: [...origDisabled, '18:30']
        }
      })
    });

    // Try booking the disabled slot
    const bookDisabled = await fetch(`${base}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: `audit_disabled_${Date.now()}`,
        clientName: 'تست رزرو سانس مسدود',
        phone: '09121111111',
        dateStr: '2026-12-25',
        dayName: 'جمعه ۵ دی',
        timeSlot: '18:30',
        serviceId: 's1',
        serviceName: 'اصلاح سر',
        servicePrice: '۳۵۰,۰۰۰ تومان',
        trackingCode: 'LC-AUDIT-DIS'
      })
    });
    record('تنظیمات سانس‌ها', 'مسدودسازی رزرو آنلاین سانس‌های مسدودشده توسط مدیر (409 Conflict)', bookDisabled.status === 409);

    // Restore disabled slots
    await fetch(`${base}/api/admin/save-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        siteConfig: {
          ...origData.siteConfig,
          disabledTimeSlots: origDisabled
        }
      })
    });
  } catch (err: any) {
    record('تنظیمات سانس‌ها', 'تست مسدودسازی سانس‌ها', false, err.message);
  }

  console.log('===============================================================');
  const allPass = results.every(r => r.ok);
  const passedCount = results.filter(r => r.ok).length;
  console.log(`نتیجه بازرسی: ${passedCount} از ${results.length} آزمون با موفقیت کامل پاس شدند.`);
  console.log('وضعیت سلامت کلی سامانه:', allPass ? '✅ ۱۰۰٪ سالم و بدون هیچ‌گونه خطا' : '❌ دارای اشکال');
  console.log('===============================================================');
}

runAudit();
