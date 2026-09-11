import { Appointment, CustomerMember } from '../types';

/**
 * Normalizes phone numbers to standard English digits format (09xxxxxxxxx).
 * Handles Persian/Arabic digits, removes spaces, dashes, +98, 0098, etc.
 */
export function normalizePhoneNumber(rawPhone?: string | number | null): string {
  if (!rawPhone) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  
  let cleaned = String(rawPhone).trim();
  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replaceAll(persianDigits[i], i.toString());
    cleaned = cleaned.replaceAll(arabicDigits[i], i.toString());
  }

  // Remove non-digit characters
  cleaned = cleaned.replace(/\D/g, '');

  // Format Iranian numbers
  if (cleaned.startsWith('989') && cleaned.length === 12) {
    cleaned = '0' + cleaned.substring(2);
  } else if (cleaned.startsWith('00989') && cleaned.length === 14) {
    cleaned = '0' + cleaned.substring(4);
  } else if (cleaned.startsWith('9') && cleaned.length === 10) {
    cleaned = '0' + cleaned;
  }

  return cleaned;
}

/**
 * Formats a phone number for display (e.g. 0912 345 6789).
 */
export function formatDisplayPhone(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  if (norm.length === 11 && norm.startsWith('09')) {
    return `${norm.slice(0, 4)} ${norm.slice(4, 7)} ${norm.slice(7)}`;
  }
  return norm || phone;
}

/**
 * Normalizes customer name for comparison (removes extra spaces, نیم‌فاصله, lowercase).
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars
    .replace(/\s+/g, ' ');
}

/**
 * Deduplicates customers strictly so that no duplicate phone number AND no duplicate name exist.
 * If duplicate is found, merges info (accumulating booking counts & retaining latest info).
 */
