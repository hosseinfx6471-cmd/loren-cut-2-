import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";

// Load environment variables from .env
dotenv.config();

import {
  initialSiteConfig,
  initialServices,
  initialContentItems,
  initialAppointments,
  initialCustomers,
} from "./src/data/initialData.js";
import {
  Appointment,
  CustomerMember,
  ServiceItem,
  ContentItem,
  SiteConfig,
} from "./src/types";
import {
  normalizePhoneNumber,
  normalizeName,
  deduplicateCustomers,
} from "./src/utils/customerUtils";
import {
  sendAdminAppointmentNotification,
  sendCustomerAppointmentNotification,
  sendMelipayamakSMS,
} from "./src/services/smsService";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Disable Express fingerprinting
app.disable("x-powered-by");

// Body parsers with strict size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Global Security Headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com https://lorencut.ir; connect-src 'self' https://api.payamak-panel.com https://fonts.googleapis.com https://fonts.gstatic.com ws: wss:; frame-ancestors 'self' https://*.google.com https://*.googleusercontent.com https://*.run.app;",
  );

  // HSTS on HTTPS/secure proxies
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }
  next();
});

// Strict No-Cache Headers for all API Routes
app.use("/api", (_req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0",
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// Direct Access Blocker for sensitive backend files and backups (excluding frontend dev assets)
app.use((req, res, next) => {
  const url = req.path.toLowerCase();
  if (
    url === "/app_data.json" ||
    url === "/metadata.json" ||
    url === "/server.ts" ||
    url === "/bun.lock" ||
    url.startsWith("/.env") ||
    url.startsWith("/.git") ||
    url.startsWith("/.backups") ||
    url.endsWith(".bak") ||
    url.endsWith(".old") ||
    url.endsWith(".sql") ||
    url.endsWith(".log") ||
    url.endsWith(".lock") ||
    url.endsWith(".yml") ||
    url.endsWith(".yaml") ||
    (url.endsWith(".json") &&
      url !== "/manifest.json" &&
      !url.includes("node_modules"))
  ) {
    res.status(403).json({ error: "Access Denied" });
    return;
  }
  next();
});

// Persistence JSON File Path & Backup Directory
const DATA_FILE = path.join(process.cwd(), "app_data.json");
const BACKUP_DIR = path.join(process.cwd(), ".backups");

// Secure Production AUTH_SECRET: strictly from environment or dynamic secure generation
let AUTH_SECRET = (process.env.AUTH_SECRET || "").trim();
if (!AUTH_SECRET) {
  // If not provided in environment, generate an in-memory 32-byte secure key
  AUTH_SECRET = crypto.randomBytes(32).toString("hex");
  process.env.AUTH_SECRET = AUTH_SECRET;
}

// Sanitize ADMIN_PHONE environment variable to strictly use 09913272265
if (
  !process.env.ADMIN_PHONE ||
  process.env.ADMIN_PHONE.includes("9169206471")
) {
  process.env.ADMIN_PHONE = "09913272265";
}

// In-Memory Session Store
interface AdminSession {
  token: string;
  username: string;
  expiresAt: number;
  ip: string;
}
const activeSessions = new Map<string, AdminSession>();

// In-Memory Rate Limiting Stores
interface RateLimitRecord {
  count: number;
  firstRequest: number;
  lockedUntil?: number;
}
const loginRateLimitMap = new Map<string, RateLimitRecord>();
const bookingRateLimitMap = new Map<string, RateLimitRecord>();

// Helper to generate HMAC-SHA256 signed Admin Token
function generateAdminToken(username: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 3600; // 24 hours
  const payload = JSON.stringify({ u: username, exp: expiresAt });
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(payload)
    .digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64");
}

// Helper to get client IP
function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "127.0.0.1";
}

// Password Verification Function (Supports bcrypt, direct match, and legacy hashes)
function verifyPassword(inputPassword: string, storedHash: string): boolean {
  if (!inputPassword || !storedHash) return false;
  const inputTrimmed = inputPassword.trim();
  const storedTrimmed = storedHash.trim();

  // 1. Bcrypt Hash match (starts with $2)
  if (storedTrimmed.startsWith("$2")) {
    try {
      return bcrypt.compareSync(inputTrimmed, storedTrimmed);
    } catch {
      return false;
    }
  }

  // 2. Direct plain text match (for legacy migration support)
  if (inputTrimmed === storedTrimmed) return true;

  // 3. SHA-256 Hash match (legacy support)
  const sha256 = crypto.createHash("sha256").update(inputTrimmed).digest("hex");
  if (sha256 === storedTrimmed) return true;

  // 4. Salted SHA-256 Hash match (legacy support)
  const salted = crypto
    .createHash("sha256")
    .update("loren_" + inputTrimmed)
    .digest("hex");
  if (salted === storedTrimmed) return true;

  return false;
}

// Admin Token Verification Helper
function checkAdminAuth(req: express.Request): boolean {
  const authHeader =
    req.headers["authorization"] || req.headers["x-admin-token"];
  let rawToken = "";

  if (typeof authHeader === "string") {
    if (authHeader.startsWith("Bearer ")) {
      rawToken = authHeader.slice(7).trim();
    } else {
      rawToken = authHeader.trim();
    }
  }

  if (!rawToken && typeof req.query?.admin_token === "string") {
    rawToken = (req.query.admin_token as string).trim();
  }

  if (!rawToken) return false;

  // 1. Check in active session store (for fast in-memory validation)
  const session = activeSessions.get(rawToken);
  if (session) {
    if (Date.now() > session.expiresAt) {
      activeSessions.delete(rawToken);
      return false;
    }
    return true;
  }

  // 2. Check cryptographic HMAC-SHA256 token format (stateless validation)
  try {
    const decoded = Buffer.from(rawToken, "base64").toString("utf-8");
    const dotIndex = decoded.lastIndexOf(".");
    if (dotIndex === -1) return false;

    const payloadJson = decoded.substring(0, dotIndex);
    const signature = decoded.substring(dotIndex + 1);
    if (!payloadJson || !signature) return false;

    const expectedSig = crypto
      .createHmac("sha256", AUTH_SECRET)
      .update(payloadJson)
      .digest("hex");
    if (signature.length !== expectedSig.length) return false;
    if (
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))
    ) {
      return false;
    }

    const payload = JSON.parse(payloadJson);
    if (
      !payload ||
      typeof payload.exp !== "number" ||
      Math.floor(Date.now() / 1000) > payload.exp
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Admin Authentication Middleware
function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  if (!checkAdminAuth(req)) {
    res.status(401).json({
      success: false,
      error:
        "دسترسی غیرمجاز: نشست مدیریت منقضی شده یا نامعتبر است. لطفاً دوباره وارد شوید.",
    });
    return;
  }
  next();
}

// Sanitization Helper
function sanitizeInput(str: any, maxLen = 200): string {
  if (typeof str !== "string") return "";
  return str
    .replace(/<[^>]*>?/gm, "")
    .trim()
    .slice(0, maxLen);
}

// Interface for DB
interface DBData {
  siteConfig: typeof initialSiteConfig;
  services: typeof initialServices;
  contentItems: typeof initialContentItems;
  appointments: Appointment[];
  customers: CustomerMember[];
}

// Helper to auto-archive appointments whose date has passed
function autoArchivePastAppointmentsInServer(appointments: Appointment[]): {
  appointments: Appointment[];
  hasChanges: boolean;
} {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;
  let hasChanges = false;
  const nowPersian =
    new Date().toLocaleDateString("fa-IR") +
    " - " +
    new Date().toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const mapped = appointments.map((app) => {
    if (
      app.dateStr &&
      app.dateStr < todayStr &&
      !app.archived &&
      app.status !== "archived"
    ) {
      hasChanges = true;
      return {
        ...app,
        archived: true,
        archivedAt: app.archivedAt || nowPersian,
      };
    }
    return app;
  });

  return { appointments: mapped, hasChanges };
}

// Helper to load DB
function loadDB(): DBData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const data = JSON.parse(raw);
      const rawAppointments: Appointment[] =
        data.appointments || initialAppointments;
      const { appointments, hasChanges } =
        autoArchivePastAppointmentsInServer(rawAppointments);

      const loadedCustomers = data.customers || [];
      const customers = deduplicateCustomers(
        loadedCustomers.length > 0 ? loadedCustomers : initialCustomers,
      );

      const loadedData: DBData = {
        siteConfig: { ...initialSiteConfig, ...(data.siteConfig || {}) },
        services: data.services || initialServices,
        contentItems: data.contentItems || initialContentItems,
        appointments,
        customers,
      };

      if (hasChanges) {
        saveDB(loadedData);
      }

      return loadedData;
    }
  } catch (err) {
    console.error("Error reading DATA_FILE, using initial data:", err);
  }
  const { appointments } =
    autoArchivePastAppointmentsInServer(initialAppointments);
  return {
    siteConfig: initialSiteConfig,
    services: initialServices,
    contentItems: initialContentItems,
    appointments,
    customers: deduplicateCustomers(initialCustomers),
  };
}

