import { ServiceItem, ContentItem, SiteConfig, Appointment } from '../types';

export const initialSiteConfig: SiteConfig = {
  brandName: 'Loren Cut',
  cardNumber: '6219861929212669',
  cardHolder: 'محمدمهدی سبزوار',
  bankName: 'بانک ملت',
  telegramUsername: '@Mohamadsabzevar',
  telegramUrl: 'https://t.me/Mohamadsabzevar',
  instagramUrl: 'https://www.instagram.com/lorencut_?igsh=MTU3ZXZ5cWtodTFqOQ==',
  whatsappUrl: 'https://wa.me/989167209686',
  googleMapsUrl: 'https://maps.app.goo.gl/treLYmP7oPh6RE468?g_st=ic',
  adminUsername: 'admin',
  adminPasswordHash: '$2b$10$GyzFGUBTn.Q/KegEwSOFFe43uFtnxekMUOt3JlanGpcs1YKGQTwPK', // bcrypt for admin123
  customTimeSlots: [
    '11:00',
    '11:45',
    '12:30',
    '13:15',
    '14:00',
    '14:45',
    '15:30',
    '16:15',
    '17:00',
    '17:45',
    '18:30',
    '19:15'
  ],
  disabledTimeSlots: [],
  depositAmount: '۷۰۰,۰۰۰ تومان',
  adminPhoneNumber: '09913272265',
  smsProvider: 'melipayamak',
  smsUsername: '',
  smsPassword: '',
  smsApiKey: '',
  smsSenderNumber: '',
  smsConfirmTemplate: 'سلام {نام} عزیز 💈\nنوبت شما در پیرایشگاه Loren Cut ثبت شد.\n📅 تاریخ: {تاریخ}\n⏰ ساعت: {ساعت}\n✂️ خدمت: {خدمت}\n🔑 کد پیگیری: {کد}\nمنتظر دیدارتان هستیم!',
  smsReminderTemplate: 'سلام {نام} عزیز 💈\nیادآوری نوبت شما در سالن Loren Cut:\n📅 تاریخ: {تاریخ} - ساعت {ساعت}\nلطفاً ۵ دقیقه قبل از موعد در سالن حضور داشته باشید.'
};

export const initialServices: ServiceItem[] = [
  {
    id: 's1',
    title: 'اصلاح سر',
    description: 'اصلاح و کوتاهی تخصصی موی سر، فید و استایل متناسب با آناتومی چهره به همراه شستشو',
    duration: '۴۵ دقیقه',
    price: '۱,۵۰۰,۰۰۰ تومان',
    popular: true
  }
];

export const initialContentItems: ContentItem[] = [
  // Categorized in imageprompt folder
  {
    id: 'c1',
    title: 'فید مدرن و خط‌زنی تخصصی',
    category: 'imageprompt',
    folderPath: 'imageprompt/modern_skin_fade.jpg',
    description: 'نمونه‌کار استایل Skin Fade با خط‌زنی دقیق ریش و فرم‌دهی موی فر',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?q=80&w=800&auto=format&fit=crop',
    createdAt: '1403/05/01',
    tags: ['فید', 'استایل', 'نمونه کار']
  },
  {
    id: 'c2',
    title: 'مدل موی Texture Crop VIP',
    category: 'imageprompt',
    folderPath: 'imageprompt/texture_crop_style.jpg',
    description: 'کوتاهی تکسچر کراپ مناسب چهره‌های بیضی و مستطیلی با واکس مات',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800&auto=format&fit=crop',
    createdAt: '1403/05/02',
    tags: ['کوتاهی', 'مدرن']
  },

  // Categorized in imagecourse folder
  {
    id: 'c3',
    title: 'دوره جامع مسترکلاس فید و سایه‌کاری',
    category: 'imagecourse',
    folderPath: 'imagecourse/fade_masterclass_banner.jpg',
    description: 'آموزش صفر تا صد تکنیک‌های سایه زدن، کار با ماشین و قیچی به همراه مدرک معتبر',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?q=80&w=800&auto=format&fit=crop',
    createdAt: '1403/04/20',
    price: '۴,۵۰۰,۰۰۰ تومان',
    tags: ['دوره آموزشی', 'مسترکلاس']
  },
  {
    id: 'c4',
    title: 'دوره خصوصی گریم و استایل داماد',
    category: 'imagecourse',
    folderPath: 'imagecourse/groom_styling_course.jpg',
    description: 'شناخت آناتومی چهره، متعادل‌سازی، پاکسازی سریع پوست و تثبیت موی داماد',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1517832606299-7ae9b720a186?q=80&w=800&auto=format&fit=crop',
    createdAt: '1403/04/25',
    price: '۶,۰۰۰,۰۰۰ تومان',
    tags: ['داماد', 'آموزش']
  },

  // Categorized in imageservice folder
  {
    id: 'c5',
    title: 'محیط استودیو VIP لورن کات',
    category: 'imageservice',
    folderPath: 'imageservice/loren_studio_vip.jpg',
    description: 'فضایی آرامش‌بخش با تجهیزات لوکس و بهداشتی برای ارتقای تجربه مشتریان',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=800&auto=format&fit=crop',
    createdAt: '1403/05/01',
    tags: ['سالن', 'تجهیزات']
  },

  // Categorized in imageblog folder
  {
    id: 'c6',
    title: 'راهنمای مراقبت از موهای کراتینه شده',
    category: 'imageblog',
    folderPath: 'imageblog/keratin_care_tips.jpg',
    description: 'مقاله اختصاصی: چگونه ماندگاری کراتین مو را تا ۶ ماه افزایش دهیم؟',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=800&auto=format&fit=crop',
    createdAt: '1403/04/15',
    tags: ['مقاله', 'سلامت مو']
  },

  // Categorized in videos folder
  {
    id: 'c7',
    title: 'ویدیو هایلایت تغییر استایل کژوال به VIP',
    category: 'videos',
    folderPath: 'videos/style_transformation_reel.mp4',
    description: 'ویدیو قبل و بعد کوتاه کردن مو و اصلاح ریش مشتری ویژه سالن',
    mediaType: 'video',
    mediaUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-getting-a-haircut-in-a-barbershop-41584-large.mp4',
    createdAt: '1403/05/03',
    tags: ['ویدیو', 'قبل و بعد']
  }
];

export const initialAppointments: Appointment[] = [
  {
    id: 'app-101',
    clientName: 'رضا علوی',
    phone: '09123456789',
    dateStr: '2026-07-23',
    dayName: 'پنج‌شنبه ۳ مرداد',
    timeSlot: '14:00 - 15:00',
    serviceId: 's1',
    serviceName: 'اصلاح سر',
    servicePrice: '۱,۵۰۰,۰۰۰ تومان',
    receiptImage: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=400&auto=format&fit=crop',
    status: 'confirmed',
    createdAt: '1403/05/01 - 10:30',
    trackingCode: 'LC-884920'
  }
];

export const initialCustomers: import('../types').CustomerMember[] = [
  {
    id: 'cust-09123456789',
    name: 'رضا علوی',
    phone: '09123456789',
    totalBookings: 1,
    firstBookingDate: 'پنج‌شنبه ۳ مرداد',
    lastBookingDate: 'پنج‌شنبه ۳ مرداد',
    lastServiceName: 'اصلاح سر',
    notes: 'مشتری ثابت - مدل فید متوسط',
    createdAt: '1403/05/01 - 10:30'
  }
];

