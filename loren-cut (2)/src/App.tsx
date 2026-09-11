import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { SpecialServicesGrid } from './components/SpecialServicesGrid';
import { BookingSection } from './components/BookingSection';
import { AdminModal } from './components/AdminModal';
import { Footer } from './components/Footer';

import { Appointment, ContentItem, ServiceItem, SiteConfig, CustomerMember } from './types';
import {
  initialSiteConfig,
  initialServices,
  initialContentItems,
  initialAppointments,
  initialCustomers
} from './data/initialData';
import { syncCustomersWithAppointments, deduplicateCustomers, normalizePhoneNumber } from './utils/customerUtils';
import { autoArchivePastAppointments } from './utils/dateUtils';

const sanitizeConfig = (cfg: any): SiteConfig => {
  return {
    brandName: cfg?.brandName || initialSiteConfig.brandName,
    cardNumber: cfg?.cardNumber || initialSiteConfig.cardNumber,
    cardHolder: cfg?.cardHolder || initialSiteConfig.cardHolder,
    bankName: cfg?.bankName || initialSiteConfig.bankName,
    telegramUsername: cfg?.telegramUsername || initialSiteConfig.telegramUsername,
    telegramUrl: cfg?.telegramUrl || initialSiteConfig.telegramUrl,
    instagramUrl: cfg?.instagramUrl || initialSiteConfig.instagramUrl,
    whatsappUrl: cfg?.whatsappUrl || initialSiteConfig.whatsappUrl,
    googleMapsUrl: cfg?.googleMapsUrl || initialSiteConfig.googleMapsUrl,
    adminUsername: cfg?.adminUsername || initialSiteConfig.adminUsername,
    adminPasswordHash: cfg?.adminPasswordHash || initialSiteConfig.adminPasswordHash,
    customTimeSlots: (cfg?.customTimeSlots && Array.isArray(cfg.customTimeSlots) && cfg.customTimeSlots.length > 0)
      ? cfg.customTimeSlots
      : initialSiteConfig.customTimeSlots,
    disabledTimeSlots: Array.isArray(cfg?.disabledTimeSlots) ? cfg.disabledTimeSlots : [],
    depositAmount: cfg?.depositAmount || initialSiteConfig.depositAmount,
    adminPhoneNumber: cfg?.adminPhoneNumber || initialSiteConfig.adminPhoneNumber || '09913272265',
    smsApiKey: cfg?.smsApiKey || initialSiteConfig.smsApiKey || '',
    smsSenderNumber: cfg?.smsSenderNumber || initialSiteConfig.smsSenderNumber || '',
    smsConfirmTemplate: cfg?.smsConfirmTemplate || initialSiteConfig.smsConfirmTemplate || '',
    smsReminderTemplate: cfg?.smsReminderTemplate || initialSiteConfig.smsReminderTemplate || '',
  };
};