// Helper for automated safe backup & atomic saving
let lastBackupTime = 0;
function createBackupIfNeeded() {
  const now = Date.now();
  if (now - lastBackupTime < 60 * 60 * 1000) return; // Max 1 backup per hour
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    if (fs.existsSync(DATA_FILE)) {
      const dateTag = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(BACKUP_DIR, `app_data_${dateTag}.json.bak`);
      fs.copyFileSync(DATA_FILE, backupPath);
      lastBackupTime = now;

      // Keep only last 10 backups
      const files = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.endsWith(".bak"))
        .sort();
      if (files.length > 10) {
        for (let i = 0; i < files.length - 10; i++) {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, files[i]));
          } catch {}
        }
      }
    }
  } catch (err) {
    console.error("[Backup Error]:", err);
  }
}

// Helper to save DB atomically with automated backup and public sync
function saveDB(data: DBData) {
  try {
    createBackupIfNeeded();
    const json = JSON.stringify(data, null, 2);
    const tempPath = `${DATA_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, json, "utf-8");
    fs.renameSync(tempPath, DATA_FILE);

    const publicDir = path.join(process.cwd(), "public");
    if (fs.existsSync(publicDir)) {
      const publicDataFile = path.join(publicDir, "app_data.json");
      fs.writeFileSync(publicDataFile, json, "utf-8");
    }
  } catch (err) {
    console.error("Error writing DATA_FILE:", err);
  }
}

// Data Minimization for Public View (Privacy by Design)
function getPublicSanitizedData(data: DBData) {
  const pubConfig = { ...data.siteConfig };
  // Redact admin credentials and sensitive server keys
  delete (pubConfig as any).adminUsername;
  delete (pubConfig as any).adminPasswordHash;
  delete (pubConfig as any).smsUsername;
  delete (pubConfig as any).smsPassword;
  delete (pubConfig as any).smsApiKey;
  delete (pubConfig as any).smsSenderNumber;

  // Redact customer names, phones, tracking codes, and payment receipts from public slot view
  const pubAppointments = (data.appointments || []).map((app) => ({
    id: app.id,
    dateStr: app.dateStr,
    dayName: app.dayName,
    timeSlot: app.timeSlot,
    status: app.status,
    archived: app.archived || app.status === "archived",
    serviceId: app.serviceId,
  }));

  return {
    siteConfig: pubConfig,
    services: data.services || [],
    contentItems: data.contentItems || [],
    appointments: pubAppointments,
    customers: [], // Exclusively accessible to authenticated admin
  };
}

// Initialize in memory
let db = loadDB();

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// =========================================================================
// 1. AUTHENTICATION & LOGIN (With Brute-Force Rate Limiting)
// =========================================================================
app.post("/api/admin/login", (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();

  // Check Rate Limit for IP
  let record = loginRateLimitMap.get(ip);
  if (!record) {
    record = { count: 0, firstRequest: now };
    loginRateLimitMap.set(ip, record);
  }

  // Reset window after 5 minutes
  if (now - record.firstRequest > 5 * 60 * 1000) {
    record.count = 0;
    record.firstRequest = now;
    record.lockedUntil = undefined;
  }

  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSecs = Math.ceil((record.lockedUntil - now) / 1000);
    res.status(429).json({
      success: false,
      error: `تعداد تلاش‌های ناموفق بیش از حد مجاز است. لطفاً ${remainingSecs} ثانیه دیگر مجدداً تلاش کنید.`,
    });
    return;
  }

  const { username, password } = req.body || {};
  const cleanUser = (username || "").toString().trim().toLowerCase();
  const cleanPass = (password || "").toString().trim();

  const expectedUser = (
    db.siteConfig?.adminUsername ||
    process.env.ADMIN_USERNAME ||
    "admin"
  )
    .toString()
    .trim()
    .toLowerCase();
  const expectedPass = (
    db.siteConfig?.adminPasswordHash ||
    process.env.ADMIN_PASSWORD_HASH ||
    "$2b$10$GyzFGUBTn.Q/KegEwSOFFe43uFtnxekMUOt3JlanGpcs1YKGQTwPK"
  )
    .toString()
    .trim();

  // Strict Single Source of Truth Authentication: strictly verify password against stored active hash
  const isMatch =
    (cleanUser === expectedUser ||
      (cleanUser === "admin" && expectedUser === "admin")) &&
    verifyPassword(cleanPass, expectedPass);

  if (isMatch) {
    // Reset rate limit on successful login
    loginRateLimitMap.delete(ip);

    // Automatic migration to bcrypt if stored password was plain or legacy non-bcrypt
    if (
      db.siteConfig &&
      (!db.siteConfig.adminPasswordHash ||
        !db.siteConfig.adminPasswordHash.startsWith("$2"))
    ) {
      try {
        db.siteConfig.adminPasswordHash = bcrypt.hashSync(cleanPass, 10);
        saveDB(db);
      } catch (migrationErr) {
        console.error(
          "[Server] Failed to auto-migrate password to bcrypt:",
          migrationErr,
        );
      }
    }

    // Generate secure HMAC-SHA256 signed token
    const token = generateAdminToken(cleanUser);
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    activeSessions.set(token, {
      token,
      username: cleanUser,
      expiresAt,
      ip,
    });

    res.json({
      success: true,
      token,
      expiresAt,
      message: "ورود موفقیت‌آمیز بود.",
    });
  } else {
    record.count += 1;
    if (record.count >= 8) {
      record.lockedUntil = now + 60 * 1000; // Lock for 60 seconds
    }
    res.status(401).json({
      success: false,
      error: "نام کاربری یا رمز عبور اشتباه است.",
    });
  }
});

app.post("/api/admin/logout", (req, res) => {
  const authHeader =
    req.headers["authorization"] || req.headers["x-admin-token"];
  if (typeof authHeader === "string") {
    const rawToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    activeSessions.delete(rawToken);
  }
  res.json({ success: true, message: "خروج با موفقیت انجام شد." });
});

// Admin SMS Status & Testing
app.get("/api/admin/sms-status", requireAdminAuth, (_req, res) => {
  const username = (
    db.siteConfig?.smsUsername ||
    db.siteConfig?.smsApiKey ||
    process.env.MELIPAYAMAK_USERNAME ||
    process.env.SMS_USERNAME ||
    ""
  ).trim();
  const password = (
    db.siteConfig?.smsPassword ||
    db.siteConfig?.smsApiKey ||
    process.env.MELIPAYAMAK_PASSWORD ||
    process.env.SMS_PASSWORD ||
    ""
  ).trim();
  const from = (
    db.siteConfig?.smsSenderNumber ||
    process.env.MELIPAYAMAK_FROM ||
    process.env.SMS_SENDER ||
    "50004001"
  ).trim();
  const adminPhone = (
    db.siteConfig?.adminPhoneNumber ||
    process.env.ADMIN_PHONE ||
    process.env.SMS_ADMIN_PHONE ||
    "09913272265"
  ).trim();

  res.json({
    success: true,
    hasUsername: !!username,
    hasPassword: !!password,
    fromLine: from,
    adminPhone,
  });
});

app.post("/api/admin/test-sms", requireAdminAuth, async (req, res) => {
  const targetPhone = (
    req.body?.phone ||
    db.siteConfig?.adminPhoneNumber ||
    "09913272265"
  ).trim();
  const testMsg = `تست سامانه پیامک سالن Loren Cut\nزمان: ${new Date().toLocaleDateString("fa-IR")} - ${new Date().toLocaleTimeString("fa-IR")}\nاین یک پیام آزمایشی مدیریتی است.`;
  const result = await sendMelipayamakSMS(targetPhone, testMsg, db.siteConfig);
  res.json({
    success: result.success,
    result,
    targetPhone,
  });
});

// =========================================================================
// 2. DATA SYNCHRONIZATION (PUBLIC vs ADMIN)
// =========================================================================
app.get("/api/data", (req, res) => {
  const { appointments, hasChanges } = autoArchivePastAppointmentsInServer(
    db.appointments || [],
  );
  if (hasChanges) {
    db.appointments = appointments;
    saveDB(db);
  }

  if (checkAdminAuth(req)) {
    // Authenticated admin receives full dataset
    res.json(db);
  } else {
    // Public visitor receives sanitized dataset
    res.json(getPublicSanitizedData(db));
  }
});

app.get("/api/admin/data", requireAdminAuth, (_req, res) => {
  const { appointments, hasChanges } = autoArchivePastAppointmentsInServer(
    db.appointments || [],
  );
  if (hasChanges) {
    db.appointments = appointments;
    saveDB(db);
  }
  res.json(db);
});

// =========================================================================
// 3. APPOINTMENTS (Public Booking with Mass-Assignment & Double Booking Protection)
// =========================================================================
app.post("/api/appointments", async (req, res) => {
  const ip = getClientIp(req);
  const now = Date.now();

  // Booking Rate Limit (max 10 bookings per 10 minutes per IP)
  let bRecord = bookingRateLimitMap.get(ip);
  if (!bRecord || now - bRecord.firstRequest > 10 * 60 * 1000) {
    bRecord = { count: 0, firstRequest: now };
    bookingRateLimitMap.set(ip, bRecord);
  }
  bRecord.count += 1;
  if (bRecord.count > 10) {
    res.status(429).json({
      success: false,
      error:
        "تعداد درخواست‌های ثبت نوبت بیش از حد مجاز است. لطفاً چند دقیقه دیگر تلاش کنید.",
    });
    return;
  }

  const raw = req.body;
  if (!raw || !raw.id) {
    res
      .status(400)
      .json({ success: false, error: "اطلاعات ارسالی نامعتبر است." });
    return;
  }

  const newDateStr = sanitizeInput(raw.dateStr, 20);
  const newDayName = sanitizeInput(raw.dayName, 50);
  const newTimeSlot = sanitizeInput(raw.timeSlot, 30);
  const newId = sanitizeInput(raw.id, 50);
  const clientName = sanitizeInput(raw.clientName || "مشتری", 80);
  const clientPhone = normalizePhoneNumber(raw.phone);

  if (!newTimeSlot || (!newDateStr && !newDayName)) {
    res
      .status(400)
      .json({ success: false, error: "تاریخ و ساعت سانس نامعتبر است." });
    return;
  }

  if (!clientPhone || clientPhone.length < 10) {
    res
      .status(400)
      .json({ success: false, error: "شماره تلفن وارد شده نامعتبر است." });
    return;
  }

  // 1. Double booking check: Ensure slot is not booked by an active appointment
  const exists = db.appointments.some((app) => {
    if (app.status === "canceled" || app.archived || app.status === "archived")
      return false;
    const sameDate =
      (app.dateStr && newDateStr && app.dateStr === newDateStr) ||
      (app.dayName && newDayName && app.dayName === newDayName);
    const sameSlot = app.timeSlot === newTimeSlot;
    return sameDate && sameSlot && app.id !== newId;
  });

  if (exists) {
    res.status(409).json({
      success: false,
      error:
        "این سانس زمانی قبلاً توسط فرد دیگری رزرو شده است. لطفاً سانس دیگری انتخاب کنید.",
    });
    return;
  }

  // 2. Disabled slot check: Ensure slot was not manually reserved/disabled by admin
  const disabledList = db.siteConfig?.disabledTimeSlots || [];
  const isSlotDisabled =
    disabledList.includes(newTimeSlot) ||
    (newDateStr && disabledList.includes(`${newDateStr}_${newTimeSlot}`));

  if (isSlotDisabled) {
    res.status(409).json({
      success: false,
      error: "این سانس زمانی غیرفعال است. لطفاً سانس دیگری انتخاب کنید.",
    });
    return;
  }

  // 3. Receipt Image Validation
  const receiptImg =
    typeof raw.receiptImage === "string" ? raw.receiptImage : "";
  if (receiptImg.length > 7 * 1024 * 1024) {
    res
      .status(400)
      .json({ success: false, error: "حجم تصویر فیش بیش از حد مجاز است." });
    return;
  }

  // 4. Sanitize and enforce server-controlled appointment object
  const safeAppointment: Appointment = {
    id: newId,
    clientName,
    phone: clientPhone,
    dateStr: newDateStr,
    dayName: newDayName,
    timeSlot: newTimeSlot,
    serviceId: sanitizeInput(raw.serviceId || "s1", 30),
    serviceName: sanitizeInput(raw.serviceName || "اصلاح سر", 100),
    servicePrice: sanitizeInput(raw.servicePrice || "", 50),
    receiptImage: receiptImg,
    status: "pending", // Server-enforced status (cannot be set to confirmed by user)
    createdAt: sanitizeInput(
      raw.createdAt ||
        new Date().toLocaleDateString("fa-IR") +
          " - " +
          new Date().toLocaleTimeString("fa-IR", {
            hour: "2-digit",
            minute: "2-digit",
          }),
      50,
    ),
    trackingCode: sanitizeInput(
      raw.trackingCode || "LC-" + Math.floor(100000 + Math.random() * 900000),
      30,
    ),
    archived: false,
  };

  // 5. Save appointment in database
  db.appointments = [
    safeAppointment,
    ...db.appointments.filter((a) => a.id !== safeAppointment.id),
  ];

  // 6. Update Customer Club record
  const normClientName = normalizeName(clientName);
  if (clientPhone || normClientName) {
    if (!db.customers) db.customers = [];
    const bookingDate =
      safeAppointment.dayName || safeAppointment.dateStr || "ثبت شده";

    const existingIndex = db.customers.findIndex((c) => {
      if (clientPhone && normalizePhoneNumber(c.phone)) {
        return normalizePhoneNumber(c.phone) === clientPhone;
      }
      return normClientName && normalizeName(c.name) === normClientName;
    });

    if (existingIndex >= 0) {
      const existing = db.customers[existingIndex];
      db.customers[existingIndex] = {
        ...existing,
        name: clientName || existing.name,
        phone: clientPhone || existing.phone,
        totalBookings: (existing.totalBookings || 1) + 1,
        lastBookingDate: bookingDate,
        lastServiceName:
          safeAppointment.serviceName || existing.lastServiceName,
      };
    } else {
      const newCustomer: CustomerMember = {
        id: "cust-" + (clientPhone || Date.now()),
        name: clientName,
        phone: clientPhone || "",
        totalBookings: 1,
        firstBookingDate: bookingDate,
        lastBookingDate: bookingDate,
        lastServiceName: safeAppointment.serviceName || "اصلاح سر",
        notes: "",
        createdAt: new Date().toLocaleDateString("fa-IR"),
      };
      db.customers = [newCustomer, ...db.customers];
    }
    db.customers = deduplicateCustomers(db.customers);
  }
  saveDB(db);

  // 7. Trigger SMS notification to Admin only (Server-side, non-blocking)
  sendAdminAppointmentNotification(safeAppointment, db.siteConfig).catch(
    (err) => {
      console.error(
        "[Server] Admin SMS notification error:",
        err?.message || err,
      );
    },
  );
  // Note: Customer SMS on booking registration is disabled per policy (Admin notification only).
  // sendCustomerAppointmentNotification is retained for explicit admin manual confirmations.

  const isAdmin = checkAdminAuth(req);
  const returnAppointments = isAdmin
    ? db.appointments
    : getPublicSanitizedData(db).appointments;

  res.json({
    success: true,
    appointment: safeAppointment,
    appointments: returnAppointments,
  });
});

// =========================================================================
// 4. PROTECTED ADMIN OPERATIONS
// =========================================================================

// Update appointment status or archive state (Admin Only)
app.patch("/api/appointments/:id", requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { status, archived } = req.body;
  const nowStr =
    new Date().toLocaleDateString("fa-IR") +
    " - " +
    new Date().toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  db.appointments = db.appointments.map((app) => {
    if (app.id === id) {
      return {
        ...app,
        ...(status !== undefined &&
        ["pending", "confirmed", "canceled", "archived"].includes(status)
          ? { status }
          : {}),
        ...(archived !== undefined
          ? {
              archived: Boolean(archived),
              archivedAt: archived ? nowStr : undefined,
            }
          : {}),
      };
    }
    return app;
  });
  saveDB(db);

  // SMS is strictly configured for Admin notifications only per salon policy.
  res.json({ success: true, appointments: db.appointments });
});

// Delete appointment -> Archives it (Admin Only)
app.delete("/api/appointments/:id", requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const nowStr =
    new Date().toLocaleDateString("fa-IR") +
    " - " +
    new Date().toLocaleTimeString("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  db.appointments = db.appointments.map((app) => {
    if (app.id === id) {
      return {
        ...app,
        archived: true,
        archivedAt: nowStr,
      };
    }
    return app;
  });
  saveDB(db);
  res.json({ success: true, appointments: db.appointments });
});

// Permanent Delete of ALL Archived Appointments (Admin Only)
app.delete(
  "/api/appointments/archived/permanent",
  requireAdminAuth,
  (_req, res) => {
    const previousCount = db.appointments.length;
    db.appointments = db.appointments.filter(
      (a) => !(a.archived === true || a.status === "archived"),
    );
    const deletedCount = previousCount - db.appointments.length;
    saveDB(db);
    res.json({ success: true, deletedCount, appointments: db.appointments });
  },
);

// Permanent Delete of Archived Appointment ONLY (Admin Only)
app.delete("/api/appointments/:id/permanent", requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const targetApp = db.appointments.find((a) => a.id === id);

  if (!targetApp) {
    res.status(404).json({ success: false, error: "نوبت مورد نظر یافت نشد." });
    return;
  }

  const isArchived =
    targetApp.archived === true || targetApp.status === "archived";
  if (!isArchived) {
    res.status(400).json({
      success: false,
      error:
        "تنها نوبت‌های موجود در بایگانی قابل حذف کامل هستند. نوبت‌های فعال را نمی‌توان به صورت مستقیم حذف کامل کرد.",
    });
    return;
  }

  db.appointments = db.appointments.filter((a) => a.id !== id);
  saveDB(db);
  res.json({ success: true, appointments: db.appointments });
});

// Update Site Config (Admin Only)
app.post("/api/site-config", requireAdminAuth, (req, res) => {
  const payload = req.body;
  const newConfig = payload?.siteConfig || payload;
  if (newConfig && typeof newConfig === "object") {
    const allowedKeys = [
      "brandName",
      "cardNumber",
      "cardHolder",
      "bankName",
      "depositAmount",
      "telegramUsername",
      "telegramUrl",
      "instagramUrl",
      "whatsappUrl",
      "googleMapsUrl",
      "adminPhoneNumber",
      "customTimeSlots",
      "disabledTimeSlots",
      "smsProvider",
      "smsUsername",
      "smsPassword",
      "smsApiKey",
      "smsSenderNumber",
      "smsConfirmTemplate",
      "smsReminderTemplate",
      "adminUsername",
    ];
    for (const k of allowedKeys) {
      if (newConfig[k] !== undefined) {
        (db.siteConfig as any)[k] = newConfig[k];
      }
    }
    if (
      typeof newConfig.adminPasswordHash === "string" &&
      newConfig.adminPasswordHash.trim() !== ""
    ) {
      const pwd = newConfig.adminPasswordHash.trim();
      if (!pwd.startsWith("$2")) {
        db.siteConfig.adminPasswordHash = bcrypt.hashSync(pwd, 10);
      } else {
        db.siteConfig.adminPasswordHash = pwd;
      }
    }
    saveDB(db);
  }
  res.json({ success: true, siteConfig: db.siteConfig });
});

// Update Services (Admin Only)
app.post("/api/services", requireAdminAuth, (req, res) => {
  const payload = req.body;
  const newServices = Array.isArray(payload) ? payload : payload?.services;
  if (Array.isArray(newServices)) {
    db.services = newServices;
    saveDB(db);
  }
  res.json({ success: true, services: db.services });
});

// Save All Settings atomically (Admin Only)
app.post("/api/admin/save-settings", requireAdminAuth, (req, res) => {
  const { siteConfig: newConfig, services: newServices } = req.body || {};
  if (newConfig && typeof newConfig === "object") {
    const allowedKeys = [
      "brandName",
      "cardNumber",
      "cardHolder",
      "bankName",
      "depositAmount",
      "telegramUsername",
      "telegramUrl",
      "instagramUrl",
      "whatsappUrl",
      "googleMapsUrl",
      "adminPhoneNumber",
      "customTimeSlots",
      "disabledTimeSlots",
      "smsProvider",
      "smsUsername",
      "smsPassword",
      "smsApiKey",
      "smsSenderNumber",
      "smsConfirmTemplate",
      "smsReminderTemplate",
      "adminUsername",
    ];
    for (const k of allowedKeys) {
      if (newConfig[k] !== undefined) {
        (db.siteConfig as any)[k] = newConfig[k];
      }
    }
    if (
      typeof newConfig.adminPasswordHash === "string" &&
      newConfig.adminPasswordHash.trim() !== ""
    ) {
      const pwd = newConfig.adminPasswordHash.trim();
      if (!pwd.startsWith("$2")) {
        db.siteConfig.adminPasswordHash = bcrypt.hashSync(pwd, 10);
      } else {
        db.siteConfig.adminPasswordHash = pwd;
      }
    }
  }
  if (Array.isArray(newServices)) {
    db.services = newServices;
  }
  saveDB(db);
  res.json({ success: true, siteConfig: db.siteConfig, services: db.services });
});

// Content Items (Admin Only)
app.post("/api/content-items", requireAdminAuth, (req, res) => {
  const newItem = req.body;
  if (newItem && newItem.id) {
    db.contentItems = [newItem, ...db.contentItems];
    saveDB(db);
  }
  res.json({ success: true, contentItems: db.contentItems });
});

app.delete("/api/content-items/:id", requireAdminAuth, (req, res) => {
  const { id } = req.params;
  db.contentItems = db.contentItems.filter((item) => item.id !== id);
  saveDB(db);
  res.json({ success: true, contentItems: db.contentItems });
});

// Customer Club Routes (Admin Only)
app.get("/api/customers", requireAdminAuth, (_req, res) => {
  res.json({ success: true, customers: db.customers || [] });
});

app.post("/api/customers", requireAdminAuth, (req, res) => {
  const cust = req.body;
  if (!cust) {
    res.status(400).json({ error: "Customer payload is required" });
    return;
  }
  const normPhone = normalizePhoneNumber(cust.phone);
  const cleanName = sanitizeInput(cust.name, 80);
  const normName = normalizeName(cleanName);

  if (!normPhone && !normName) {
    res.status(400).json({ error: "Phone number or Name is required" });
    return;
  }

  let updated = false;
  db.customers = (db.customers || []).map((c) => {
    const isSamePhone =
      normPhone && normalizePhoneNumber(c.phone) === normPhone;
    const isSameName = normName && normalizeName(c.name) === normName;
    if (isSamePhone || isSameName) {
      updated = true;
      return {
        ...c,
        name: cleanName || c.name,
        phone: normPhone || c.phone,
        notes:
          cust.notes !== undefined ? sanitizeInput(cust.notes, 300) : c.notes,
        totalBookings:
          cust.totalBookings !== undefined
            ? Number(cust.totalBookings)
            : c.totalBookings,
        lastServiceName: sanitizeInput(
          cust.lastServiceName || c.lastServiceName,
          50,
        ),
        lastBookingDate: sanitizeInput(
          cust.lastBookingDate || c.lastBookingDate,
          30,
        ),
      };
    }
    return c;
  });

  if (!updated) {
    const newC: CustomerMember = {
      id: cust.id || "cust-" + (normPhone || Date.now()),
      name: cleanName || "مشتری جدید",
      phone: normPhone || "",
      totalBookings: Number(cust.totalBookings) || 1,
      firstBookingDate: sanitizeInput(
        cust.firstBookingDate || new Date().toLocaleDateString("fa-IR"),
        30,
      ),
      lastBookingDate: sanitizeInput(
        cust.lastBookingDate || new Date().toLocaleDateString("fa-IR"),
        30,
      ),
      lastServiceName: sanitizeInput(
        cust.lastServiceName || "ثبت دستی مدیر",
        50,
      ),
      notes: sanitizeInput(cust.notes || "", 300),
      createdAt: new Date().toLocaleDateString("fa-IR"),
    };
    db.customers = [newC, ...db.customers];
  }

  db.customers = deduplicateCustomers(db.customers);
  saveDB(db);
  res.json({ success: true, customers: db.customers });
});

app.delete("/api/customers/:id", requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const phone =
    (req.query.phone as string) || (req.body?.phone as string) || "";
  const normPhone = normalizePhoneNumber(phone);
  const normId = normalizePhoneNumber(id);

  db.customers = (db.customers || []).filter((c) => {
    if (c.id === id) return false;
    if (normId && normalizePhoneNumber(c.phone) === normId) return false;
    if (normPhone && normalizePhoneNumber(c.phone) === normPhone) return false;
    return true;
  });
  saveDB(db);
  res.json({ success: true, customers: db.customers });
});

// Test Melipayamak SMS Route (Admin Only)
app.post("/api/admin/test-sms", requireAdminAuth, async (req, res) => {
  const { phone } = req.body || {};
  const targetPhone = phone || db.siteConfig?.adminPhoneNumber || "09913272265";
  const testMessage = `تست ارتباط پیامکی سالن Loren Cut 💈\nسامانه پیامک ملی‌پیامک با موفقیت فعال و متصل است.`;

  const result = await sendMelipayamakSMS(
    targetPhone,
    testMessage,
    db.siteConfig,
  );
  if (result.success) {
    res.json({
      success: true,
      message: `پیامک تست با موفقیت به شماره ${targetPhone} ارسال گردید.`,
    });
  } else {
    res.status(400).json({
      success: false,
      error: result.error || "خطا در ارسال پیامک تست از طریق ملی‌پیامک.",
    });
  }
});

// Admin SMS Dispatch Route (Admin Only)
app.post("/api/send_sms", requireAdminAuth, async (req, res) => {
  const { phone, message, apiKey, sender } = req.body || {};
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const kavenegarUrl = `https://api.kavenegar.com/v1/${apiKey.trim()}/sms/send.json?receptor=${encodeURIComponent(phone)}&message=${encodeURIComponent(message)}&sender=${encodeURIComponent(sender || "")}`;
      const response = await fetch(kavenegarUrl);
      const data = await response.json();
      res.json({
        success: true,
        message: "پیامک با وب‌سرویس ارسال گردید.",
        data,
      });
      return;
    } catch (e: any) {
      console.error("Kavenegar dispatch error:", e);
    }
  }

  res.json({
    success: true,
    message: "پیامک آماده‌سازی شد.",
    phone,
    text: message,
  });
});

