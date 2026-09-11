export type AppointmentStatus = 'pending' | 'confirmed' | 'canceled' | 'archived';

export interface Appointment {
  id: string;
  clientName: string;
  phone: string;
  dateStr: string; // YYYY-MM-DD
  dayName: string; // e.g. "پنج‌شنبه ۳ مرداد"
  timeSlot: string; // e.g. "14:00"
  serviceId: string;
  serviceName: string;
  servicePrice: string;
  receiptImage: string; // base64 / data URL
  status: AppointmentStatus;
  createdAt: string;
  trackingCode: string;
  archived?: boolean;
  archivedAt?: string;
}

export type ContentCategory = 'imageprompt' | 'imagecourse' | 'imageservice' | 'imageblog' | 'videos';

export interface ContentItem {
  id: string;
  title: string;
  category: ContentCategory;
  folderPath: string; // e.g., "imageprompt/fade_haircut.jpg"
  description: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  createdAt: string;
  price?: string;
  tags?: string[];
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  duration: string;
  price: string;
  popular?: boolean;
}

export interface CustomerMember {
  id: string;
  name: string;
  phone: string;
  totalBookings: number;
  firstBookingDate: string;
  lastBookingDate: string;
  lastServiceName?: string;
  notes?: string;
  createdAt: string;
}

export interface SiteConfig {
  brandName: string;
  cardNumber: string;
  cardHolder: string;
  bankName: string;
  telegramUsername: string;
  telegramUrl: string;
  instagramUrl: string;
  whatsappUrl?: string;
  googleMapsUrl?: string;
  adminUsername: string;
  adminPasswordHash: string;
  customTimeSlots?: string[];
  disabledTimeSlots?: string[];
  depositAmount?: string;
  adminPhoneNumber?: string;
  smsProvider?: 'melipayamak' | 'ippanel' | 'kavenegar' | 'smsir';
  smsUsername?: string;
  smsPassword?: string;
  smsApiKey?: string;
  smsSenderNumber?: string;
  smsConfirmTemplate?: string;
  smsReminderTemplate?: string;
}