export function deduplicateCustomers(customers: CustomerMember[]): CustomerMember[] {
  if (!customers || !Array.isArray(customers)) return [];

  const phoneMap = new Map<string, CustomerMember>();
  const nameMap = new Map<string, CustomerMember>();
  const result: CustomerMember[] = [];

  for (const rawCust of customers) {
    if (!rawCust) continue;
    const phoneKey = normalizePhoneNumber(rawCust.phone);
    const nameKey = normalizeName(rawCust.name);

    if (!phoneKey && !nameKey) continue;

    // Check if already in our collection by phone or by name
    const existingByPhone = phoneKey ? phoneMap.get(phoneKey) : undefined;
    const existingByName = nameKey ? nameMap.get(nameKey) : undefined;
    const existing = existingByPhone || existingByName;

    if (existing) {
      // Merge into existing record
      existing.name = existing.name || rawCust.name;
      existing.phone = existing.phone || phoneKey;
      existing.totalBookings = Math.max(existing.totalBookings || 1, rawCust.totalBookings || 1);
      existing.lastBookingDate = rawCust.lastBookingDate || existing.lastBookingDate;
      existing.lastServiceName = rawCust.lastServiceName || existing.lastServiceName;
      if (rawCust.notes && !existing.notes?.includes(rawCust.notes)) {
        existing.notes = existing.notes ? `${existing.notes} | ${rawCust.notes}` : rawCust.notes;
      }
      if (phoneKey) phoneMap.set(phoneKey, existing);
      if (nameKey) nameMap.set(nameKey, existing);
    } else {
      const formattedCust: CustomerMember = {
        ...rawCust,
        id: rawCust.id || (phoneKey ? `cust-${phoneKey}` : `cust-${Date.now()}`),
        name: rawCust.name?.trim() || 'مشتری',
        phone: phoneKey || rawCust.phone,
        totalBookings: rawCust.totalBookings || 1,
      };
      if (phoneKey) phoneMap.set(phoneKey, formattedCust);
      if (nameKey) nameMap.set(nameKey, formattedCust);
      result.push(formattedCust);
    }
  }

  return result;
}
export function syncCustomersWithAppointments(
  currentCustomers: CustomerMember[],
  appointments: Appointment[]
): CustomerMember[] {
  const customerMap = new Map<string, CustomerMember>();

  // 1. Seed with existing registered customers
  for (const cust of currentCustomers) {
    const key = normalizePhoneNumber(cust.phone);
    if (!key) continue;
    customerMap.set(key, { ...cust, phone: key });
  }

  // 2. Sort appointments chronologically to calculate first & last booking date accurately
  const sortedApps = [...appointments].sort((a, b) => {
    const timeA = new Date(a.dateStr || a.createdAt || '').getTime() || 0;
    const timeB = new Date(b.dateStr || b.createdAt || '').getTime() || 0;
    return timeA - timeB;
  });

  // 3. Process appointments to increment counts & update dates
  for (const app of sortedApps) {
    const phoneKey = normalizePhoneNumber(app.phone);
    if (!phoneKey) continue;

    const bookingDate = app.dayName || app.dateStr || app.createdAt || 'ثبت شده';
    const clientName = app.clientName?.trim() || 'مشتری بدون نام';

    if (customerMap.has(phoneKey)) {
      const existing = customerMap.get(phoneKey)!;
      // Don't duplicate count if already manually set higher, but calculate actual appointments
      const isAlreadyCounted = false; // We update last visit info
      customerMap.set(phoneKey, {
        ...existing,
        name: existing.name || clientName,
        lastBookingDate: bookingDate,
        lastServiceName: app.serviceName || existing.lastServiceName,
      });
    } else {
      customerMap.set(phoneKey, {
        id: 'cust-' + phoneKey,
        name: clientName,
        phone: phoneKey,
        totalBookings: 1,
        firstBookingDate: bookingDate,
        lastBookingDate: bookingDate,
        lastServiceName: app.serviceName || 'اصلاح سر',
        notes: '',
        createdAt: app.createdAt || new Date().toLocaleDateString('fa-IR'),
      });
    }
  }

  // Calculate actual total bookings from current appointments list for all members
  const finalCustomers = Array.from(customerMap.values()).map((cust) => {
    const appCount = appointments.filter(
      (a) => normalizePhoneNumber(a.phone) === cust.phone
    ).length;
    return {
      ...cust,
      totalBookings: Math.max(cust.totalBookings || 1, appCount),
    };
  });

  // Return sorted with most recent bookings first
  return finalCustomers.sort((a, b) => (b.totalBookings || 0) - (a.totalBookings || 0));
}

/**
 * Generates and downloads a vCard (.vcf) file for easy import into phone contacts.
 */
export function downloadVCard(customers: CustomerMember[]) {
  if (customers.length === 0) return;

  let vcfContent = '';
  customers.forEach((c) => {
    const formattedPhone = normalizePhoneNumber(c.phone);
    vcfContent += 'BEGIN:VCARD\r\n';
    vcfContent += 'VERSION:3.0\r\n';
    vcfContent += `FN:${c.name || 'مشتری لورن کات'}\r\n`;
    vcfContent += `TEL;TYPE=CELL:${formattedPhone}\r\n`;
    vcfContent += `NOTE:باشگاه مشتریان لورن کات - ${c.totalBookings || 1} نوبت | ${c.lastServiceName || ''}\r\n`;
    vcfContent += 'END:VCARD\r\n';
  });

  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LorenCut_Customers_${Date.now()}.vcf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a CSV file of customer club.
 */
export function downloadCSV(customers: CustomerMember[]) {
  if (customers.length === 0) return;

  let csvContent = '\uFEFFنام مشتری,شماره تماس,تعداد نوبت‌ها,اولین نوبت,آخرین نوبت,آخرین خدمت,یادداشت\r\n';
  customers.forEach((c) => {
    const row = [
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${normalizePhoneNumber(c.phone)}"`,
      `"${c.totalBookings || 1}"`,
      `"${c.firstBookingDate || ''}"`,
      `"${c.lastBookingDate || ''}"`,
      `"${(c.lastServiceName || '').replace(/"/g, '""')}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`,
    ];
    csvContent += row.join(',') + '\r\n';
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `LorenCut_Club_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