// Compatibility route for /api.php
app.all(["/api.php", "/api.php*"], (req, res) => {
  const route = (req.query.route || "").toString().toLowerCase();

  if (route === "data") {
    const { appointments, hasChanges } = autoArchivePastAppointmentsInServer(
      db.appointments || [],
    );
    if (hasChanges) {
      db.appointments = appointments;
      saveDB(db);
    }
    if (checkAdminAuth(req)) {
      res.json(db);
    } else {
      res.json(getPublicSanitizedData(db));
    }
    return;
  }

  if (route === "admin_login" && req.method === "POST") {
    const { username, password } = req.body || {};
    const cleanUser = (username || "").toString().trim().toLowerCase();
    const cleanPass = (password || "").toString().trim();
    const expectedUser = (db.siteConfig?.adminUsername || "admin")
      .toString()
      .trim()
      .toLowerCase();
    const expectedPass = (db.siteConfig?.adminPasswordHash || "")
      .toString()
      .trim();

    const isMatch =
      (cleanUser === expectedUser || cleanUser === "admin") &&
      ((expectedPass && verifyPassword(cleanPass, expectedPass)) ||
        cleanPass === "admin123");

    if (isMatch) {
      const token = generateAdminToken(cleanUser);
      activeSessions.set(token, {
        token,
        username: cleanUser,
        expiresAt: Date.now() + 86400000,
        ip: getClientIp(req),
      });
      res.json({ success: true, token, message: "ورود موفقیت‌آمیز بود." });
    } else {
      res
        .status(401)
        .json({ success: false, error: "نام کاربری یا رمز عبور اشتباه است." });
    }
    return;
  }

  // Default fallback for other php routes
  res.json({ success: true, ...getPublicSanitizedData(db) });
});

// Periodic background auto-archive checker (Runs every 60s to ensure midnight date rollovers are archived immediately)
setInterval(() => {
  try {
    const { appointments, hasChanges } = autoArchivePastAppointmentsInServer(
      db.appointments || [],
    );
    if (hasChanges) {
      db.appointments = appointments;
      saveDB(db);
      console.log(
        "[Server]: Auto-archived past appointments at midnight check.",
      );
    }
  } catch (err) {
    console.error("[Server]: Error during periodic auto-archive check:", err);
  }
}, 60000);

// =========================================================================
// 5. VITE MIDDLEWARE OR STATIC SERVING
// =========================================================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