export default function App() {
  // LocalStorage Persisted State
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(() => {
    const saved = localStorage.getItem('loren_site_config');
    if (saved) {
      try {
        return sanitizeConfig(JSON.parse(saved));
      } catch {
        return initialSiteConfig;
      }
    }
    return initialSiteConfig;
  });

  const [services, setServices] = useState<ServiceItem[]>(() => {
    const saved = localStorage.getItem('loren_services');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return initialServices;
      }
    }
    return initialServices;
  });

  const [contentItems, setContentItems] = useState<ContentItem[]>(() => {
    const saved = localStorage.getItem('loren_content_items');
    return saved ? JSON.parse(saved) : initialContentItems;
  });

  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem('loren_appointments');
    const raw = saved ? JSON.parse(saved) : initialAppointments;
    const { updatedAppointments } = autoArchivePastAppointments(raw);
    return updatedAppointments;
  });

  const [customers, setCustomers] = useState<CustomerMember[]>(() => {
    const saved = localStorage.getItem('loren_customers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return deduplicateCustomers(parsed);
      } catch (_) {}
    }
    return deduplicateCustomers(initialCustomers);
  });

  // UI Interactivity State
  const [selectedServiceForBooking, setSelectedServiceForBooking] = useState<ServiceItem | null>(null);
  const [adminModalOpen, setAdminModalOpen] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      return path.includes('admin') || hash.includes('admin') || search.includes('admin');
    }
    return false;
  });

  // Listen to popstate and hashchange for direct /admin or #admin navigation
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      if (path.includes('admin') || hash.includes('admin') || search.includes('admin')) {
        setAdminModalOpen(true);
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Sync state changes to localStorage
  useEffect(() => {
    localStorage.setItem('loren_site_config', JSON.stringify(siteConfig));
  }, [siteConfig]);

  useEffect(() => {
    localStorage.setItem('loren_services', JSON.stringify(services));
  }, [services]);

  useEffect(() => {
    localStorage.setItem('loren_content_items', JSON.stringify(contentItems));
  }, [contentItems]);

  useEffect(() => {
    localStorage.setItem('loren_appointments', JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem('loren_customers', JSON.stringify(customers));
  }, [customers]);

  // Reference to prevent concurrent overlapping fetches
  const isFetchingRef = React.useRef(false);

  // Helper to fetch data with anti-cache headers, admin session token & fallback between PHP and Express
  const smartFetch = async (
    expressUrl: string,
    phpRoute: string,
    options?: RequestInit
  ): Promise<{ ok: boolean; data?: any; error?: string; status?: number }> => {
    const timestamp = Date.now();
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('loren_admin_token') : null;
    const authHeaders: Record<string, string> = token
      ? {
          'Authorization': `Bearer ${token}`,
          'X-Admin-Token': token,
        }
      : {};

    const commonHeaders: Record<string, string> = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      ...authHeaders,
      ...(options?.headers as Record<string, string> || {})
    };

    const tokenQuery = token ? `&admin_token=${encodeURIComponent(token)}` : '';
    const currentDir = typeof window !== 'undefined'
      ? window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1)
      : '/';

    // Comprehensive URL candidate resolution across Node, cPanel root, subfolders, and relative paths
    const candidates = [
      `${expressUrl}${expressUrl.includes('?') ? '&' : '?'}_t=${timestamp}`,
      `${currentDir}api.php?route=${phpRoute}&_t=${timestamp}${tokenQuery}`,
      `/api.php?route=${phpRoute}&_t=${timestamp}${tokenQuery}`,
      `./api.php?route=${phpRoute}&_t=${timestamp}${tokenQuery}`,
      `api.php?route=${phpRoute}&_t=${timestamp}${tokenQuery}`,
      `${currentDir}public/api.php?route=${phpRoute}&_t=${timestamp}${tokenQuery}`,
      `/public/api.php?route=${phpRoute}&_t=${timestamp}${tokenQuery}`
    ];

    let lastError = 'عدم برقراری ارتباط با سرور';

    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          ...options,
          cache: 'no-store',
          headers: commonHeaders
        });

        let data: any = null;
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json') || contentType.includes('text/json')) {
          try {
            data = await res.json();
          } catch (_) {
            data = null;
          }
        } else {
          try {
            const text = await res.text();
            data = JSON.parse(text);
          } catch (_) {
            data = null;
          }
        }

        if (data !== null) {
          if (res.ok && data?.success !== false) {
            return { ok: true, data, status: res.status };
          } else {
            return {
              ok: false,
              data,
              error: data?.error || data?.message || 'خطا در عملیات سرور',
              status: res.status
            };
          }
        }
      } catch (err: any) {
        lastError = err?.message || lastError;
      }
    }

    return { ok: false, error: lastError };
  };

  // Authoritative Server API Synchronization
  const fetchGlobalData = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await smartFetch('/api/data', 'data');
      if (res.ok && res.data) {
        const data = res.data;
        if (data.siteConfig && Object.keys(data.siteConfig).length > 0) {
          const sanitized = sanitizeConfig(data.siteConfig);
          setSiteConfig((prev) =>
            JSON.stringify(prev) !== JSON.stringify(sanitized) ? sanitized : prev
          );
        }
        if (data.services && data.services.length > 0) {
          setServices((prev) =>
            JSON.stringify(prev) !== JSON.stringify(data.services) ? data.services : prev
          );
        }
        if (data.contentItems) {
          setContentItems((prev) =>
            JSON.stringify(prev) !== JSON.stringify(data.contentItems) ? data.contentItems : prev
          );
        }
        if (data.appointments) {
          const { updatedAppointments } = autoArchivePastAppointments(data.appointments);
          setAppointments((prev) =>
            JSON.stringify(prev) !== JSON.stringify(updatedAppointments) ? updatedAppointments : prev
          );
        }
        if (data.customers && Array.isArray(data.customers)) {
          const deduped = deduplicateCustomers(data.customers);
          setCustomers((prev) =>
            JSON.stringify(prev) !== JSON.stringify(deduped) ? deduped : prev
          );
        }

        // Flush any pending offline bookings to server
        try {
          const pendingStr = localStorage.getItem('loren_pending_bookings');
          if (pendingStr) {
            const pendingQueue = JSON.parse(pendingStr);
            if (Array.isArray(pendingQueue) && pendingQueue.length > 0) {
              const remaining: any[] = [];
              for (const item of pendingQueue) {
                const syncRes = await smartFetch('/api/appointments', 'appointments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(item),
                });
                if (!syncRes.ok && syncRes.status !== 409) {
                  remaining.push(item);
                }
              }
              if (remaining.length !== pendingQueue.length) {
                localStorage.setItem('loren_pending_bookings', JSON.stringify(remaining));
              }
            }
          }
        } catch (_) {}
      }
    } catch (err) {
      console.error('fetchGlobalData error:', err);
    } finally {
      isFetchingRef.current = false;
    }
  };

  // Auto-archive past appointments periodically (e.g. at midnight or date transitions)
  useEffect(() => {
    const checkPastAppointments = () => {
      setAppointments((prev) => {
        const { updatedAppointments, hasChanges } = autoArchivePastAppointments(prev);
        if (hasChanges) {
          localStorage.setItem('loren_appointments', JSON.stringify(updatedAppointments));
          return updatedAppointments;
        }
        return prev;
      });
    };

    checkPastAppointments();
    // Check every 30 seconds for date roll-overs
    const archiveTimer = setInterval(checkPastAppointments, 30000);
    return () => clearInterval(archiveTimer);
  }, []);

  // Immediate sync on mount, tab focus/visibility change, and rapid periodic polling (1500ms < 3s)
  useEffect(() => {
    fetchGlobalData();

    // BroadcastChannel for instant cross-tab real-time sync (0ms latency on same device)
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('loren_realtime_sync');
        channel.onmessage = (event) => {
          if (event.data?.type === 'SYNC_NOW') {
            fetchGlobalData();
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported', e);
    }

    // Storage event listener as fallback for cross-tab sync
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'loren_appointments' || e.key === 'loren_siteConfig' || e.key === 'loren_services') {
        fetchGlobalData();
      }
    };
    window.addEventListener('storage', handleStorage);

    // Fast periodic polling (1.5 seconds) ensuring real-time sync < 3 seconds across devices
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchGlobalData();
      }
    }, 1500);

    // Immediate sync on tab focus or visibility resume
    const handleVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchGlobalData();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      if (channel) channel.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, []);

  // Helper to trigger instant broadcast to other tabs
  const broadcastSync = () => {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('loren_realtime_sync');
        channel.postMessage({ type: 'SYNC_NOW', timestamp: Date.now() });
        channel.close();
      }
    } catch (e) {
      // Ignore
    }
  };

  // Immediate fetch when Admin Modal opens
  useEffect(() => {
    if (adminModalOpen) {
      fetchGlobalData();
    }
  }, [adminModalOpen]);

  // Handlers with API synchronization & synchronous localStorage backup
  const handleSelectServiceFromList = (service: ServiceItem) => {
    setSelectedServiceForBooking(service);
    const bookingElem = document.getElementById('booking');
    if (bookingElem) {
      bookingElem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleBookingComplete = async (newAppointment: Appointment): Promise<{ success: boolean; error?: string }> => {
    // 1. Client-side conflict validation against already loaded active appointments
    const clientConflict = appointments.some((app) => {
      if (app.status === 'canceled' || app.archived || app.status === 'archived') return false;
      const sameDate =
        (app.dateStr && newAppointment.dateStr && app.dateStr === newAppointment.dateStr) ||
        (app.dayName && newAppointment.dayName && app.dayName === newAppointment.dayName);
      const sameSlot = app.timeSlot === newAppointment.timeSlot;
      return sameDate && sameSlot && app.id !== newAppointment.id;
    });

    if (clientConflict) {
      return {
        success: false,
        error: 'این سانس زمانی قبلاً توسط فرد دیگری رزرو شده است. لطفاً سانس دیگری انتخاب کنید.'
      };
    }

    // 2. Attempt server API submission
    let serverSuccess = false;
    try {
      const res = await smartFetch('/api/appointments', 'appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAppointment),
      });

      if (res.ok && res.data) {
        serverSuccess = true;
        const serverAppointments = res.data.appointments;
        const updated = Array.isArray(serverAppointments)
          ? serverAppointments
          : [newAppointment, ...appointments.filter((a) => a.id !== newAppointment.id)];
        setAppointments(updated);
        localStorage.setItem('loren_appointments', JSON.stringify(updated));
      } else if (res.status === 409) {
        // Authoritative server conflict detected (e.g. concurrent booking from another device)
        await fetchGlobalData();
        return {
          success: false,
          error: res.error || 'این سانس زمانی قبلاً رزرو شده است. لطفاً سانس دیگری انتخاب کنید.'
        };
      } else if (res.data?.error) {
        // Explicit server business validation error
        return {
          success: false,
          error: res.data.error
        };
      }
    } catch (err) {
      console.warn('Backend sync warning, activating durable client persistence:', err);
    }

    // 3. Resilient Fallback: If server is temporarily unreachable (e.g. api.php not uploaded yet or network issue):
    // NEVER show "عدم برقراری ارتباط با سرور" to the customer!
    // Save booking locally, queue for background sync, and show tracking code / receipt screen immediately.
    if (!serverSuccess) {
      const updated = [newAppointment, ...appointments.filter((a) => a.id !== newAppointment.id)];
      setAppointments(updated);
      localStorage.setItem('loren_appointments', JSON.stringify(updated));

      try {
        const queue = JSON.parse(localStorage.getItem('loren_pending_bookings') || '[]');
        if (!queue.some((item: any) => item.id === newAppointment.id)) {
          queue.push(newAppointment);
          localStorage.setItem('loren_pending_bookings', JSON.stringify(queue));
        }
      } catch (_) {}
    }

    // Update customer club record locally
    const clientPhone = normalizePhoneNumber(newAppointment.phone || '');
    if (clientPhone) {
      setCustomers((prev) => {
        const list = Array.isArray(prev) ? [...prev] : [];
        const idx = list.findIndex((c) => normalizePhoneNumber(c.phone) === clientPhone);
        const bookingDate = newAppointment.dayName || newAppointment.dateStr || 'ثبت شده';
        if (idx >= 0) {
          list[idx] = {
            ...list[idx],
            totalBookings: (list[idx].totalBookings || 1) + 1,
            lastBookingDate: bookingDate,
            lastServiceName: newAppointment.serviceName || list[idx].lastServiceName,
            name: newAppointment.clientName || list[idx].name,
          };
        } else {
          list.unshift({
            id: 'cust-' + (clientPhone || Date.now()),
            name: newAppointment.clientName || 'مشتری',
            phone: clientPhone,
            totalBookings: 1,
            firstBookingDate: bookingDate,
            lastBookingDate: bookingDate,
            lastServiceName: newAppointment.serviceName || 'اصلاح سر',
            notes: '',
            createdAt: new Date().toLocaleDateString('fa-IR')
          });
        }
        localStorage.setItem('loren_customers', JSON.stringify(list));
        return list;
      });
    }

    broadcastSync();
    fetchGlobalData().catch(() => {});

    return { success: true };
  };

  const handleUpdateAppointmentStatus = async (id: string, status: 'confirmed' | 'canceled' | 'pending') => {
    const updated = appointments.map((app) => (app.id === id ? { ...app, status } : app));
    setAppointments(updated);
    localStorage.setItem('loren_appointments', JSON.stringify(updated));
    broadcastSync();

    await smartFetch(`/api/appointments/${id}`, `update_appointment&id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await fetchGlobalData();
  };

  const handleDeleteAppointment = async (id: string) => {
    const nowStr = new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const updated = appointments.map((app) => (app.id === id ? { ...app, archived: true, archivedAt: nowStr } : app));
    setAppointments(updated);
    localStorage.setItem('loren_appointments', JSON.stringify(updated));

    await smartFetch(`/api/appointments/${id}`, `delete_appointment&id=${id}`, {
      method: 'DELETE',
    });
    await fetchGlobalData();
  };

  const handleRestoreAppointment = async (id: string) => {
    const updated = appointments.map((app) => (app.id === id ? { ...app, archived: false } : app));
    setAppointments(updated);
    localStorage.setItem('loren_appointments', JSON.stringify(updated));

    await smartFetch(`/api/appointments/${id}`, `update_appointment&id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: false }),
    });
    await fetchGlobalData();
  };

  const handlePermanentDeleteAppointment = async (id: string) => {
    const updated = appointments.filter((app) => app.id !== id);
    setAppointments(updated);
    localStorage.setItem('loren_appointments', JSON.stringify(updated));

    await smartFetch(`/api/appointments/${id}/permanent`, `permanent_delete_appointment&id=${id}`, {
      method: 'DELETE',
    });
    await fetchGlobalData();
  };

  const handlePermanentDeleteAllArchived = async () => {
    const updated = appointments.filter((app) => !app.archived);
    setAppointments(updated);
    localStorage.setItem('loren_appointments', JSON.stringify(updated));

    await smartFetch('/api/appointments/archived/permanent', 'permanent_delete_all_archived', {
      method: 'DELETE',
    });
    await fetchGlobalData();
  };

  const handleUpdateSiteConfig = async (newConfig: SiteConfig) => {
    setSiteConfig(newConfig);
    localStorage.setItem('loren_site_config', JSON.stringify(newConfig));

    await smartFetch('/api/site-config', 'save_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteConfig: newConfig }),
    });
    await fetchGlobalData();
  };

  const handleUpdateServices = async (newServices: ServiceItem[]) => {
    setServices(newServices);
    localStorage.setItem('loren_services', JSON.stringify(newServices));

    await smartFetch('/api/services', 'save_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ services: newServices }),
    });
    await fetchGlobalData();
  };

  const handleSaveAllSettings = async (newConfig: SiteConfig, newServices: ServiceItem[]) => {
    setSiteConfig(newConfig);
    setServices(newServices);
    localStorage.setItem('loren_site_config', JSON.stringify(newConfig));
    localStorage.setItem('loren_services', JSON.stringify(newServices));

    await smartFetch('/api/admin/save-settings', 'save_settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteConfig: newConfig, services: newServices }),
    });
    await fetchGlobalData();
  };

  const handleAddContentItem = async (newItem: ContentItem) => {
    const updated = [newItem, ...contentItems];
    setContentItems(updated);
    localStorage.setItem('loren_content_items', JSON.stringify(updated));

    await smartFetch('/api/content-items', 'add_content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    await fetchGlobalData();
  };

  const handleDeleteContentItem = async (id: string) => {
    const updated = contentItems.filter((item) => item.id !== id);
    setContentItems(updated);
    localStorage.setItem('loren_content_items', JSON.stringify(updated));

    await smartFetch(`/api/content-items/${id}`, `delete_content&id=${id}`, {
      method: 'DELETE',
    });
    await fetchGlobalData();
  };

  const handleSaveCustomer = async (customer: CustomerMember): Promise<{ success: boolean; error?: string }> => {
    const res = await smartFetch('/api/customers', 'save_customer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer),
    });

    if (res.ok && res.data?.customers && Array.isArray(res.data.customers)) {
      const deduped = deduplicateCustomers(res.data.customers);
      setCustomers(deduped);
      localStorage.setItem('loren_customers', JSON.stringify(deduped));
      return { success: true };
    } else {
      // Fallback local update with strict deduplication
      const updated = deduplicateCustomers([customer, ...customers]);
      setCustomers(updated);
      localStorage.setItem('loren_customers', JSON.stringify(updated));
      await fetchGlobalData();
      return { success: true };
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    const targetCustomer = customers.find((c) => c.id === id);
    const targetPhone = targetCustomer?.phone || '';
    const normTargetPhone = normalizePhoneNumber(targetPhone);

    const updated = customers.filter((c) => {
      if (c.id === id) return false;
      if (normTargetPhone && normalizePhoneNumber(c.phone) === normTargetPhone) return false;
      return true;
    });
    setCustomers(updated);
    localStorage.setItem('loren_customers', JSON.stringify(updated));

    await smartFetch(`/api/customers/${encodeURIComponent(id)}?phone=${encodeURIComponent(targetPhone)}`, `delete_customer&id=${encodeURIComponent(id)}&phone=${encodeURIComponent(targetPhone)}`, {
      method: 'DELETE',
    });
    await fetchGlobalData();
  };

  const scrollToBooking = () => {
    const elem = document.getElementById('booking');
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f2eb] text-[#1a1a1a] selection:bg-[#c5a059] selection:text-[#ffffff] w-full max-w-full overflow-x-hidden">
      
      {/* Header */}
      <Header
        onOpenBooking={scrollToBooking}
        onOpenAdmin={() => setAdminModalOpen(true)}
        telegramUrl={siteConfig.telegramUrl}
        instagramUrl={siteConfig.instagramUrl}
        whatsappUrl={siteConfig.whatsappUrl}
        googleMapsUrl={siteConfig.googleMapsUrl}
      />

      {/* Main Content Area */}
      <main className="flex-1 space-y-8">
        
        {/* Hero Section */}
        <HeroSection
          onOpenBooking={scrollToBooking}
          telegramUsername={siteConfig.telegramUsername}
          telegramUrl={siteConfig.telegramUrl}
          whatsappUrl={siteConfig.whatsappUrl}
          customTimeSlots={siteConfig.customTimeSlots}
        />

        {/* Booking Form Section */}
        <BookingSection
          services={services}
          appointments={appointments}
          preSelectedService={selectedServiceForBooking}
          onBookingComplete={handleBookingComplete}
          cardNumber={siteConfig.cardNumber}
          cardHolder={siteConfig.cardHolder}
          bankName={siteConfig.bankName}
          telegramUsername={siteConfig.telegramUsername}
          telegramUrl={siteConfig.telegramUrl}
          customTimeSlots={siteConfig.customTimeSlots}
          disabledTimeSlots={siteConfig.disabledTimeSlots}
          depositAmount={siteConfig.depositAmount}
        />

        {/* Special Services Grid (Positioned Below Booking & Bank Card Section) */}
        <SpecialServicesGrid whatsappUrl={siteConfig.whatsappUrl} />

      </main>

      {/* Footer */}
      <Footer
        onOpenAdmin={() => setAdminModalOpen(true)}
        telegramUrl={siteConfig.telegramUrl}
        instagramUrl={siteConfig.instagramUrl}
        whatsappUrl={siteConfig.whatsappUrl}
        googleMapsUrl={siteConfig.googleMapsUrl}
      />

      {/* Admin Panel Modal */}
      <AdminModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        smartFetch={smartFetch}
        onRefreshData={fetchGlobalData}
        siteConfig={siteConfig}
        onUpdateSiteConfig={handleUpdateSiteConfig}
        services={services}
        onUpdateServices={handleUpdateServices}
        onSaveAllSettings={handleSaveAllSettings}
        appointments={appointments}
        onUpdateAppointmentStatus={handleUpdateAppointmentStatus}
        onDeleteAppointment={handleDeleteAppointment}
        onRestoreAppointment={handleRestoreAppointment}
        onPermanentDeleteAppointment={handlePermanentDeleteAppointment}
        onPermanentDeleteAllArchived={handlePermanentDeleteAllArchived}
        customers={customers}
        onSaveCustomer={handleSaveCustomer}
        onDeleteCustomer={handleDeleteCustomer}
        contentItems={contentItems}
        onAddContentItem={handleAddContentItem}
        onDeleteContentItem={handleDeleteContentItem}
      />

    </div>
  );
}
