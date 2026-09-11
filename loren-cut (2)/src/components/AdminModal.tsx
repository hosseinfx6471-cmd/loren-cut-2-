import React, { useState, useEffect, useRef, useMemo } from 'react';
import bcrypt from 'bcryptjs';
import { Appointment, ContentItem, ContentCategory, SiteConfig, ServiceItem, CustomerMember } from '../types';
import { getAvailableTimeSlots, getUpcomingDates, isAppointmentPast, isPastDate, getTodayDateStr } from '../utils/dateUtils';
import { compressImage } from '../utils/imageUtils';
import {
  normalizePhoneNumber,
  formatDisplayPhone,
  normalizeName,
  deduplicateCustomers,
  downloadCSV,
  downloadVCard
} from '../utils/customerUtils';
import {
  Lock,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  Upload,
  Download,
  Calendar,
  Folder,
  CreditCard,
  Settings,
  Image as ImageIcon,
  Video,
  Eye,
  Key,
  Clock,
  Tag,
  Smartphone,
  Archive,
  RotateCcw,
  AlertTriangle,
  Users,
  Phone,
  MessageSquare,
  Copy,
  Check,
  Search,
  Award,
  Crown,
  UserPlus,
  FileSpreadsheet,
  Edit3,
  UserCheck,
  LogOut,
  Loader2
} from 'lucide-react';
import { formatCustomerConfirmationSms, generateDirectSmsLink, formatAdminBookingAlertSms } from '../utils/smsService';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  smartFetch?: (expressUrl: string, phpRoute: string, options?: RequestInit) => Promise<{ ok: boolean; data?: any; error?: string; status?: number }>;
  onRefreshData?: () => Promise<void> | void;
  siteConfig: SiteConfig;
  onUpdateSiteConfig: (newConfig: SiteConfig) => void;
  services: ServiceItem[];
  onUpdateServices: (newServices: ServiceItem[]) => void;
  onSaveAllSettings?: (newConfig: SiteConfig, newServices: ServiceItem[]) => Promise<void> | void;
  appointments: Appointment[];
  customers?: CustomerMember[];
  onSaveCustomer?: (customer: CustomerMember) => Promise<void> | void;
  onDeleteCustomer?: (idOrPhone: string) => Promise<void> | void;
  onUpdateAppointmentStatus: (id: string, status: 'confirmed' | 'canceled' | 'pending') => void;
  onDeleteAppointment: (id: string) => void;
  onRestoreAppointment?: (id: string) => void;
  onPermanentDeleteAppointment?: (id: string) => Promise<void> | void;
  onPermanentDeleteAllArchived?: () => Promise<void> | void;
  contentItems: ContentItem[];
  onAddContentItem?: (item: ContentItem) => void;
  onDeleteContentItem: (id: string) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  smartFetch,
  onRefreshData,
  siteConfig,
  onUpdateSiteConfig,
  services,
  onUpdateServices,
  onSaveAllSettings,
  appointments,
  customers = [],
  onSaveCustomer,
  onDeleteCustomer,
  onUpdateAppointmentStatus,
  onDeleteAppointment,
  onRestoreAppointment,
  onPermanentDeleteAppointment,
  onPermanentDeleteAllArchived,
  contentItems,
  onAddContentItem,
  onDeleteContentItem,
}) => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return typeof window !== 'undefined' && Boolean(sessionStorage.getItem('loren_admin_token'));
  });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Active Admin Tab
  const [activeTab, setActiveTab] = useState<'appointments' | 'customers' | 'archive' | 'settings'>('appointments');

  // Customer Club State
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'loyal' | 'single'>('all');
  const [copiedAllPhoneStatus, setCopiedAllPhoneStatus] = useState(false);
  const [copiedSinglePhone, setCopiedSinglePhone] = useState<string | null>(null);
  
  // Add Customer Modal State
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustNotes, setNewCustNotes] = useState('');
  const [newCustBookings, setNewCustBookings] = useState(1);
  const [customerError, setCustomerError] = useState('');

  // Inline Note Editing State
  const [editingNoteCustId, setEditingNoteCustId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // Customer Delete Confirmation State
  const [customerToDelete, setCustomerToDelete] = useState<CustomerMember | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  // Permanent Delete Confirmation State
  const [appointmentToDeletePermanently, setAppointmentToDeletePermanently] = useState<Appointment | null>(null);
  const [isDeletingPermanently, setIsDeletingPermanently] = useState(false);

  // Bulk Delete All Archived Confirmation State
  const [showDeleteAllArchiveConfirm, setShowDeleteAllArchiveConfirm] = useState(false);
  const [isDeletingAllArchive, setIsDeletingAllArchive] = useState(false);

  // Receipt Modal Preview State
  const [viewReceiptUrl, setViewReceiptUrl] = useState<string | null>(null);

  // Settings State
  const [cardNumberInput, setCardNumberInput] = useState(siteConfig.cardNumber || '');
  const [cardHolderInput, setCardHolderInput] = useState(siteConfig.cardHolder || '');
  const [telegramUsernameInput, setTelegramUsernameInput] = useState(siteConfig.telegramUsername || '');
  const [instagramUrlInput, setInstagramUrlInput] = useState(siteConfig.instagramUrl || '');
  const [whatsappUrlInput, setWhatsappUrlInput] = useState(siteConfig.whatsappUrl || 'https://wa.me/989167209686');
  const [googleMapsUrlInput, setGoogleMapsUrlInput] = useState(siteConfig.googleMapsUrl || 'https://maps.app.goo.gl/treLYmP7oPh6RE468?g_st=ic');
  const [adminPhoneInput, setAdminPhoneInput] = useState(siteConfig.adminPhoneNumber || '09913272265');
  const [adminUsernameSettingInput, setAdminUsernameSettingInput] = useState(siteConfig.adminUsername || 'admin');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');

  // Editable Services List State
  const [editableServices, setEditableServices] = useState<ServiceItem[]>(services);

  // Price & Working Hours / Time Slots State
  const [depositAmountInput, setDepositAmountInput] = useState(siteConfig.depositAmount || '۷۰۰,۰۰۰ تومان');
  const [timeSlotsInput, setTimeSlotsInput] = useState(
    (siteConfig.customTimeSlots && siteConfig.customTimeSlots.length > 0)
      ? siteConfig.customTimeSlots.join(', ')
      : getAvailableTimeSlots().join(', ')
  );
  const [disabledSlotsList, setDisabledSlotsList] = useState<string[]>(
    siteConfig.disabledTimeSlots || []
  );
  const [selectedDisableDate, setSelectedDisableDate] = useState<string>('all');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // SMS Quick Action States (for appointment list copy/direct links)
  const [smsCopiedAppId, setSmsCopiedAppId] = useState<string | null>(null);
  const [groupSmsCopied, setGroupSmsCopied] = useState(false);

  // Track previous open state so we only populate fields when modal transitions from closed to open
  const prevIsOpenRef = useRef(false);

  // Synced unique customer list (strictly deduplicated with NO duplicate name or phone)
  const allUniqueCustomers = useMemo(() => {
    return deduplicateCustomers(customers || []);
  }, [customers]);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    let list = allUniqueCustomers;

    if (customerFilter === 'loyal') {
      list = list.filter((c) => (c.totalBookings || 1) > 1);
    } else if (customerFilter === 'single') {
      list = list.filter((c) => (c.totalBookings || 1) <= 1);
    }

    if (customerSearchTerm.trim()) {
      const q = customerSearchTerm.trim().toLowerCase();
      const normQ = normalizePhoneNumber(q);
      list = list.filter((c) => {
        const nameMatch = (c.name || '').toLowerCase().includes(q);
        const phoneMatch = (c.phone || '').includes(normQ) || (c.phone || '').includes(q);
        const serviceMatch = (c.lastServiceName || '').toLowerCase().includes(q);
        const notesMatch = (c.notes || '').toLowerCase().includes(q);
        return nameMatch || phoneMatch || serviceMatch || notesMatch;
      });
    }

    return list;
  }, [allUniqueCustomers, customerFilter, customerSearchTerm]);

  // Loyal customers count
  const loyalCustomersCount = useMemo(() => {
    return allUniqueCustomers.filter((c) => (c.totalBookings || 1) > 1).length;
  }, [allUniqueCustomers]);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setCardNumberInput(siteConfig.cardNumber || '');
      setCardHolderInput(siteConfig.cardHolder || '');
      setTelegramUsernameInput(siteConfig.telegramUsername || '');
      setInstagramUrlInput(siteConfig.instagramUrl || '');
      setWhatsappUrlInput(siteConfig.whatsappUrl || 'https://wa.me/989167209686');
      setGoogleMapsUrlInput(siteConfig.googleMapsUrl || '');
      setAdminPhoneInput(siteConfig.adminPhoneNumber || '09913272265');
      setAdminUsernameSettingInput(siteConfig.adminUsername || 'admin');
      setAdminPasswordInput(''); // Keep blank so existing hash is untouched unless admin types new password
      setDepositAmountInput(siteConfig.depositAmount || '۷۰۰,۰۰۰ تومان');
      setTimeSlotsInput(
        (siteConfig.customTimeSlots && siteConfig.customTimeSlots.length > 0)
          ? siteConfig.customTimeSlots.join(', ')
          : getAvailableTimeSlots().join(', ')
      );
      setDisabledSlotsList(siteConfig.disabledTimeSlots || []);
      setEditableServices(services || []);
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, siteConfig, services]);

  const upcomingDisableDates = getUpcomingDates(7);

  // Toggle slot active/disabled
  const toggleSlotDisabled = (slot: string) => {
    const key = selectedDisableDate === 'all' ? slot : `${selectedDisableDate}_${slot}`;
    setDisabledSlotsList((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  };

  const removeDisabledItem = (itemKey: string) => {
    setDisabledSlotsList((prev) => prev.filter((s) => s !== itemKey));
  };

  // Active appointments: Not archived AND date is today or future (past days are automatically in archive)
  const activeAppointments = useMemo(() => {
    return appointments.filter((app) => !isAppointmentPast(app));
  }, [appointments]);

  // Archived appointments: Manually archived OR date has passed
  const archivedAppointments = useMemo(() => {
    return appointments.filter((app) => isAppointmentPast(app));
  }, [appointments]);

  if (!isOpen) return null;

  // Handle Admin Login with Strict Server-Side Authentication
  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    const cleanUser = (customUser !== undefined ? customUser : usernameInput).trim();
    const cleanPass = (customPass !== undefined ? customPass : passwordInput).trim();

    if (!cleanUser || !cleanPass) {
      setAuthError('لطفاً نام کاربری و رمز عبور را وارد نمایید.');
      setAuthLoading(false);
      return;
    }

    try {
      let res: { ok: boolean; data?: any; error?: string; status?: number };
      if (smartFetch) {
        res = await smartFetch('/api/admin/login', 'admin_login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password: cleanPass })
        });
      } else {
        const raw = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, password: cleanPass })
        });
        const data = await raw.json().catch(() => ({}));
        res = { ok: raw.ok, data, status: raw.status };
      }

      if (res.ok && res.data?.success) {
        if (res.data.token) {
          sessionStorage.setItem('loren_admin_token', res.data.token);
        }
        setIsAuthenticated(true);
        setAuthError('');
        if (onRefreshData) {
          await onRefreshData();
        }
      } else {
        setAuthError(res.data?.error || res.error || 'نام کاربری یا رمز عبور اشتباه است.');
      }
    } catch (err: any) {
      setAuthError('خطا در برقراری ارتباط با سرور. لطفاً اتصال شبکه را بررسی نمایید.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Admin Logout
  const handleLogout = async () => {
    try {
      if (smartFetch) {
        await smartFetch('/api/admin/logout', 'admin_logout', { method: 'POST' });
      }
    } catch {}
    sessionStorage.removeItem('loren_admin_token');
    setIsAuthenticated(false);
    setUsernameInput('');
    setPasswordInput('');
    if (onRefreshData) {
      await onRefreshData();
    }
  };

  // Customer Club Action Handlers
  const handleCopyAllPhoneNumbers = () => {
    const phones = allUniqueCustomers.map((c) => c.phone).filter(Boolean);
    if (phones.length === 0) return;
    const textToCopy = phones.join('\n');
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedAllPhoneStatus(true);
      setTimeout(() => setCopiedAllPhoneStatus(false), 2500);
    });
  };

  const handleCopySinglePhone = (phone: string) => {
    navigator.clipboard.writeText(phone).then(() => {
      setCopiedSinglePhone(phone);
      setTimeout(() => setCopiedSinglePhone(null), 2000);
    });
  };

  const handleDownloadVCardFile = () => {
    downloadVCard(allUniqueCustomers);
  };

  const handleDownloadCSVFile = () => {
    downloadCSV(allUniqueCustomers);
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCustName.trim();
    const cleanPhone = normalizePhoneNumber(newCustPhone);

    if (!cleanName) {
      setCustomerError('لطفاً نام مشتری را وارد کنید.');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 10) {
      setCustomerError('شماره تلفن معتبر وارد کنید (مثال: ۰۹۱۲۳۴۵۶۷۸۹).');
      return;
    }

    const normName = normalizeName(cleanName);
    const existing = allUniqueCustomers.find(
      (c) => normalizePhoneNumber(c.phone) === cleanPhone || normalizeName(c.name) === normName
    );

    const newCustomer: CustomerMember = {
      id: existing ? existing.id : 'cust-' + cleanPhone,
      name: cleanName,
      phone: cleanPhone,
      totalBookings: existing ? Math.max(existing.totalBookings || 1, newCustBookings || 1) : (newCustBookings || 1),
      firstBookingDate: existing?.firstBookingDate || new Date().toLocaleDateString('fa-IR'),
      lastBookingDate: new Date().toLocaleDateString('fa-IR'),
      lastServiceName: existing?.lastServiceName || 'ثبت دستی مدیر',
      notes: newCustNotes.trim() || existing?.notes || '',
      createdAt: existing?.createdAt || new Date().toLocaleDateString('fa-IR'),
    };

    if (onSaveCustomer) {
      await onSaveCustomer(newCustomer);
    }

    // Reset Form
    setNewCustName('');
    setNewCustPhone('');
    setNewCustNotes('');
    setNewCustBookings(1);
    setCustomerError('');
    setShowAddCustomerModal(false);
  };

  const handleSaveCustomerNote = async (cust: CustomerMember) => {
    if (!onSaveCustomer) return;
    const updatedCust: CustomerMember = {
      ...cust,
      notes: editingNoteText.trim(),
    };
    await onSaveCustomer(updatedCust);
    setEditingNoteCustId(null);
    setEditingNoteText('');
  };

  const handleDeleteCustomerClick = (cust: CustomerMember) => {
    setCustomerToDelete(cust);
  };

  const handleConfirmDeleteCustomer = async () => {
    if (!customerToDelete || !onDeleteCustomer) return;
    setIsDeletingCustomer(true);
    try {
      await onDeleteCustomer(customerToDelete.id);
      setCustomerToDelete(null);
    } catch (err) {
      console.error('Error deleting customer:', err);
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  // Service helpers
  const handleUpdateServiceField = (id: string, field: keyof ServiceItem, value: any) => {
    setEditableServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleAddNewService = () => {
    const newService: ServiceItem = {
      id: 's-' + Date.now(),
      title: 'خدمت جدید',
      description: 'توضیحات کوتاه خدمت سالن...',
      duration: '۴۵ دقیقه',
      price: '۱,۵۰۰,۰۰۰ تومان',
      popular: false
    };
    setEditableServices((prev) => [...prev, newService]);
  };

  const handleDeleteService = (id: string) => {
    if (editableServices.length <= 1) {
      alert('حداقل یک خدمت باید در لیست خدمات وجود داشته باشد.');
      return;
    }
    setEditableServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Handle Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);

    // Parse time slots from input string (split by comma or newline)
    const parsedSlots = timeSlotsInput
      .split(/[,,\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const updatedConfig: SiteConfig = {
      ...siteConfig,
      cardNumber: cardNumberInput.trim(),
      cardHolder: cardHolderInput.trim(),
      telegramUsername: telegramUsernameInput.trim(),
      instagramUrl: instagramUrlInput.trim(),
      whatsappUrl: whatsappUrlInput.trim(),
      googleMapsUrl: googleMapsUrlInput.trim(),
      customTimeSlots: parsedSlots.length > 0 ? parsedSlots : siteConfig.customTimeSlots,
      disabledTimeSlots: disabledSlotsList,
      depositAmount: depositAmountInput.trim() || '۷۰۰,۰۰۰ تومان',
      adminPhoneNumber: adminPhoneInput.trim() || '09913272265',
      adminUsername: adminUsernameSettingInput.trim() || 'admin',
      smsProvider: siteConfig.smsProvider || 'melipayamak',
      smsUsername: siteConfig.smsUsername || '',
      smsPassword: siteConfig.smsPassword || '',
      smsApiKey: siteConfig.smsApiKey || '',
      smsSenderNumber: siteConfig.smsSenderNumber || '50004001',
    };

    // If new password was entered by admin, hash it; otherwise retain existing hash
    if (adminPasswordInput && adminPasswordInput.trim() !== '') {
      let finalPasswordHash = adminPasswordInput.trim();
      if (!finalPasswordHash.startsWith('$2')) {
        try {
          finalPasswordHash = bcrypt.hashSync(finalPasswordHash, 10);
        } catch (err) {
          console.error('Error hashing admin password:', err);
        }
      }
      updatedConfig.adminPasswordHash = finalPasswordHash;
    }

    try {
      if (onSaveAllSettings) {
        await onSaveAllSettings(updatedConfig, editableServices);
      } else {
        onUpdateSiteConfig(updatedConfig);
        onUpdateServices(editableServices);
      }

      setSettingsSaved(true);
      setAdminPasswordInput(''); // Clear password input after successful update
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="relative w-full max-w-5xl bg-white/95 backdrop-blur-xl rounded-3xl border border-black/10 overflow-hidden flex flex-col max-h-[92vh] shadow-2xl text-black">
        
        {/* Modal Header */}
        <div className="p-5 bg-black text-white border-b border-black/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c5a059] text-black flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-lg">پنل اختصاصی مدیریت Loren Cut</h3>
              </div>
              <p className="text-xs text-gray-300">مدیریت نوبت‌ها و باشگاه مشتریان</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                title="خروج از حساب مدیریت"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-red-500/30"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">خروج</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {!isAuthenticated ? (
          /* LOGIN SCREEN */
          <div className="p-8 sm:p-12 max-w-md mx-auto w-full my-auto space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl glass border border-black/10 text-[#c5a059] flex items-center justify-center mx-auto shadow-sm">
              <Key className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-2xl font-serif text-black">ورود مدیر سیستم</h4>
              <p className="text-xs text-gray-500 mt-1">
                اطلاعات ورود مدیر را وارد نمایید.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4 text-right">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">نام کاربری مدیر</label>
                <input
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="نام کاربری مدیر را وارد نمایید"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-black text-sm focus:outline-none focus:border-[#c5a059]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">رمز عبور مدیر</label>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="رمز عبور مدیر را وارد نمایید"
                  className="w-full px-4 py-3 rounded-xl bg-white border border-black/10 text-black text-sm focus:outline-none focus:border-[#c5a059]"
                />
              </div>

              {authError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200 font-medium">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 rounded-xl bg-black text-white font-bold text-sm hover:bg-black/80 transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {authLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>در حال بررسی هویت...</span>
                  </>
                ) : (
                  <span>ورود به پنل مدیریت</span>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* AUTHENTICATED PANEL */
          <div className="flex-1 overflow-y-auto flex flex-col">
            
            {/* Admin Tabs */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-100 border-b border-black/10">
                    <button
                      onClick={() => setActiveTab('appointments')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                        activeTab === 'appointments'
                          ? 'bg-black text-white shadow-md'
                          : 'glass text-gray-800 hover:bg-white border border-black/10'
                      }`}
                    >
                      <Calendar className="w-4 h-4" />
                      <span>لیست نوبت‌های فعال ({activeAppointments.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('customers')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                        activeTab === 'customers'
                          ? 'bg-[#c5a059] text-black shadow-md font-extrabold ring-2 ring-black/20'
                          : 'glass text-gray-800 hover:bg-white border border-black/10'
                      }`}
                    >
                      <Users className="w-4 h-4 text-[#8c6d2d]" />
                      <span>باشگاه مشتریان ({allUniqueCustomers.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('archive')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                        activeTab === 'archive'
                          ? 'bg-[#123e32] text-white shadow-md'
                          : 'glass text-gray-800 hover:bg-white border border-black/10'
                      }`}
                    >
                      <Archive className="w-4 h-4" />
                      <span>بایگانی ({archivedAppointments.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('settings')}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                        activeTab === 'settings'
                          ? 'bg-black text-white shadow-md'
                          : 'glass text-gray-800 hover:bg-white border border-black/10'
                      }`}
                    >
                      <Settings className="w-4 h-4" />
                      <span>تنظیمات شماره کارت و مدیر</span>
                    </button>
                  </div>

                  {/* TAB CONTENT */}
                  <div className="p-6 flex-1 overflow-y-auto">
                    
                    {/* TAB 1: ACTIVE APPOINTMENTS */}
                    {activeTab === 'appointments' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-black/10">
                          <h4 className="text-base font-bold text-black">نوبت‌های رزرو شده فعال متقاضیان</h4>
                          <span className="text-xs text-gray-500 font-semibold">
                            تعداد کل فعال: {activeAppointments.length} نوبت
                          </span>
                        </div>

                        {activeAppointments.length === 0 ? (
                          <div className="p-8 text-center glass rounded-2xl border border-black/10">
                            <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">در حال حاضر نوبت فعالی ثبت نشده است.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {activeAppointments.map((app) => (
                              <div
                                key={app.id}
                                className="p-4 rounded-2xl glass border border-black/10 hover:border-black/30 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-black text-base">{app.clientName}</span>
                                    <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 dir-ltr font-bold">
                                      {app.phone}
                                    </span>
                                    <span className="text-[11px] font-mono text-black bg-black/5 px-2 py-0.5 rounded font-bold">
                                      {app.trackingCode}
                                    </span>
                                  </div>

                                  <p className="text-xs text-gray-700">
                                    ✂️ <strong className="text-black">{app.serviceName}</strong> | 📅 {app.dayName} | ⏰ ساعت: {app.timeSlot}
                                  </p>
                                  <p className="text-[11px] text-gray-500">
                                    تاریخ ثبت: {app.createdAt}
                                  </p>
                                </div>

                                {/* Actions & Receipt */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Receipt Image Button */}
                                  {app.receiptImage && (
                                    <button
                                      onClick={() => setViewReceiptUrl(app.receiptImage)}
                                      className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>مشاهده رسید پرداخت</span>
                                    </button>
                                  )}

                                  {/* Status Change */}
                                  <select
                                    value={app.status}
                                    onChange={(e) =>
                                      onUpdateAppointmentStatus(app.id, e.target.value as any)
                                    }
                                    className="px-3 py-1.5 rounded-xl bg-white border border-black/20 text-xs font-semibold text-black focus:outline-none cursor-pointer"
                                  >
                                    <option value="pending">در انتظار تایید</option>
                                    <option value="confirmed">تایید شده ✅</option>
                                    <option value="canceled">لغو شده ❌</option>
                                  </select>

                                  {/* Direct SMS Action */}
                                  <a
                                    href={generateDirectSmsLink(app.phone, formatCustomerConfirmationSms(app, siteConfig.smsConfirmTemplate))}
                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all"
                                    title="ارسال پیامک تایید مستقیم به گوشی مشتری"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>پیامک</span>
                                  </a>

                                  {/* Copy SMS Text */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const text = formatCustomerConfirmationSms(app, siteConfig.smsConfirmTemplate);
                                      navigator.clipboard.writeText(text);
                                      setSmsCopiedAppId(app.id);
                                      setTimeout(() => setSmsCopiedAppId(null), 2500);
                                    }}
                                    className="p-1.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-300 text-xs cursor-pointer transition-all"
                                    title={smsCopiedAppId === app.id ? 'متن پیامک کپی شد' : 'کپی متن پیامک'}
                                  >
                                    {smsCopiedAppId === app.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  {/* Delete / Move to Archive */}
                                  <button
                                    onClick={() => onDeleteAppointment(app.id)}
                                    className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                                    title="انتقال نوبت به بایگانی"
                                  >
                                    <Archive className="w-3.5 h-3.5 text-amber-700" />
                                    <span>بایگانی</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB: CUSTOMER CLUB (باشگاه مشتریان) */}
                    {activeTab === 'customers' && (
                      <div className="space-y-6">
                        
                        {/* Section Header & Stats Bar */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-3 border-b border-black/10 flex-wrap gap-3">
                            <div>
                              <h4 className="text-lg font-bold text-black flex items-center gap-2">
                                <Users className="w-5 h-5 text-[#8c6d2d]" />
                                <span>باشگاه مشتریان Loren Cut</span>
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                لیست یکتای تمام مشتریان با ثبت خودکار سوابق، بدون ثبت تکراری شماره و نام
                              </p>
                            </div>

                            {/* Top Quick Actions Bar */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Copy All Phone Numbers */}
                              <button
                                type="button"
                                onClick={handleCopyAllPhoneNumbers}
                                disabled={allUniqueCustomers.length === 0}
                                className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm disabled:opacity-50"
                                title="کپی تمامی شماره‌های اعضای باشگاه مشتریان برای ارسال پیامک انبوه"
                              >
                                {copiedAllPhoneStatus ? (
                                  <>
                                    <Check className="w-4 h-4 text-emerald-400" />
                                    <span className="text-emerald-300">کپی شد! ({allUniqueCustomers.length} شماره)</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 text-amber-300" />
                                    <span>کپی تمام شماره‌ها</span>
                                  </>
                                )}
                              </button>

                              {/* Download VCard / Contacts */}
                              <button
                                type="button"
                                onClick={handleDownloadVCardFile}
                                disabled={allUniqueCustomers.length === 0}
                                className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm disabled:opacity-50"
                                title="دانلود فایل مخاطبین (VCF) برای ذخیره مستقیم مخاطبین در گوشی"
                              >
                                <Smartphone className="w-4 h-4" />
                                <span>دانلود مخاطبین گوشی (VCF)</span>
                              </button>

                              {/* Download Excel/CSV */}
                              <button
                                type="button"
                                onClick={handleDownloadCSVFile}
                                disabled={allUniqueCustomers.length === 0}
                                className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm disabled:opacity-50"
                                title="دانلود لیست اکسل / CSV با تمام جزئیات"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                                <span>دانلود خروجی اکسل (CSV)</span>
                              </button>

                              {/* Add Customer Manually */}
                              <button
                                type="button"
                                onClick={() => {
                                  setCustomerError('');
                                  setShowAddCustomerModal(true);
                                }}
                                className="px-3.5 py-2 rounded-xl bg-[#c5a059] hover:bg-[#b59048] text-black text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                              >
                                <UserPlus className="w-4 h-4" />
                                <span>+ افزودن مشتری</span>
                              </button>
                            </div>
                          </div>

                          {/* 3 Metric Cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-[#c5a059] text-black flex items-center justify-center font-black shrink-0 shadow-sm">
                                <Users className="w-6 h-6" />
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-gray-600 block">کل اعضای باشگاه</span>
                                <span className="text-xl font-extrabold text-black">{allUniqueCustomers.length} نفر</span>
                              </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                                <Crown className="w-6 h-6 text-amber-300" />
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-emerald-800 block">مشتریان وفادار (چند نوبته)</span>
                                <span className="text-xl font-extrabold text-emerald-950">{loyalCustomersCount} نفر</span>
                              </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center font-black shrink-0 shadow-sm">
                                <Calendar className="w-6 h-6 text-[#c5a059]" />
                              </div>
                              <div>
                                <span className="text-xs font-semibold text-gray-600 block">مجموع کل رزروها</span>
                                <span className="text-xl font-extrabold text-black">{appointments.length} نوبت</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Search & Filter Toolbar */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-gray-100/90 rounded-2xl border border-black/10">
                          {/* Search Input */}
                          <div className="relative flex-1">
                            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={customerSearchTerm}
                              onChange={(e) => setCustomerSearchTerm(e.target.value)}
                              placeholder="جستجو با نام، شماره تلفن، خدمات یا یادداشت..."
                              className="w-full pr-9 pl-4 py-2 rounded-xl bg-white border border-black/10 text-xs font-semibold text-black placeholder-gray-400 focus:outline-none focus:border-[#c5a059]"
                            />
                            {customerSearchTerm && (
                              <button
                                type="button"
                                onClick={() => setCustomerSearchTerm('')}
                                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black text-xs p-1"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Filter Tabs */}
                          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-black/10 shrink-0">
                            <button
                              type="button"
                              onClick={() => setCustomerFilter('all')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                customerFilter === 'all'
                                  ? 'bg-black text-white'
                                  : 'text-gray-600 hover:text-black'
                              }`}
                            >
                              همه ({allUniqueCustomers.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomerFilter('loyal')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                customerFilter === 'loyal'
                                  ? 'bg-emerald-700 text-white'
                                  : 'text-emerald-800 hover:text-emerald-950'
                              }`}
                            >
                              <Crown className="w-3 h-3 text-amber-400" />
                              <span>وفادار ({loyalCustomersCount})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomerFilter('single')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                customerFilter === 'single'
                                  ? 'bg-gray-800 text-white'
                                  : 'text-gray-600 hover:text-black'
                              }`}
                            >
                              جدید ({allUniqueCustomers.length - loyalCustomersCount})
                            </button>
                          </div>
                        </div>

                        {/* Customer Cards List */}
                        {filteredCustomers.length === 0 ? (
                          <div className="p-10 text-center glass rounded-2xl border border-black/10 space-y-2">
                            <Users className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm font-bold text-gray-700">هیچ مشتری با مشخصات جستجو یافت نشد.</p>
                            <p className="text-xs text-gray-400">به‌محض ثبت اولین نوبت آنلاین یا افزودن دستی، اطلاعات مشتری اینجا نمایش داده می‌شود.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {filteredCustomers.map((cust) => {
                              const isLoyal = (cust.totalBookings || 1) > 1;
                              const isEditingNote = editingNoteCustId === cust.id;

                              return (
                                <div
                                  key={cust.id || cust.phone}
                                  className={`p-4 rounded-2xl border transition-all shadow-sm flex flex-col gap-3 ${
                                    isLoyal
                                      ? 'bg-white border-amber-300/80 hover:border-amber-400 ring-1 ring-amber-100'
                                      : 'bg-white border-black/10 hover:border-black/30'
                                  }`}
                                >
                                  {/* Main Info Row */}
                                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                    {/* Left (Avatar & Name & Phone) */}
                                    <div className="flex items-center gap-3">
                                      {/* Avatar */}
                                      <div
                                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 shadow-sm ${
                                          isLoyal
                                            ? 'bg-gradient-to-br from-[#c5a059] to-[#8c6d2d] text-white'
                                            : 'bg-gray-800 text-white'
                                        }`}
                                      >
                                        {(cust.name || 'م')[0]}
                                      </div>

                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-bold text-black text-base">{cust.name}</span>
                                          
                                          {/* Phone badge with copy button */}
                                          <div className="inline-flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-2.5 py-0.5 rounded-full border border-gray-300 text-xs font-mono font-bold dir-ltr transition-colors">
                                            <span>{formatDisplayPhone(cust.phone)}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleCopySinglePhone(cust.phone)}
                                              className="text-gray-500 hover:text-black cursor-pointer"
                                              title="کپی شماره تماس"
                                            >
                                              {copiedSinglePhone === cust.phone ? (
                                                <Check className="w-3 h-3 text-emerald-600" />
                                              ) : (
                                                <Copy className="w-3 h-3" />
                                              )}
                                            </button>
                                          </div>

                                          {/* Loyal Customer Badge */}
                                          {isLoyal ? (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-extrabold shadow-xs">
                                              <Crown className="w-3 h-3 text-amber-600 fill-amber-600" />
                                              <span>مشتری وفادار ({cust.totalBookings} نوبت)</span>
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold">
                                              <UserCheck className="w-3 h-3 text-emerald-600" />
                                              <span>عضو باشگاه ({cust.totalBookings || 1} نوبت)</span>
                                            </span>
                                          )}
                                        </div>

                                        {/* Date and Service details */}
                                        <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                                          <span>✂️ آخرین خدمت: <strong className="text-gray-900">{cust.lastServiceName || 'اصلاح سر'}</strong></span>
                                          <span>📅 آخرین مراجعه: <strong className="text-gray-900">{cust.lastBookingDate || cust.createdAt || '-'}</strong></span>
                                          {cust.firstBookingDate && cust.firstBookingDate !== cust.lastBookingDate && (
                                            <span className="text-gray-400">| اولین نوبت: {cust.firstBookingDate}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Action Buttons Row */}
                                    <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                                      {/* Call Button */}
                                      <a
                                        href={`tel:${cust.phone}`}
                                        className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1 transition-all"
                                        title="تماس تلفنی مستقیم"
                                      >
                                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>تماس</span>
                                      </a>

                                      {/* SMS Button */}
                                      <a
                                        href={`sms:${cust.phone}`}
                                        className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold flex items-center gap-1 transition-all"
                                        title="ارسال پیامک مستقیم"
                                      >
                                        <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                                        <span>پیامک</span>
                                      </a>

                                      {/* WhatsApp Button */}
                                      <a
                                        href={`https://wa.me/98${cust.phone.startsWith('0') ? cust.phone.slice(1) : cust.phone}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-1.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/30 text-xs font-bold flex items-center gap-1 transition-all"
                                        title="گفتگو در واتساپ"
                                      >
                                        <span>واتساپ</span>
                                      </a>

                                      {/* Delete Customer */}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteCustomerClick(cust)}
                                        className="p-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all cursor-pointer"
                                        title="حذف از باشگاه مشتریان"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Note Section (Custom Admin Memo) */}
                                  <div className="pt-2 border-t border-gray-100 text-xs">
                                    {isEditingNote ? (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={editingNoteText}
                                          onChange={(e) => setEditingNoteText(e.target.value)}
                                          placeholder="یادداشت مدیر (مثال: مدل موی ترجیحی، چای کم‌رنگ، ...)"
                                          className="flex-1 px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-300 text-xs text-black font-medium focus:outline-none focus:border-[#c5a059]"
                                          autoFocus
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSaveCustomerNote(cust)}
                                          className="px-3 py-1.5 rounded-xl bg-[#c5a059] text-black font-bold text-xs hover:bg-[#b59048] cursor-pointer"
                                        >
                                          ذخیره
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingNoteCustId(null)}
                                          className="px-3 py-1.5 rounded-xl bg-gray-200 text-gray-700 text-xs hover:bg-gray-300 cursor-pointer"
                                        >
                                          انصراف
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center justify-between text-gray-500 bg-gray-50/70 px-3 py-1.5 rounded-xl border border-gray-100">
                                        <div className="flex items-center gap-1.5 overflow-hidden text-ellipsis">
                                          <Edit3 className="w-3 h-3 text-gray-400 shrink-0" />
                                          <span className="font-semibold text-gray-600">یادداشت:</span>
                                          <span className="text-gray-700 truncate">
                                            {cust.notes ? cust.notes : 'یادداشتی ثبت نشده است.'}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingNoteCustId(cust.id);
                                            setEditingNoteText(cust.notes || '');
                                          }}
                                          className="text-[11px] text-[#8c6d2d] hover:underline font-bold shrink-0 mr-2 cursor-pointer"
                                        >
                                          {cust.notes ? 'ویرایش' : '+ افزودن یادداشت'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB 2: ARCHIVED APPOINTMENTS */}
                    {activeTab === 'archive' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-black/10 flex-wrap gap-2">
                          <div>
                            <h4 className="text-base font-bold text-black flex items-center gap-2">
                              <Archive className="w-4 h-4 text-[#123e32]" />
                              <span>بایگانی نوبت‌ها</span>
                            </h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              نوبت‌های بایگانی شده برای همیشه در پایگاه داده باقی مانده و امکان بازگردانی دارند.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-700 bg-gray-100 px-3 py-1.5 rounded-full font-bold">
                              تعداد بایگانی: {archivedAppointments.length} نوبت
                            </span>
                            {archivedAppointments.length > 0 && onPermanentDeleteAllArchived && (
                              <button
                                type="button"
                                onClick={() => setShowDeleteAllArchiveConfirm(true)}
                                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                                title="حذف تمام نوبت‌های موجود در بایگانی"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>حذف تمام نوبت‌های بایگانی شده</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {archivedAppointments.length === 0 ? (
                          <div className="p-12 text-center glass rounded-2xl border border-black/10 space-y-2">
                            <Archive className="w-12 h-12 text-gray-400 mx-auto mb-1" />
                            <p className="text-sm font-semibold text-gray-600">هنوز هیچ نوبتی در بخش بایگانی وجود ندارد.</p>
                            <p className="text-xs text-gray-400">
                              وقتی نوبتی را از بخش نوبت‌های فعال بایگانی کنید، اطلاعات و فیش پرداخت آن در اینجا به طور دائمی حفظ می‌شود.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {archivedAppointments.map((app) => (
                              <div
                                key={app.id}
                                className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 hover:border-amber-400 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-black text-base">{app.clientName}</span>
                                    <span className="text-xs text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300 dir-ltr font-bold">
                                      {app.phone}
                                    </span>
                                    <span className="text-[11px] font-mono text-black bg-black/5 px-2 py-0.5 rounded font-bold">
                                      کد: {app.trackingCode}
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/80 px-2 py-0.5 rounded-md">
                                      📁 بایگانی شده
                                    </span>
                                  </div>

                                  <p className="text-xs text-gray-800">
                                    ✂️ خدمت: <strong className="text-black">{app.serviceName}</strong> | 📅 تاریخ: {app.dayName} | ⏰ ساعت: {app.timeSlot}
                                  </p>
                                  <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                                    <span>ثبت شده در: {app.createdAt}</span>
                                    {app.archivedAt && (
                                      <span className="text-amber-800 font-medium">تاریخ بایگانی: {app.archivedAt}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Actions & Receipt */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  {/* Receipt Image Button */}
                                  {app.receiptImage && (
                                    <button
                                      onClick={() => setViewReceiptUrl(app.receiptImage)}
                                      className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>مشاهده رسید پرداخت</span>
                                    </button>
                                  )}

                                  {/* Restore Button */}
                                  {onRestoreAppointment && (
                                    <button
                                      onClick={() => onRestoreAppointment(app.id)}
                                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                                      title="بازگردانی این نوبت به لیست نوبت‌های فعال"
                                    >
                                      <RotateCcw className="w-3.5 h-3.5" />
                                      <span>بازگردانی به نوبت‌های فعال</span>
                                    </button>
                                  )}

                                  {/* Permanent Delete Button */}
                                  {onPermanentDeleteAppointment && (
                                    <button
                                      onClick={() => setAppointmentToDeletePermanently(app)}
                                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-sm"
                                      title="حذف کامل و دائمی این نوبت از پایگاه داده"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                      <span>حذف کامل</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

              {/* TAB 3: SETTINGS */}
              {activeTab === 'settings' && (
                <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
                  {/* Section 1: Services & Prices Manager */}
                  <div className="space-y-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                    <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                      <div className="flex items-center gap-2 text-[#8c6d2d]">
                        <Tag className="w-4 h-4 shrink-0" />
                        <h4 className="text-sm font-bold text-black">
                          مدیریت قیمت و مشخصات خدمات سالن
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddNewService}
                        className="px-3 py-1.5 rounded-xl bg-[#c5a059] text-black font-bold text-xs flex items-center gap-1 hover:bg-[#b08c48] cursor-pointer shadow-sm transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>افزودن خدمت جدید</span>
                      </button>
                    </div>

                    {/* Deposit Amount Field */}
                    <div className="p-3 bg-white rounded-xl border border-black/10">
                      <label className="text-xs font-bold text-gray-900 block mb-1">
                        مبلغ بیعانه واریزی هنگام ثبت نوبت آنلاین *
                      </label>
                      <input
                        type="text"
                        value={depositAmountInput}
                        onChange={(e) => setDepositAmountInput(e.target.value)}
                        placeholder="۷۰۰,۰۰۰ تومان"
                        className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-emerald-800 text-sm font-bold focus:outline-none focus:border-[#c5a059]"
                      />
                    </div>

                    {/* Editable Services List */}
                    <div className="space-y-3 pt-2">
                      <label className="text-xs font-bold text-gray-800 block">
                        لیست کامل خدمات (امکان تغییر قیمت، زمان و عناوین):
                      </label>
                      {editableServices.map((srv, idx) => (
                        <div
                          key={srv.id}
                          className="p-3.5 rounded-xl bg-white border border-black/10 space-y-3 shadow-sm relative group"
                        >
                          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                            <span className="text-xs font-bold text-[#c5a059]">
                              خدمت #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteService(srv.id)}
                              className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                              title="حذف خدمت"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            <div className="sm:col-span-1">
                              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                                عنوان خدمت:
                              </label>
                              <input
                                type="text"
                                value={srv.title}
                                onChange={(e) =>
                                  handleUpdateServiceField(srv.id, 'title', e.target.value)
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-black text-xs font-bold focus:outline-none focus:border-[#c5a059]"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                                قیمت کامل:
                              </label>
                              <input
                                type="text"
                                value={srv.price}
                                onChange={(e) =>
                                  handleUpdateServiceField(srv.id, 'price', e.target.value)
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-black text-xs font-bold text-amber-800 focus:outline-none focus:border-[#c5a059]"
                              />
                            </div>

                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                                مدت زمان:
                              </label>
                              <input
                                type="text"
                                value={srv.duration}
                                onChange={(e) =>
                                  handleUpdateServiceField(srv.id, 'duration', e.target.value)
                                }
                                className="w-full px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-black text-xs focus:outline-none focus:border-[#c5a059]"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-gray-700 block mb-1">
                              توضیحات کوتاه:
                            </label>
                            <input
                              type="text"
                              value={srv.description}
                              onChange={(e) =>
                                handleUpdateServiceField(srv.id, 'description', e.target.value)
                              }
                              className="w-full px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 text-xs focus:outline-none focus:border-[#c5a059]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-800 block mb-1">
                        ساعت‌ها و سانس‌های کاری (با کاما یا خط بعد جدا کنید) *
                      </label>
                      <textarea
                        rows={2}
                        value={timeSlotsInput}
                        onChange={(e) => setTimeSlotsInput(e.target.value)}
                        placeholder="11:00, 11:45, 12:30, 13:15, 14:00, 14:45, 15:30, 16:15, 17:00, 17:45, 18:30, 19:15"
                        className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-xs font-mono dir-ltr focus:outline-none focus:border-[#c5a059]"
                      />
                    </div>

                    {/* Interactive Slot Disabling / Manual Reservation Section */}
                    <div className="pt-3 border-t border-amber-200/60 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 text-[#c5a059]" />
                          <span>مدیریت رزرو دستی و بستن سانس (انتخاب روز و سانس):</span>
                        </label>
                        <span className="text-[11px] text-gray-500">
                          💡 روی روز موردنظر و سپس سانس کلیک کنید
                        </span>
                      </div>

                      {/* Date Selection Bar */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
                        <button
                          type="button"
                          onClick={() => setSelectedDisableDate('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                            selectedDisableDate === 'all'
                              ? 'bg-[#18181b] text-[#c5a059] border-[#c5a059]'
                              : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          همه روزها (کلی)
                        </button>
                        {upcomingDisableDates.map((d) => (
                          <button
                            type="button"
                            key={d.dateStr}
                            onClick={() => setSelectedDisableDate(d.dateStr)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                              selectedDisableDate === d.dateStr
                                ? 'bg-[#18181b] text-[#c5a059] border-[#c5a059]'
                                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                            }`}
                          >
                            {d.fullLabel}
                          </button>
                        ))}
                      </div>

                      {/* Selected Context Label */}
                      <div className="text-xs font-bold text-gray-700 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-2">
                        <span className="text-[#c5a059]">📍 در حال تنظیم برای:</span>
                        <span className="text-black font-extrabold">
                          {selectedDisableDate === 'all'
                            ? 'همه‌ی روزها (رزرو دستی همیشگی)'
                            : upcomingDisableDates.find((d) => d.dateStr === selectedDisableDate)?.fullLabel || selectedDisableDate}
                        </span>
                      </div>

                      {/* Slots Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {timeSlotsInput
                          .split(/[,,\n]/)
                          .map((s) => s.trim())
                          .filter((s) => s.length > 0)
                          .map((slot) => {
                            const isGloballyDisabled = disabledSlotsList.includes(slot);
                            const isDateDisabled =
                              selectedDisableDate !== 'all' &&
                              disabledSlotsList.includes(`${selectedDisableDate}_${slot}`);
                            const isDisabledInCurrentView = isGloballyDisabled || isDateDisabled;

                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => toggleSlotDisabled(slot)}
                                className={`p-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer border ${
                                  isDisabledInCurrentView
                                    ? 'bg-rose-50 text-rose-900 border-rose-300 shadow-inner'
                                    : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                                }`}
                              >
                                <span className="font-mono text-sm">{slot}</span>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                                    isGloballyDisabled
                                      ? 'bg-rose-700 text-white'
                                      : isDateDisabled
                                      ? 'bg-amber-600 text-white'
                                      : 'bg-emerald-600 text-white'
                                  }`}
                                >
                                  {isGloballyDisabled
                                    ? 'رزرو شده (کلی) 🚫'
                                    : isDateDisabled
                                    ? 'رزرو شده (این روز) 🚫'
                                    : 'آزاد و فعال ✅'}
                                </span>
                              </button>
                            );
                          })}
                      </div>

                      {/* Summary of Disabled Slots */}
                      {disabledSlotsList.length > 0 && (
                        <div className="mt-3 p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                          <span className="text-xs font-bold text-rose-900 block">
                            📋 لیست سانس‌های رزرو دستی شده توسط شما:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {disabledSlotsList.map((itemKey) => {
                              const parts = itemKey.split('_');
                              let label = itemKey;
                              if (parts.length === 1) {
                                label = `ساعت ${parts[0]} (همه روزها)`;
                              } else if (parts.length === 2) {
                                const matchedDate = upcomingDisableDates.find(
                                  (d) => d.dateStr === parts[0]
                                );
                                const dateLabel = matchedDate ? matchedDate.dayName : parts[0];
                                label = `ساعت ${parts[1]} - ${dateLabel}`;
                              }

                              return (
                                <span
                                  key={itemKey}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-100 border border-rose-300 text-rose-900 rounded-lg text-xs font-semibold"
                                >
                                  <span>{label}</span>
                                  <button
                                    type="button"
                                    onClick={() => removeDisabledItem(itemKey)}
                                    className="text-rose-600 hover:text-rose-900 font-extrabold cursor-pointer text-sm"
                                    title="آزاد کردن مجدد سانس"
                                  >
                                    ×
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 2: Card, Contact & Security Info */}
                  <div className="space-y-4 pt-2">
                    <h4 className="text-sm font-bold text-black pb-2 border-b border-black/10 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[#c5a059]" />
                      <span>تنظیمات مالی، اطلاعات ارتباطی و امنیت مدیر</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Deposit Amount */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          مبلغ بیعانه پیش‌پرداخت نوبت
                        </label>
                        <input
                          type="text"
                          value={depositAmountInput}
                          onChange={(e) => setDepositAmountInput(e.target.value)}
                          placeholder="۷۰۰,۰۰۰ تومان"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm font-bold text-amber-800 focus:outline-none focus:border-[#c5a059]"
                        />
                      </div>

                      {/* Admin Phone Number */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          شماره موبایل مدیریت سالن
                        </label>
                        <input
                          type="text"
                          value={adminPhoneInput}
                          onChange={(e) => setAdminPhoneInput(e.target.value)}
                          placeholder="09913272265"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm font-mono dir-ltr focus:outline-none focus:border-[#c5a059]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Card Number */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          شماره کارت واریز بیعانه
                        </label>
                        <input
                          type="text"
                          value={cardNumberInput}
                          onChange={(e) => setCardNumberInput(e.target.value)}
                          placeholder="6219861929212669"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm font-mono dir-ltr focus:outline-none focus:border-[#c5a059]"
                        />
                      </div>

                      {/* Card Holder */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          نام دارنده و صاحب حساب کارت
                        </label>
                        <input
                          type="text"
                          value={cardHolderInput}
                          onChange={(e) => setCardHolderInput(e.target.value)}
                          placeholder="محمدمهدی سبزوار"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm focus:outline-none focus:border-[#c5a059]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Instagram Link */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          لینک پیج اینستاگرام
                        </label>
                        <input
                          type="text"
                          value={instagramUrlInput}
                          onChange={(e) => setInstagramUrlInput(e.target.value)}
                          placeholder="https://www.instagram.com/lorencut_..."
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm font-mono dir-ltr focus:outline-none focus:border-[#c5a059]"
                        />
                      </div>

                      {/* WhatsApp Link */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          لینک چت واتساپ
                        </label>
                        <input
                          type="text"
                          value={whatsappUrlInput}
                          onChange={(e) => setWhatsappUrlInput(e.target.value)}
                          placeholder="https://wa.me/989167209686"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm font-mono dir-ltr focus:outline-none focus:border-[#c5a059]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Telegram Username */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          آیدی تلگرام پشتیبانی
                        </label>
                        <input
                          type="text"
                          value={telegramUsernameInput}
                          onChange={(e) => setTelegramUsernameInput(e.target.value)}
                          placeholder="@Mohamadsabzevar"
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm font-mono dir-ltr focus:outline-none focus:border-[#c5a059]"
                        />
                      </div>

                      {/* Google Maps Location Link */}
                      <div>
                        <label className="text-xs font-semibold text-gray-700 block mb-1">
                          لینک نشانی سالن روی گوگل مپ
                        </label>
                        <input
                          type="text"
                          value={googleMapsUrlInput}
                          onChange={(e) => setGoogleMapsUrlInput(e.target.value)}
                          placeholder="https://maps.app.goo.gl/..."
                          className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm font-mono dir-ltr focus:outline-none focus:border-[#c5a059]"
                        />
                      </div>
                    </div>

                    {/* Admin Credentials (Username & Password) */}
                    <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/90 space-y-3">
                      <div className="flex items-center gap-2 pb-2 border-b border-amber-200/80">
                        <Key className="w-4 h-4 text-[#c5a059]" />
                        <h5 className="text-xs font-extrabold text-black">
                          تنظیمات امنیتی و ورود به پنل مدیریت (نام کاربری و رمز عبور)
                        </h5>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Admin Username */}
                        <div>
                          <label className="text-xs font-bold text-gray-800 block mb-1">
                            نام کاربری ورود به پنل مدیریت:
                          </label>
                          <input
                            type="text"
                            value={adminUsernameSettingInput}
                            onChange={(e) => setAdminUsernameSettingInput(e.target.value)}
                            placeholder="admin"
                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm font-mono dir-ltr focus:outline-none focus:border-[#c5a059]"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">
                            نام کاربری پیش‌فرض <span className="font-mono">admin</span> است و می‌توانید آن را تغییر دهید.
                          </p>
                        </div>

                        {/* Admin Password */}
                        <div>
                          <label className="text-xs font-bold text-gray-800 block mb-1">
                            رمز عبور جدید پنل مدیریت:
                          </label>
                          <input
                            type="password"
                            value={adminPasswordInput}
                            onChange={(e) => setAdminPasswordInput(e.target.value)}
                            placeholder="برای حفظ رمز فعلی خالی بگذارید"
                            className="w-full px-4 py-2.5 rounded-xl bg-white border border-black/10 text-black text-sm focus:outline-none focus:border-[#c5a059]"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">
                            در صورت خالی بودن، رمز عبور قبلی بدون تغییر حفظ می‌شود.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {settingsSaved && (
                    <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      تنظیمات جدید با موفقیت ذخیره شد.
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-black/10">
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="px-6 py-3 rounded-xl bg-black text-white font-bold text-sm shadow-md hover:bg-black/80 cursor-pointer flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSavingSettings ? (
                        <>
                          <Loader2 className="w-4 h-4 text-[#c5a059] animate-spin" />
                          <span>در حال ذخیره...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-[#c5a059]" />
                          <span>ذخیره تغییرات</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>
        )}

      </div>

      {/* Lightbox for Receipt Image */}
      {viewReceiptUrl && (
        <div
          className="fixed inset-0 z-60 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setViewReceiptUrl(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-3xl border border-black/10 overflow-hidden p-5 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 pb-2">
              <h4 className="font-bold text-black text-sm">تصویر رسید واریزی مشتری</h4>
              <button
                onClick={() => setViewReceiptUrl(null)}
                className="px-3 py-1 rounded-lg bg-black text-white text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[70vh]">
              <img src={viewReceiptUrl} alt="رسید" className="max-h-[70vh] object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Customer to Club */}
      {showAddCustomerModal && (
        <div
          className="fixed inset-0 z-70 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setShowAddCustomerModal(false)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl border border-black/10 overflow-hidden p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#c5a059] text-black flex items-center justify-center font-bold">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-base">افزودن مشتری به باشگاه</h4>
                  <p className="text-xs text-gray-500">شماره به صورت یکتا ذخیره می‌شود</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCustomerModal(false)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {customerError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{customerError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomerSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-800 block mb-1">
                  نام و نام خانوادگی مشتری *
                </label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="مثال: علی رضایی"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-black focus:outline-none focus:border-[#c5a059]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 block mb-1">
                  شماره تلفن همراه *
                </label>
                <input
                  type="tel"
                  required
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-black dir-ltr focus:outline-none focus:border-[#c5a059]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-800 block mb-1">
                    تعداد نوبت‌های ثبت‌شده
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newCustBookings}
                    onChange={(e) => setNewCustBookings(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs font-bold text-black focus:outline-none focus:border-[#c5a059]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-800 block mb-1">
                    وضعیت عضویت
                  </label>
                  <div className="px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-1">
                    {newCustBookings > 1 ? (
                      <>
                        <Crown className="w-4 h-4 text-amber-600" />
                        <span>مشتری وفادار</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4 text-emerald-600" />
                        <span>مشتری جدید</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-800 block mb-1">
                  یادداشت یا ویژگی‌های اختصاصی (اختیاری)
                </label>
                <textarea
                  rows={2}
                  value={newCustNotes}
                  onChange={(e) => setNewCustNotes(e.target.value)}
                  placeholder="مثال: مدل موی ترجیحی: فید سایه، قهوه ترک..."
                  className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-black font-medium focus:outline-none focus:border-[#c5a059]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold cursor-pointer transition-all"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#c5a059] hover:bg-[#b59048] text-black text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
                >
                  <Plus className="w-4 h-4" />
                  <span>ثبت در باشگاه مشتریان</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Permanent Deletion */}
      {appointmentToDeletePermanently && (
        <div
          className="fixed inset-0 z-70 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => !isDeletingPermanently && setAppointmentToDeletePermanently(null)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl border border-rose-200 overflow-hidden p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-base">تایید حذف کامل نوبت</h4>
                <p className="text-xs text-rose-600 font-medium">عملیات غیرقابل بازگردانی</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-700 bg-rose-50/60 p-4 rounded-2xl border border-rose-100">
              <p className="font-bold text-rose-900 text-xs sm:text-sm leading-relaxed">
                این نوبت برای همیشه حذف خواهد شد و قابل بازگردانی نیست.
              </p>
              <div className="text-xs text-gray-600 space-y-1 pt-2 border-t border-rose-200/60">
                <p>👤 مشتری: <strong className="text-gray-900">{appointmentToDeletePermanently.clientName}</strong> ({appointmentToDeletePermanently.phone})</p>
                <p>✂️ خدمت: <strong className="text-gray-900">{appointmentToDeletePermanently.serviceName}</strong></p>
                <p>📅 زمان: <strong className="text-gray-900">{appointmentToDeletePermanently.dayName} ({appointmentToDeletePermanently.timeSlot})</strong></p>
                <p>🔑 کد رهگیری: <span className="font-mono font-bold text-gray-900">{appointmentToDeletePermanently.trackingCode}</span></p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingPermanently}
                onClick={() => setAppointmentToDeletePermanently(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>

              <button
                type="button"
                disabled={isDeletingPermanently}
                onClick={async () => {
                  if (!appointmentToDeletePermanently || !onPermanentDeleteAppointment) return;
                  setIsDeletingPermanently(true);
                  try {
                    await onPermanentDeleteAppointment(appointmentToDeletePermanently.id);
                  } finally {
                    setIsDeletingPermanently(false);
                    setAppointmentToDeletePermanently(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingPermanently ? 'در حال حذف...' : 'تایید و حذف کامل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deleting a Customer */}
      {customerToDelete && (
        <div
          className="fixed inset-0 z-70 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => !isDeletingCustomer && setCustomerToDelete(null)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl border border-rose-300 overflow-hidden p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-base">حذف مشتری از باشگاه</h4>
                <p className="text-xs text-rose-600 font-medium">باشگاه مشتریان</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-700 bg-rose-50/70 p-4 rounded-2xl border border-rose-100">
              <p className="font-bold text-rose-900 text-sm leading-relaxed">
                آیا از حذف «<span className="underline font-black">{customerToDelete.name}</span>» ({customerToDelete.phone}) از باشگاه مشتریان اطمینان دارید؟
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                این مشتری از لیست باشگاه مشتریان حذف خواهد شد.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingCustomer}
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>

              <button
                type="button"
                disabled={isDeletingCustomer}
                onClick={handleConfirmDeleteCustomer}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingCustomer ? 'در حال حذف...' : 'بله، حذف مشتری'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Deleting ALL Archived Appointments */}
      {showDeleteAllArchiveConfirm && (
        <div
          className="fixed inset-0 z-70 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => !isDeletingAllArchive && setShowDeleteAllArchiveConfirm(false)}
        >
          <div
            className="relative max-w-md w-full bg-white rounded-3xl border border-rose-300 overflow-hidden p-6 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-600 border-b border-rose-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-base">حذف تمام نوبت‌های بایگانی</h4>
                <p className="text-xs text-rose-600 font-medium">پاکسازی کامل بایگانی</p>
              </div>
            </div>

            <div className="space-y-3 text-sm text-gray-700 bg-rose-50/70 p-4 rounded-2xl border border-rose-100">
              <p className="font-bold text-rose-900 text-sm leading-relaxed">
                آیا از حذف دائمی تمام <span className="underline font-black">{archivedAppointments.length}</span> نوبت موجود در بایگانی اطمینان دارید؟
              </p>
              <p className="text-xs text-gray-600 leading-relaxed">
                با تایید این عملیات، تمام سوابق و فیش‌های نوبت‌های بایگانی شده برای همیشه از پایگاه داده حذف شده و نوبت‌های فعال کنونی بدون هیچ تغییری حفظ خواهند شد.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeletingAllArchive}
                onClick={() => setShowDeleteAllArchiveConfirm(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                انصراف
              </button>

              <button
                type="button"
                disabled={isDeletingAllArchive}
                onClick={async () => {
                  if (!onPermanentDeleteAllArchived) return;
                  setIsDeletingAllArchive(true);
                  try {
                    await onPermanentDeleteAllArchived();
                  } finally {
                    setIsDeletingAllArchive(false);
                    setShowDeleteAllArchiveConfirm(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingAllArchive ? 'در حال حذف همه...' : 'بله، حذف تمام بایگانی'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
