require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const morgan = require("morgan");
const { DateTime } = require("luxon");

const {
  SERVICE_CATALOG_KEY,
  getCareOptionProductMap,
  getProductById,
  getProducts,
  normalizeServiceCatalog
} = require("./catalog");
const {
  DAY_KEYS,
  SCHEDULE_SETTING_KEY,
  TIME_ZONE,
  getAdminSlotsForDate,
  getScheduleConfig,
  getSlotCapacity,
  getSlotOverride,
  getSlotsForDate,
  getTodayIsoInClinicTimeZone,
  isSlotBookable,
  isValidIsoDate,
  normalizeScheduleConfig,
  normalizeSlotCapacity,
  normalizeSlotLabel,
  slotToMinutes
} = require("./availability");
const {
  cancelManagedBooking,
  createAttachment,
  createBooking,
  createBookingEvent,
  createServiceRequest,
  createServiceRequestAttachment,
  createWaitlistEntry,
  getAttachment,
  getBookingById,
  getBookingBySquareOrderId,
  getBookingByManageTokenHash,
  getBookedSlotCounts,
  getDashboardStats,
  getSetting,
  getServiceRequestAttachment,
  getServiceRequestBySquareOrderId,
  getWaitlistEntryById,
  listAttachmentsForBooking,
  listAttachmentsForServiceRequest,
  listBookingEvents,
  listBookings,
  listPartialFormDrafts,
  listServiceRequests,
  listWaitlistEntries,
  markPartialFormDraftSubmitted,
  rescheduleManagedBooking,
  setSetting,
  updateBooking,
  updatePartialFormDraftStatus,
  updateServiceRequest,
  updateServiceRequestSquarePaymentLink,
  updateWaitlistEntry,
  upsertPartialFormDraft,
  updateSquarePaymentLink
} = require("./database");
const {
  EMAIL_SETTINGS_KEY,
  getEmailSettings,
  isEmailConfigured,
  normalizeEmailSettings,
  publicEmailSettings,
  sendBookingAdminNotification,
  sendBookingCancellation,
  sendBookingCancellationAdminNotification,
  sendBookingConfirmation,
  sendBookingRescheduleAdminNotification,
  sendBookingRescheduleConfirmation,
  sendServiceRequestAdminNotification,
  sendServiceRequestConfirmation,
  sendTestEmail
} = require("./email");
const { verifyRecaptcha } = require("./recaptcha");
const { REMINDER_SETTING_KEY, getReminderMinutesBefore, startReminderService } = require("./reminders");
const {
  createSquarePayment,
  createSquarePaymentLink,
  createSquarePaymentLinkForServiceRequest,
  getSquareWebhookUrl,
  isSquareConfigured,
  isSquareWebhookConfigured,
  verifySquareWebhookSignature
} = require("./square");
const { isSmsConfigured } = require("./sms");

const app = express();
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, "..", "public");
const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || "data/uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, done) => {
      const extension = path.extname(file.originalname || "").toLowerCase();
      done(null, `${crypto.randomUUID()}${extension}`);
    }
  }),
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
    files: 5
  },
  fileFilter: (req, file, done) => {
    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]);
    done(null, allowedTypes.has(file.mimetype));
  }
});

// Behind the VPS reverse proxy so req.ip reflects the real client (used for
// reCAPTCHA remoteip, IP hashing, and rate limiting).
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // 'unsafe-inline' covers the single inline script on payment-return.html
        // and the dynamically-injected reCAPTCHA loader.
        // Square Web Payments SDK needs its CDN + JS host for scripts; the card
        // input renders in an iframe (frameSrc) and tokenizes over connectSrc.
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.google.com", "https://www.gstatic.com", "https://web.squarecdn.com", "https://sandbox.web.squarecdn.com", "https://js.squareup.com", "https://js.squareupsandbox.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://web.squarecdn.com", "https://sandbox.web.squarecdn.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:", "https://web.squarecdn.com", "https://sandbox.web.squarecdn.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://www.google.com", "https://connect.squareup.com", "https://pci-connect.squareup.com", "https://web.squarecdn.com", "https://connect.squareupsandbox.com", "https://pci-connect.squareupsandbox.com", "https://sandbox.web.squarecdn.com", "https://o160250.ingest.sentry.io"],
        frameSrc: ["https://www.google.com", "https://web.squarecdn.com", "https://connect.squareup.com", "https://sandbox.web.squarecdn.com", "https://connect.squareupsandbox.com"],
        formAction: ["'self'", "https://connect.squareup.com", "https://connect.squareupsandbox.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    }
  })
);
app.use(morgan("dev"));

// Lightweight in-memory rate limiter (single-process). Keyed by client IP.
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, windowMs);
  sweep.unref?.();

  return function rateLimiter(req, res, next) {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    let entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message: message || "Too many requests. Please slow down and try again shortly." });
    }
    return next();
  };
}

// Public submission endpoints: generous enough for real patients, tight enough to blunt abuse.
const submitLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: "Too many submissions from this network. Please wait a few minutes and try again."
});
app.use(express.json({
  limit: "1mb",
  // Keep the exact raw bytes so the Square webhook signature can be verified.
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

const SERVICE_REQUEST_TYPES = {
  doctor_note: {
    label: "Doctor Note Service",
    referenceCode: "DN",
    totalCents: 4500
  },
  prescription_refill: {
    label: "Prescription Refill",
    referenceCode: "PR",
    totalCents: 5000
  }
};

const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_AUTH_CONFIGURED = Boolean(ADMIN_USER && ADMIN_PASSWORD);

if (!ADMIN_AUTH_CONFIGURED) {
  console.error(
    "FATAL: ADMIN_USER and ADMIN_PASSWORD must both be set in the environment. " +
      "Refusing to start without admin credentials."
  );
  process.exit(1);
}

// Constant-time string comparison that does not leak length via early return.
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a), "utf8");
  const bufB = Buffer.from(String(b), "utf8");
  // Hash to a fixed length so timingSafeEqual never sees mismatched lengths
  // (which would itself throw / leak length information).
  const digestA = crypto.createHash("sha256").update(bufA).digest();
  const digestB = crypto.createHash("sha256").update(bufB).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

// Brute-force throttle for admin login, keyed by client IP.
const adminFailures = new Map();
const ADMIN_MAX_FAILURES = 10;
const ADMIN_LOCKOUT_MS = 15 * 60 * 1000;

function requireAdmin(req, res, next) {
  const key = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const record = adminFailures.get(key);
  if (record && record.count >= ADMIN_MAX_FAILURES && now < record.until) {
    res.setHeader("Retry-After", String(Math.ceil((record.until - now) / 1000)));
    return res.status(429).send("Too many failed admin login attempts. Please try again later.");
  }

  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme === "Basic" && token) {
    const [user, password] = Buffer.from(token, "base64").toString("utf8").split(":");
    const userOk = safeEqual(user || "", ADMIN_USER);
    const passwordOk = safeEqual(password || "", ADMIN_PASSWORD);
    if (userOk && passwordOk) {
      adminFailures.delete(key);
      return next();
    }
  }

  const failures = record && now < record.until ? record.count + 1 : 1;
  adminFailures.set(key, { count: failures, until: now + ADMIN_LOCKOUT_MS });
  res.setHeader("WWW-Authenticate", 'Basic realm="TelePlus Care Admin"');
  return res.status(401).send("Admin login required.");
}

function toText(value) {
  return String(value || "").trim();
}

function isValidDob(value) {
  if (!/^\d{2}-\d{2}-\d{4}$/.test(value || "")) {
    return false;
  }

  const [month, day, year] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizePhone(value) {
  return toText(value).replace(/[^\d+]/g, "");
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
}

// Alberta patients pick a real appointment time; everyone else becomes a
// "we'll call you within 3 hours" callback request with no fixed slot.
function isAlbertaProvince(value) {
  const province = toText(value).toLowerCase();
  return province === "ab" || province === "alberta";
}

function parseUsDate(value) {
  if (!isValidDob(value)) {
    return null;
  }

  const [month, day, year] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function inclusiveDayRange(startDate, endDate) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / millisecondsPerDay) + 1;
}

function calculateProducts(rawProducts) {
  if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
    throw new Error("Please select at least one product.");
  }

  const selectedProducts = rawProducts.map((item) => {
    const product = getProductById(toText(item.id));
    if (!product) {
      throw new Error("One selected product is no longer available.");
    }

    const quantity = Math.max(1, Math.min(12, Number(item.quantity || 1)));
    return {
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      requiredFields: product.requiredFields || [],
      quantity,
      lineTotalCents: product.priceCents * quantity
    };
  });

  const uniqueIds = new Set(selectedProducts.map((product) => product.id));
  if (uniqueIds.size !== selectedProducts.length) {
    throw new Error("Please remove duplicate product selections.");
  }

  const totalCents = selectedProducts.reduce((sum, product) => sum + product.lineTotalCents, 0);
  return { selectedProducts, totalCents };
}

function validateBookingPayload(body) {
  const errors = [];
  const outsideAlberta = !isAlbertaProvince(body.province);
  const requiredFields = [
    ["careOption", "TelePlus Care option is required."],
    ["firstName", "First name is required."],
    ["lastName", "Last name is required."],
    ["gender", "Gender is required."],
    ["dateOfBirth", "Date of birth is required."],
    ["phone", "Phone number is required."],
    ["email", "Email is required."],
    ["streetAddress", "Street address is required."],
    ["city", "City is required."],
    ["province", "State / Province is required."],
    ["postalCode", "Postal / Zip Code is required."],
    ["reminderPreference", "Preferred way of reminder is required."],
    ["activeHealthCard", "Active Alberta Health Card answer is required."],
    ["visitReason", "Reason for visit is required."],
    // Alberta patients must pick a date/time; out-of-province ones are scheduled by callback.
    ...(outsideAlberta ? [] : [
      ["appointmentDate", "Preferred appointment date is required."],
      ["appointmentTime", "Appointment time is required."]
    ])
  ];

  for (const [field, message] of requiredFields) {
    if (!toText(body[field])) {
      errors.push(message);
    }
  }

  if (body.dateOfBirth && !isValidDob(toText(body.dateOfBirth))) {
    errors.push("Date of birth must use MM-DD-YYYY.");
  }

  const phone = normalizePhone(body.phone);
  if (phone.length < 10) {
    errors.push("Phone number must include at least 10 digits.");
  }

  if (body.email && !isEmail(toText(body.email))) {
    errors.push("Please enter a valid email address.");
  }

  if (toText(body.visitReason).length > 1000) {
    errors.push("Reason for visit must be 1000 characters or fewer.");
  }

  const activeHealthCard = toText(body.activeHealthCard).toLowerCase();
  if (!["yes", "no"].includes(activeHealthCard)) {
    errors.push("Active Alberta Health Card must be Yes or No.");
  }

  const phn = toText(body.phn).replace(/\D/g, "");
  if (activeHealthCard === "yes" && !/^\d{9}$/.test(phn)) {
    errors.push("Alberta Health Card PHN must be 9 digits.");
  }

  if (!outsideAlberta) {
    if (!isValidIsoDate(toText(body.appointmentDate))) {
      errors.push("Preferred appointment date must be valid.");
    }

    if (toText(body.appointmentDate) < getTodayIsoInClinicTimeZone()) {
      errors.push("Preferred appointment date cannot be in the past.");
    }

    const possibleSlots = getSlotsForDate(toText(body.appointmentDate));
    if (!possibleSlots.includes(toText(body.appointmentTime))) {
      errors.push("Please choose an available appointment time.");
    }
    if (!isSlotBookable(toText(body.appointmentDate), toText(body.appointmentTime))) {
      errors.push("Please choose a future appointment time.");
    }
    if (!hasSlotCapacity(toText(body.appointmentDate), toText(body.appointmentTime))) {
      errors.push("That appointment time was just booked. Please choose another time.");
    }
  }

  if (!body.consentAcknowledged) {
    errors.push("Consent and emergency notice acknowledgement is required.");
  }

  let selectedProducts = [];
  let totalCents = 0;
  try {
    ({ selectedProducts, totalCents } = calculateProducts(body.products));
  } catch (error) {
    errors.push(error.message);
  }

  const hasActiveCardProduct = selectedProducts.some(
    (product) => product.id === "active-alberta-health-card"
  );
  if (hasActiveCardProduct && activeHealthCard !== "yes") {
    errors.push("The Active Alberta Health Card product requires an active Alberta PHN.");
  }

  if (activeHealthCard === "yes") {
    const hasPaidProduct = selectedProducts.some((product) => product.priceCents > 0);
    if (hasPaidProduct) {
      errors.push("Patients with an active Alberta Health Card should use the free Active Alberta Health Card option only.");
    }
  }

  const expectedProductId = activeHealthCard === "yes"
    ? "active-alberta-health-card"
    : getCareOptionProductMap()[toText(body.careOption)] || "non-active-alberta-health-card";
  if (
    selectedProducts.length !== 1 ||
    selectedProducts[0]?.id !== expectedProductId
  ) {
    errors.push("Selected service payment option does not match the TelePlus Care option.");
  }

  const serviceFields = sanitizeServiceFields(body.serviceFields);
  const requiredServiceFields = selectedProducts[0]?.requiredFields || [];
  for (const fieldLabel of requiredServiceFields) {
    const value = serviceFields[fieldLabel] || serviceFields[fieldKeyForLabel(fieldLabel)] || "";
    if (!toText(value)) {
      errors.push(`${fieldLabel} is required for this service.`);
    }
  }

  const paymentMethod = toText(body.paymentMethod);
  if (totalCents > 0 && paymentMethod !== "square") {
    errors.push("Square secure checkout is required for paid bookings.");
  }

  if (errors.length > 0) {
    const error = new Error(errors[0]);
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    careOption: toText(body.careOption),
    firstName: toText(body.firstName),
    lastName: toText(body.lastName),
    gender: toText(body.gender),
    dateOfBirth: toText(body.dateOfBirth),
    phone: toText(body.phone),
    email: toText(body.email).toLowerCase(),
    streetAddress: toText(body.streetAddress),
    city: toText(body.city),
    province: toText(body.province),
    postalCode: toText(body.postalCode).toUpperCase(),
    reminderPreference: toText(body.reminderPreference),
    activeHealthCard,
    phn: activeHealthCard === "yes" ? phn : "",
    visitReason: toText(body.visitReason),
    appointmentDate: outsideAlberta ? "" : toText(body.appointmentDate),
    appointmentTime: outsideAlberta ? "" : toText(body.appointmentTime),
    needsScheduling: outsideAlberta,
    timezone: TIME_ZONE,
    selectedProducts,
    serviceFieldsJson: JSON.stringify(serviceFields),
    totalCents,
    paymentMethod: totalCents === 0 ? paymentMethod || "not_required" : paymentMethod,
    paymentStatus: totalCents === 0 ? "not_required" : "pending",
    squarePaymentLinkId: "",
    squarePaymentLinkUrl: "",
    squareOrderId: "",
    status: "new",
    consentAcknowledged: 1
  };
}

function buildReference(appointmentDate) {
  // Out-of-province callback requests have no date, so fall back to today.
  const dateForReference = appointmentDate || getTodayIsoInClinicTimeZone();
  const compactDate = dateForReference.replaceAll("-", "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `TPC-${compactDate}-${suffix}`;
}

function buildServiceRequestReference(requestType) {
  const config = SERVICE_REQUEST_TYPES[requestType];
  const today = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `TPC-${config.referenceCode}-${today}-${suffix}`;
}

function validateServiceRequestPayload(body, files = []) {
  const errors = [];
  const requestType = toText(body.requestType);
  const config = SERVICE_REQUEST_TYPES[requestType];

  if (!config) {
    errors.push("Please choose a valid request type.");
  }

  const requiredFields = [
    ["firstName", "First name is required."],
    ["lastName", "Last name is required."],
    ["phone", "Phone number is required."],
    ["email", "Email is required."],
    ["streetAddress", "Street address is required."],
    ["city", "City is required."],
    ["province", "State / Province is required."],
    ["postalCode", "Postal / Zip Code is required."],
    ["dateOfBirth", "Date of birth is required."],
    ["reason", "Reason is required."],
    ["paymentMethod", "Payment method is required."]
  ];

  for (const [field, message] of requiredFields) {
    if (!toText(body[field])) {
      errors.push(message);
    }
  }

  if (body.dateOfBirth && !isValidDob(toText(body.dateOfBirth))) {
    errors.push("Date of birth must use MM-DD-YYYY.");
  }

  const phone = normalizePhone(body.phone);
  if (phone.length < 10) {
    errors.push("Phone number must include at least 10 digits.");
  }

  if (body.email && !isEmail(toText(body.email))) {
    errors.push("Please enter a valid email address.");
  }

  const reason = toText(body.reason);
  if (reason.length > 150) {
    errors.push("Reason must be 150 characters or less.");
  }

  const paymentMethod = toText(body.paymentMethod);
  if (paymentMethod !== "square") {
    errors.push("Square secure checkout is required for this request.");
  }

  const policyAcknowledged = toText(body.policyAcknowledged) === "on" || body.policyAcknowledged === "true";
  if (!policyAcknowledged) {
    errors.push("Please acknowledge the request policy before submitting.");
  }

  let noteStartDate = "";
  let noteEndDate = "";

  if (requestType === "doctor_note") {
    noteStartDate = toText(body.noteStartDate);
    noteEndDate = toText(body.noteEndDate);

    if (!noteStartDate) {
      errors.push("Doctor note start date is required.");
    }
    if (!noteEndDate) {
      errors.push("Doctor note end date is required.");
    }

    const parsedStart = parseUsDate(noteStartDate);
    const parsedEnd = parseUsDate(noteEndDate);

    if (noteStartDate && !parsedStart) {
      errors.push("Doctor note start date must use MM-DD-YYYY.");
    }
    if (noteEndDate && !parsedEnd) {
      errors.push("Doctor note end date must use MM-DD-YYYY.");
    }
    if (parsedStart && parsedEnd) {
      const dayRange = inclusiveDayRange(parsedStart, parsedEnd);
      if (dayRange < 1) {
        errors.push("Doctor note end date cannot be before the start date.");
      }
      if (dayRange > 7) {
        errors.push("Doctor note date range must not exceed 7 days.");
      }
    }
  }

  if (requestType === "prescription_refill" && !files.length) {
    errors.push("Please upload proof of current medication use.");
  }

  if (errors.length > 0) {
    const error = new Error(errors[0]);
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    requestType,
    serviceLabel: config.label,
    firstName: toText(body.firstName),
    lastName: toText(body.lastName),
    phone: toText(body.phone),
    email: toText(body.email).toLowerCase(),
    streetAddress: toText(body.streetAddress),
    city: toText(body.city),
    province: toText(body.province),
    postalCode: toText(body.postalCode).toUpperCase(),
    dateOfBirth: toText(body.dateOfBirth),
    reason,
    noteStartDate,
    noteEndDate,
    totalCents: config.totalCents,
    paymentMethod,
    paymentStatus: "pending",
    squarePaymentLinkId: "",
    squarePaymentLinkUrl: "",
    squareOrderId: "",
    internalNotes: "",
    fieldsJson: JSON.stringify({
      serviceLabel: config.label,
      policyAcknowledged
    }),
    status: "new"
  };
}

function createManageToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashManageToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashIp(value) {
  const salt = process.env.PRIVACY_HASH_SALT || "telepluscare-local";
  return crypto.createHash("sha256").update(`${salt}:${value || ""}`).digest("hex");
}

function fieldKeyForLabel(label) {
  return toText(label)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function sanitizeServiceFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return {};
  }

  const sanitized = {};
  for (const [rawKey, rawValue] of Object.entries(fields)) {
    const key = toText(rawKey).slice(0, 120);
    if (!key) {
      continue;
    }
    sanitized[key] = toText(rawValue).slice(0, 2000);
  }
  return sanitized;
}

function sanitizeDraftFields(fields) {
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
    return {};
  }

  const blockedKeys = new Set(["recaptchaToken", "attachments"]);
  const sanitized = {};
  for (const [rawKey, rawValue] of Object.entries(fields)) {
    const key = toText(rawKey).slice(0, 80);
    if (!key || blockedKeys.has(key)) {
      continue;
    }

    if (Array.isArray(rawValue)) {
      sanitized[key] = rawValue.map((value) => {
        if (value && typeof value === "object") {
          return JSON.stringify(value).slice(0, 500);
        }
        return toText(value).slice(0, 500);
      }).slice(0, 20);
      continue;
    }

    if (rawValue && typeof rawValue === "object") {
      sanitized[key] = JSON.stringify(rawValue).slice(0, 1000);
      continue;
    }

    sanitized[key] = toText(rawValue).slice(0, 1000);
  }

  return sanitized;
}

function hasUsefulDraftField(fields) {
  const ignoredKeys = new Set([
    "draftId",
    "requestType",
    "appointmentDate",
    "paymentMethod",
    "consentAcknowledged"
  ]);
  const meaningfulKeys = new Set([
    "careOption",
    "gender",
    "firstName",
    "lastName",
    "dateOfBirth",
    "phone",
    "email",
    "streetAddress",
    "city",
    "province",
    "postalCode",
    "reminderPreference",
    "activeHealthCard",
    "phn",
    "appointmentTime",
    "reason",
    "noteStartDate",
    "noteEndDate",
    "selectedProducts"
  ]);

  return Object.entries(fields).some(([key, value]) => {
    if (ignoredKeys.has(key)) {
      return false;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    const text = toText(value);
    if (!text) {
      return false;
    }
    if (key === "careOption") {
      return text !== "Virtual Doctor Visit";
    }
    if (key === "activeHealthCard") {
      return ["yes", "no"].includes(text.toLowerCase());
    }
    return meaningfulKeys.has(key);
  });
}

function publicPartialFormDraft(draft) {
  return {
    id: draft.id,
    status: draft.status,
    updatedAt: draft.updatedAt
  };
}

function buildManageUrl(token) {
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${port}`;
  return `${baseUrl.replace(/\/$/, "")}/manage-booking?token=${encodeURIComponent(token)}`;
}

function requireManageToken(token) {
  const cleanToken = toText(token);
  if (!/^[A-Za-z0-9_-]{32,120}$/.test(cleanToken)) {
    const error = new Error("This booking management link is invalid.");
    error.statusCode = 404;
    throw error;
  }

  const booking = getBookingByManageTokenHash(hashManageToken(cleanToken));
  if (!booking) {
    const error = new Error("This booking management link is invalid or expired.");
    error.statusCode = 404;
    throw error;
  }

  return booking;
}

function publicBooking(booking) {
  return {
    reference: booking.reference,
    firstName: booking.firstName,
    lastName: booking.lastName,
    email: booking.email,
    phone: booking.phone,
    appointmentDate: booking.appointmentDate,
    appointmentTime: booking.appointmentTime,
    timezone: booking.timezone,
    products: booking.products,
    totalCents: booking.totalCents,
    paymentStatus: booking.paymentStatus,
    paymentUrl: booking.squarePaymentLinkUrl,
    status: booking.status,
    cancelledAt: booking.cancelledAt,
    rescheduledAt: booking.rescheduledAt,
    attachments: listAttachmentsForBooking(booking.id).map(publicAttachment)
  };
}

function publicAttachment(attachment) {
  return {
    id: attachment.id,
    uploadedAt: attachment.uploadedAt,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes
  };
}

function publicServiceRequest(serviceRequest) {
  return {
    reference: serviceRequest.reference,
    requestType: serviceRequest.requestType,
    serviceLabel: serviceRequest.fields?.serviceLabel || SERVICE_REQUEST_TYPES[serviceRequest.requestType]?.label || "TelePlus Care Service",
    firstName: serviceRequest.firstName,
    lastName: serviceRequest.lastName,
    email: serviceRequest.email,
    phone: serviceRequest.phone,
    totalCents: serviceRequest.totalCents,
    paymentStatus: serviceRequest.paymentStatus,
    paymentUrl: serviceRequest.squarePaymentLinkUrl,
    status: serviceRequest.status
  };
}

function adminBooking(booking) {
  return {
    ...booking,
    attachments: listAttachmentsForBooking(booking.id).map(publicAttachment),
    events: listBookingEvents(booking.id)
  };
}

function adminServiceRequest(serviceRequest) {
  return {
    ...serviceRequest,
    attachments: listAttachmentsForServiceRequest(serviceRequest.id).map(publicAttachment)
  };
}

function emailSettingsFromBody(body) {
  const currentSettings = getEmailSettings();
  const nextPassword = body.clearSmtpPassword
    ? ""
    : String(body.smtpPass || "").trim()
      ? String(body.smtpPass)
      : currentSettings.smtpPass;

  return normalizeEmailSettings({
    smtpEnabled: Boolean(body.smtpEnabled),
    smtpHost: body.smtpHost,
    smtpPort: body.smtpPort,
    smtpSecure: Boolean(body.smtpSecure),
    smtpUser: body.smtpUser,
    smtpPass: nextPassword,
    smtpFrom: body.smtpFrom,
    smtpReplyTo: body.smtpReplyTo,
    patientConfirmationsEnabled: Boolean(body.patientConfirmationsEnabled),
    serviceRequestConfirmationsEnabled: Boolean(body.serviceRequestConfirmationsEnabled),
    reminderEmailsEnabled: Boolean(body.reminderEmailsEnabled),
    adminNotificationsEnabled: Boolean(body.adminNotificationsEnabled),
    adminNotificationEmails: body.adminNotificationEmails,
    appointmentSubject: body.appointmentSubject,
    appointmentIntro: body.appointmentIntro,
    serviceRequestSubject: body.serviceRequestSubject,
    serviceRequestIntro: body.serviceRequestIntro,
    reminderSubject: body.reminderSubject,
    reminderIntro: body.reminderIntro,
    adminBookingSubject: body.adminBookingSubject,
    adminServiceRequestSubject: body.adminServiceRequestSubject,
    refundPolicyUrl: body.refundPolicyUrl
  });
}

const CANCELLATION_POLICY_KEY = "cancellation_policy";
const DEFAULT_CANCELLATION_POLICY = {
  cutoffHours: 2,
  noShowFeeCents: 6000,
  refundAdminFeeCents: 2000,
  sendCancellationEmail: true,
  policyText: "To cancel or reschedule, please use your confirmation email link as early as possible. Late cancellations or no-shows may require a $40-$60 fee before rebooking. Refunds may have a $20 administration/payment-processing deduction."
};

function readBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeCancellationPolicy(rawPolicy = {}) {
  const merged = {
    ...DEFAULT_CANCELLATION_POLICY,
    ...rawPolicy
  };

  return {
    cutoffHours: readInteger(merged.cutoffHours, DEFAULT_CANCELLATION_POLICY.cutoffHours, 0, 168),
    noShowFeeCents: readInteger(merged.noShowFeeCents, DEFAULT_CANCELLATION_POLICY.noShowFeeCents, 0, 50000),
    refundAdminFeeCents: readInteger(merged.refundAdminFeeCents, DEFAULT_CANCELLATION_POLICY.refundAdminFeeCents, 0, 50000),
    sendCancellationEmail: readBoolean(merged.sendCancellationEmail, true),
    policyText: toText(merged.policyText || DEFAULT_CANCELLATION_POLICY.policyText).slice(0, 2000)
  };
}

function getCancellationPolicy() {
  try {
    const value = getSetting(CANCELLATION_POLICY_KEY, "");
    return normalizeCancellationPolicy(value ? JSON.parse(value) : DEFAULT_CANCELLATION_POLICY);
  } catch (error) {
    return normalizeCancellationPolicy(DEFAULT_CANCELLATION_POLICY);
  }
}

function bookingDateTime(booking) {
  return DateTime.fromFormat(
    `${booking.appointmentDate} ${booking.appointmentTime}`,
    "yyyy-MM-dd h:mm a",
    { zone: booking.timezone || TIME_ZONE }
  );
}

function validatePatientCancellation(booking, policy = getCancellationPolicy()) {
  const errors = [];

  if (booking.status === "cancelled") {
    errors.push("This booking is already cancelled.");
  }

  const appointmentAt = bookingDateTime(booking);
  if (!appointmentAt.isValid) {
    errors.push("This booking time could not be checked. Please contact TelePlus Care.");
  } else if (policy.cutoffHours > 0) {
    const cutoffAt = appointmentAt.minus({ hours: policy.cutoffHours });
    if (DateTime.now().setZone(booking.timezone || TIME_ZONE) > cutoffAt) {
      errors.push(`Online cancellation is closed within ${policy.cutoffHours} hour(s) of the appointment. Please call 587-442-4898 or email booking@telepluscare.com.`);
    }
  }

  if (errors.length > 0) {
    const error = new Error(errors[0]);
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }
}

function validateWaitlistPayload(body) {
  const errors = [];
  const requiredFields = [
    ["firstName", "First name is required."],
    ["lastName", "Last name is required."],
    ["phone", "Phone number is required."],
    ["email", "Email is required."],
    ["desiredDate", "Preferred date is required."]
  ];

  for (const [field, message] of requiredFields) {
    if (!toText(body[field])) {
      errors.push(message);
    }
  }

  if (body.email && !isEmail(toText(body.email))) {
    errors.push("Please enter a valid email address.");
  }

  if (normalizePhone(body.phone).length < 10) {
    errors.push("Phone number must include at least 10 digits.");
  }

  if (!isValidIsoDate(toText(body.desiredDate))) {
    errors.push("Preferred date must be valid.");
  }

  if (errors.length > 0) {
    const error = new Error(errors[0]);
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  return {
    firstName: toText(body.firstName),
    lastName: toText(body.lastName),
    phone: toText(body.phone),
    email: toText(body.email).toLowerCase(),
    desiredDate: toText(body.desiredDate),
    desiredTime: toText(body.desiredTime),
    careOption: toText(body.careOption),
    notes: toText(body.notes).slice(0, 1000),
    status: "new"
  };
}

function validateManagedAppointment(booking, appointmentDate, appointmentTime) {
  const errors = [];

  if (booking.status === "cancelled") {
    errors.push("This booking is already cancelled.");
  }

  if (!isValidIsoDate(appointmentDate)) {
    errors.push("Preferred appointment date must be valid.");
  }

  if (appointmentDate < getTodayIsoInClinicTimeZone()) {
    errors.push("Preferred appointment date cannot be in the past.");
  }

  const possibleSlots = getSlotsForDate(appointmentDate);
  if (!possibleSlots.includes(appointmentTime) || !isSlotBookable(appointmentDate, appointmentTime)) {
    errors.push("Please choose an available future appointment time.");
  }

  if (!hasSlotCapacity(appointmentDate, appointmentTime, booking.id)) {
    errors.push("That appointment time was just booked. Please choose another time.");
  }

  if (errors.length > 0) {
    const error = new Error(errors[0]);
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }
}

function hasSlotCapacity(appointmentDate, appointmentTime, excludeBookingId = "") {
  const counts = getBookedSlotCounts(appointmentDate, excludeBookingId);
  const bookedCount = counts[appointmentTime] || 0;
  return bookedCount < getSlotCapacity(appointmentDate, appointmentTime);
}

function slotControlPayload(date) {
  const schedule = getScheduleConfig();
  const openSlots = new Set(getSlotsForDate(date));
  const bookedCounts = getBookedSlotCounts(date);
  const today = getTodayIsoInClinicTimeZone();
  const times = [...new Set([
    ...getAdminSlotsForDate(date),
    ...Object.keys(bookedCounts)
  ])].sort((left, right) => {
    return slotToMinutes(left) - slotToMinutes(right);
  });

  const slots = times.map((time) => {
    const override = getSlotOverride(date, time, schedule);
    const capacity = getSlotCapacity(date, time, schedule);
    const booked = bookedCounts[time] || 0;
    const open = openSlots.has(time);
    const future = date >= today && isSlotBookable(date, time);
    const available = open && future && booked < capacity;
    const remaining = Math.max(0, capacity - booked);
    let status = "open";

    if (!open) {
      status = "closed";
    } else if (!future) {
      status = "unavailable";
    } else if (booked >= capacity) {
      status = "full";
    }

    return {
      time,
      status,
      open,
      available,
      capacity,
      booked,
      remaining,
      overrideStatus: override?.status || "",
      overrideCapacity: override?.capacity || null
    };
  });

  return {
    date,
    timezone: TIME_ZONE,
    slots,
    stats: {
      totalSlots: slots.length,
      totalCapacity: slots.reduce((sum, slot) => sum + (slot.open ? slot.capacity : 0), 0),
      booked: slots.reduce((sum, slot) => sum + slot.booked, 0),
      open: slots.reduce((sum, slot) => sum + (slot.available ? slot.remaining : 0), 0),
      unavailable: slots.filter((slot) => slot.status === "closed" || slot.status === "unavailable").length,
      full: slots.filter((slot) => slot.status === "full").length
    }
  };
}

app.get("/api/products", (req, res) => {
  res.json({
    products: getProducts(),
    careOptionProductMap: getCareOptionProductMap()
  });
});

app.get("/api/payment-config", (req, res) => {
  res.json({
    provider: "square",
    squareConfigured: isSquareConfigured(),
    squareEnvironment: process.env.SQUARE_ENVIRONMENT === "production" ? "production" : "sandbox",
    squareApplicationId: process.env.SQUARE_APPLICATION_ID || "",
    squareLocationId: process.env.SQUARE_LOCATION_ID || "",
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ""
  });
});

app.post("/api/marketing/form-draft", (req, res, next) => {
  try {
    const id = toText(req.body.id);
    const visitorId = toText(req.body.visitorId);
    const formType = toText(req.body.formType);
    const currentPath = toText(req.body.currentPath).slice(0, 250);
    const lastField = toText(req.body.lastField).slice(0, 120);

    if (!/^[A-Za-z0-9_-]{12,80}$/.test(id) || !/^[A-Za-z0-9_-]{12,80}$/.test(visitorId)) {
      return res.status(400).json({ message: "Draft identifier is invalid." });
    }

    if (!["appointment", "doctor_note", "prescription_refill"].includes(formType)) {
      return res.status(400).json({ message: "Draft form type is invalid." });
    }

    const fields = sanitizeDraftFields(req.body.fields);
    if (!hasUsefulDraftField(fields)) {
      return res.json({ draft: null, skipped: true });
    }

    const fieldsJson = JSON.stringify(fields);
    if (fieldsJson.length > 30000) {
      return res.status(413).json({ message: "Draft is too large to save." });
    }

    const draft = upsertPartialFormDraft({
      id,
      visitorId,
      formType,
      currentPath,
      lastField,
      fieldsJson,
      userAgent: toText(req.headers["user-agent"]).slice(0, 500),
      ipHash: hashIp(req.ip)
    });

    return res.json({ draft: publicPartialFormDraft(draft) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/availability", (req, res) => {
  const date = toText(req.query.date);
  if (!isValidIsoDate(date)) {
    return res.status(400).json({ message: "A valid date is required." });
  }

  const availableSlots = getSlotsForDate(date);
  const bookedCounts = getBookedSlotCounts(date);
  const today = getTodayIsoInClinicTimeZone();

  res.json({
    date,
    timezone: TIME_ZONE,
    slots: availableSlots.map((slot) => {
      const capacity = getSlotCapacity(date, slot);
      const booked = bookedCounts[slot] || 0;
      return {
        time: slot,
        capacity,
        booked,
        remaining: Math.max(0, capacity - booked),
        available: date >= today && isSlotBookable(date, slot) && booked < capacity
      };
    })
  });
});

app.post("/api/waitlist", submitLimiter, (req, res, next) => {
  try {
    const validEntry = validateWaitlistPayload(req.body || {});
    const entry = createWaitlistEntry({
      ...validEntry,
      id: crypto.randomUUID()
    });

    return res.status(201).json({
      waitlistEntry: {
        id: entry.id,
        status: entry.status,
        desiredDate: entry.desiredDate,
        desiredTime: entry.desiredTime
      }
    });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/bookings", submitLimiter, async (req, res, next) => {
  try {
    await verifyRecaptcha(req.body.recaptchaToken, req.ip);
    const validBooking = validateBookingPayload(req.body);

    // Pay-before-confirm: a fee'd booking must arrive with a card token from the
    // Web Payments SDK. $0 (Alberta Health Card) bookings need no payment.
    const requiresPayment = validBooking.totalCents > 0 && isSquareConfigured();
    const paymentToken = toText(req.body.paymentToken);
    if (requiresPayment && !paymentToken) {
      return res.status(400).json({
        message: "Please enter your card details to complete this booking."
      });
    }

    const manageToken = createManageToken();
    let booking = createBooking(
      {
        ...validBooking,
        id: crypto.randomUUID(),
        reference: buildReference(validBooking.appointmentDate),
        productsJson: JSON.stringify(validBooking.selectedProducts),
        manageTokenHash: hashManageToken(manageToken)
      },
      validBooking.appointmentTime
        ? {
            appointmentTime: validBooking.appointmentTime,
            capacity: getSlotCapacity(validBooking.appointmentDate, validBooking.appointmentTime)
          }
        : null
    );
    createBookingEvent({
      bookingId: booking.id,
      eventType: "created",
      summary: validBooking.needsScheduling
        ? "Out-of-Alberta request created with no appointment time. Contact patient within 3 hours to schedule."
        : `Booking created for ${booking.appointmentDate} at ${booking.appointmentTime}.`,
      metadata: { reference: booking.reference, totalCents: booking.totalCents, needsScheduling: Boolean(validBooking.needsScheduling) }
    });

    if (requiresPayment) {
      try {
        const payment = await createSquarePayment({
          sourceId: paymentToken,
          amountCents: booking.totalCents,
          referenceId: booking.reference,
          note: `TelePlus Care booking ${booking.reference}`,
          email: booking.email
        });
        if (payment.status !== "COMPLETED" && payment.status !== "APPROVED") {
          throw new Error(`Payment was not completed (status: ${payment.status || "unknown"}).`);
        }
        // Record the order id so refund webhooks can match this booking, and
        // flip it to paid.
        updateSquarePaymentLink(booking.id, { id: "", url: "", orderId: payment.orderId });
        booking = updateBooking(booking.id, {
          status: booking.status,
          paymentStatus: "paid",
          internalNotes: booking.internalNotes || ""
        });
        createBookingEvent({
          bookingId: booking.id,
          eventType: "payment_captured",
          summary: `Card charged successfully ($${(booking.totalCents / 100).toFixed(2)} CAD).`,
          metadata: { squarePaymentId: payment.id, squareOrderId: payment.orderId, receiptUrl: payment.receiptUrl }
        });
      } catch (error) {
        // Free the reserved slot — no confirmed booking without payment.
        cancelManagedBooking(booking.id);
        createBookingEvent({
          bookingId: booking.id,
          eventType: "payment_failed",
          summary: "Card was declined or the charge failed — booking released.",
          metadata: { error: error.message }
        });
        return res.status(402).json({
          message: error.message || "Your card was declined. No appointment was booked and you were not charged."
        });
      }
    }

    const manageUrl = buildManageUrl(manageToken);
    const emailResult = await sendBookingConfirmation(booking, manageUrl).catch((error) => {
      console.error("Confirmation email failed:", error.message);
      return { sent: false, reason: "email_failed" };
    });
    createBookingEvent({
      bookingId: booking.id,
      eventType: emailResult.sent ? "confirmation_sent" : "confirmation_not_sent",
      summary: emailResult.sent ? "Confirmation email sent to patient." : `Confirmation email not sent (${emailResult.reason || "unknown reason"}).`,
      metadata: emailResult
    });
    // Fire-and-forget: the patient response must not wait on the staff
    // notification (and a failure here must never fail the booking).
    sendBookingAdminNotification(booking, manageUrl).catch((error) => {
      console.error("Admin booking notification failed:", error.message);
    });
    markPartialFormDraftSubmitted(toText(req.body.draftId));

    return res.status(201).json({
      booking: {
        reference: booking.reference,
        appointmentDate: booking.appointmentDate,
        appointmentTime: booking.appointmentTime,
        timezone: booking.timezone,
        totalCents: booking.totalCents,
        paymentStatus: booking.paymentStatus,
        paymentProvider: "square",
        paid: booking.paymentStatus === "paid",
        manageUrl: emailResult.sent ? undefined : manageUrl
      },
      email: emailResult
    });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE" || error.code === "SLOT_FULL") {
      return res.status(409).json({
        message: "That appointment time was just booked. Please choose another time."
      });
    }
    return next(error);
  }
});

app.post("/api/service-requests", submitLimiter, upload.array("attachments", 5), async (req, res, next) => {
  try {
    await verifyRecaptcha(req.body.recaptchaToken, req.ip);
    const validRequest = validateServiceRequestPayload(req.body, req.files || []);
    let serviceRequest = createServiceRequest({
      ...validRequest,
      id: crypto.randomUUID(),
      reference: buildServiceRequestReference(validRequest.requestType)
    });

    for (const file of req.files || []) {
      createServiceRequestAttachment({
        id: crypto.randomUUID(),
        serviceRequestId: serviceRequest.id,
        originalName: file.originalname,
        storedName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size
      });
    }

    if (serviceRequest.totalCents > 0 && isSquareConfigured()) {
      try {
        const squarePaymentLink = await createSquarePaymentLinkForServiceRequest(serviceRequest);
        serviceRequest = updateServiceRequestSquarePaymentLink(serviceRequest.id, squarePaymentLink);
      } catch (error) {
        updateServiceRequest(serviceRequest.id, {
          status: "cancelled",
          paymentStatus: serviceRequest.paymentStatus,
          internalNotes: "Automatically cancelled because Square payment link creation failed."
        });
        throw error;
      }
    }

    const emailResult = await sendServiceRequestConfirmation(serviceRequest).catch((error) => {
      console.error("Service request confirmation email failed:", error.message);
      return { sent: false, reason: "email_failed" };
    });
    // Fire-and-forget: do not block the patient response on staff notification.
    sendServiceRequestAdminNotification(serviceRequest).catch((error) => {
      console.error("Admin service request notification failed:", error.message);
    });
    markPartialFormDraftSubmitted(toText(req.body.draftId));

    return res.status(201).json({
      serviceRequest: publicServiceRequest(serviceRequest),
      email: emailResult
    });
  } catch (error) {
    return next(error);
  }
});

function applySquarePaymentUpdate(orderId, paymentStatus, eventType) {
  if (!orderId) {
    return { matched: false, reason: "no_order_id" };
  }

  const booking = getBookingBySquareOrderId(orderId);
  if (booking) {
    if (booking.paymentStatus !== paymentStatus) {
      updateBooking(booking.id, {
        status: booking.status,
        paymentStatus,
        internalNotes: booking.internalNotes || ""
      });
      createBookingEvent({
        bookingId: booking.id,
        eventType: "square_webhook",
        summary: `Square ${eventType}: payment marked ${paymentStatus}.`,
        metadata: { orderId, paymentStatus, eventType }
      });
    }
    return { matched: true, type: "booking", reference: booking.reference };
  }

  const serviceRequest = getServiceRequestBySquareOrderId(orderId);
  if (serviceRequest) {
    if (serviceRequest.paymentStatus !== paymentStatus) {
      updateServiceRequest(serviceRequest.id, {
        status: serviceRequest.status,
        paymentStatus,
        internalNotes: serviceRequest.internalNotes || ""
      });
    }
    return { matched: true, type: "service_request", reference: serviceRequest.reference };
  }

  return { matched: false, reason: "no_match", orderId };
}

function handleSquareWebhookEvent(event) {
  const type = String(event?.type || "");
  const object = event?.data?.object || {};

  if (type.startsWith("payment.")) {
    const payment = object.payment || {};
    if (payment.status === "COMPLETED" || payment.status === "APPROVED") {
      return applySquarePaymentUpdate(payment.order_id, "paid", type);
    }
    return { matched: false, ignored: `payment status ${payment.status || "unknown"}` };
  }

  if (type.startsWith("refund.")) {
    const refund = object.refund || {};
    if (refund.status === "COMPLETED") {
      return applySquarePaymentUpdate(refund.order_id, "refunded", type);
    }
    return { matched: false, ignored: `refund status ${refund.status || "unknown"}` };
  }

  return { matched: false, ignored: `event ${type || "unknown"}` };
}

// Remember recently-processed Square event IDs so a replayed/duplicated
// delivery is acknowledged but not applied twice.
const processedSquareEvents = new Map();
const SQUARE_EVENT_TTL_MS = 24 * 60 * 60 * 1000;

function isDuplicateSquareEvent(eventId) {
  if (!eventId) return false;
  const now = Date.now();
  for (const [id, seenAt] of processedSquareEvents) {
    if (now - seenAt > SQUARE_EVENT_TTL_MS) processedSquareEvents.delete(id);
  }
  if (processedSquareEvents.has(eventId)) return true;
  processedSquareEvents.set(eventId, now);
  return false;
}

app.post("/api/square/webhook", (req, res) => {
  if (!isSquareWebhookConfigured()) {
    return res.status(400).json({ message: "Square webhook is not configured." });
  }

  const signature = req.headers["x-square-hmacsha256-signature"];
  const requestUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  if (!verifySquareWebhookSignature(req.rawBody, signature, requestUrl)) {
    return res.status(401).json({ message: "Invalid Square webhook signature." });
  }

  const eventId = (req.body && (req.body.event_id || req.body.id)) || "";
  if (isDuplicateSquareEvent(eventId)) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    const result = handleSquareWebhookEvent(req.body || {});
    return res.json({ received: true, ...result });
  } catch (error) {
    console.error("Square webhook handling failed:", error.message);
    // Acknowledge so Square does not retry a payload we simply could not process.
    return res.status(200).json({ received: true, error: "handler_failed" });
  }
});

app.get("/payment-return", (req, res) => {
  res.sendFile(path.join(publicDir, "payment-return.html"));
});

app.get(["/doctor-note", "/doctor-note.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "doctor-note.html"));
});

app.get(["/prescription-refill", "/prescription-refill.html"], (req, res) => {
  res.sendFile(path.join(publicDir, "prescription-refill.html"));
});

app.get("/manage-booking", (req, res) => {
  res.sendFile(path.join(publicDir, "manage-booking.html"));
});

app.get("/api/manage-booking", (req, res, next) => {
  try {
    const booking = requireManageToken(req.query.token);
    return res.json({ booking: publicBooking(booking) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/manage-booking/attachments", upload.array("attachments", 5), (req, res, next) => {
  try {
    const booking = requireManageToken(req.body.token);
    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Cancelled bookings cannot receive new attachments." });
    }

    if (!req.files?.length) {
      return res.status(400).json({
        message: "Please upload a PDF, image, Word document, or another accepted intake file."
      });
    }

    const attachments = (req.files || []).map((file) => createAttachment({
      id: crypto.randomUUID(),
      bookingId: booking.id,
      originalName: file.originalname,
      storedName: file.filename,
      mimeType: file.mimetype,
      sizeBytes: file.size
    }));

    return res.status(201).json({
      attachments: attachments.map(publicAttachment),
      booking: publicBooking(booking)
    });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/manage-booking/availability", (req, res, next) => {
  try {
    const booking = requireManageToken(req.query.token);
    const date = toText(req.query.date);
    if (!isValidIsoDate(date)) {
      return res.status(400).json({ message: "A valid date is required." });
    }

    const availableSlots = getSlotsForDate(date);
    const bookedCounts = getBookedSlotCounts(date, booking.id);
    const today = getTodayIsoInClinicTimeZone();

    return res.json({
      date,
      timezone: TIME_ZONE,
      slots: availableSlots.map((slot) => {
        const capacity = getSlotCapacity(date, slot);
        const booked = bookedCounts[slot] || 0;
        return {
          time: slot,
          capacity,
          booked,
          remaining: Math.max(0, capacity - booked),
          available: booking.status !== "cancelled" &&
            date >= today &&
            isSlotBookable(date, slot) &&
            booked < capacity
        };
      })
    });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/manage-booking/reschedule", (req, res, next) => {
  try {
    const booking = requireManageToken(req.body.token);
    const appointmentDate = toText(req.body.appointmentDate);
    const appointmentTime = toText(req.body.appointmentTime);

    validateManagedAppointment(booking, appointmentDate, appointmentTime);

    const updatedBooking = rescheduleManagedBooking(booking.id, appointmentDate, appointmentTime);
    createBookingEvent({
      bookingId: booking.id,
      eventType: "rescheduled",
      summary: `Patient rescheduled from ${booking.appointmentDate} ${booking.appointmentTime} to ${appointmentDate} ${appointmentTime}.`,
      metadata: {
        fromDate: booking.appointmentDate,
        fromTime: booking.appointmentTime,
        toDate: appointmentDate,
        toTime: appointmentTime
      }
    });
    sendBookingRescheduleConfirmation(updatedBooking)
      .then((result) => createBookingEvent({
        bookingId: booking.id,
        eventType: result.sent ? "reschedule_email_sent" : "reschedule_email_not_sent",
        summary: result.sent ? "Reschedule confirmation email sent to patient." : `Reschedule confirmation email not sent (${result.reason || "unknown reason"}).`,
        metadata: result
      }))
      .catch((error) => {
        console.error("Reschedule confirmation email failed:", error.message);
        createBookingEvent({
          bookingId: booking.id,
          eventType: "reschedule_email_failed",
          summary: "Reschedule confirmation email failed.",
          metadata: { error: error.message }
        });
      });
    // Notify the clinic/doctors that a patient moved their appointment.
    sendBookingRescheduleAdminNotification(updatedBooking, {
      fromDate: booking.appointmentDate,
      fromTime: booking.appointmentTime
    }).catch((error) => console.error("Reschedule staff notification failed:", error.message));
    return res.json({ booking: publicBooking(updatedBooking) });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE" || error.code === "SLOT_FULL") {
      return res.status(409).json({
        message: "That appointment time was just booked. Please choose another time."
      });
    }
    return next(error);
  }
});

app.post("/api/manage-booking/cancel", (req, res, next) => {
  try {
    const booking = requireManageToken(req.body.token);
    const policy = getCancellationPolicy();
    validatePatientCancellation(booking, policy);
    const updatedBooking = cancelManagedBooking(booking.id);
    createBookingEvent({
      bookingId: booking.id,
      eventType: "cancelled",
      summary: "Patient cancelled using their confirmation email manage link.",
      metadata: { source: "patient_manage_link" }
    });
    if (policy.sendCancellationEmail) {
      sendBookingCancellation(updatedBooking, policy)
        .then((result) => createBookingEvent({
          bookingId: booking.id,
          eventType: result.sent ? "cancellation_email_sent" : "cancellation_email_not_sent",
          summary: result.sent ? "Cancellation email sent to patient." : `Cancellation email not sent (${result.reason || "unknown reason"}).`,
          metadata: result
        }))
        .catch((error) => {
          console.error("Cancellation email failed:", error.message);
          createBookingEvent({
            bookingId: booking.id,
            eventType: "cancellation_email_failed",
            summary: "Cancellation email failed.",
            metadata: { error: error.message }
          });
        });
    }
    // Always tell the clinic/doctors a patient cancelled (independent of the
    // patient-facing cancellation email toggle).
    sendBookingCancellationAdminNotification(updatedBooking)
      .catch((error) => console.error("Cancellation staff notification failed:", error.message));
    return res.json({ booking: publicBooking(updatedBooking) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/bookings", requireAdmin, (req, res) => {
  res.json({
    bookings: listBookings({
      status: toText(req.query.status),
      date: toText(req.query.date),
      query: toText(req.query.q)
    }).map(adminBooking)
  });
});

app.get("/api/admin/marketing-leads", requireAdmin, (req, res) => {
  res.json({
    leads: listPartialFormDrafts({
      status: toText(req.query.status),
      formType: toText(req.query.formType),
      query: toText(req.query.q)
    })
  });
});

app.patch("/api/admin/marketing-leads/:id", requireAdmin, (req, res) => {
  const status = toText(req.body.status);
  if (!["active", "submitted", "archived"].includes(status)) {
    return res.status(400).json({ message: "Invalid marketing lead status." });
  }

  const lead = updatePartialFormDraftStatus(req.params.id, status);
  if (!lead) {
    return res.status(404).json({ message: "Marketing lead not found." });
  }

  return res.json({ lead });
});

app.get("/api/admin/service-requests", requireAdmin, (req, res) => {
  res.json({
    serviceRequests: listServiceRequests({
      status: toText(req.query.status),
      requestType: toText(req.query.requestType),
      query: toText(req.query.q)
    }).map(adminServiceRequest)
  });
});

app.get("/api/admin/services", requireAdmin, (req, res) => {
  res.json({
    services: getProducts({ includeDisabled: true }),
    careOptionProductMap: getCareOptionProductMap({ includeDisabled: true })
  });
});

app.patch("/api/admin/services", requireAdmin, (req, res) => {
  try {
    const services = normalizeServiceCatalog(req.body.services || []);
    setSetting(SERVICE_CATALOG_KEY, JSON.stringify(services));
    return res.json({
      services: getProducts({ includeDisabled: true }),
      careOptionProductMap: getCareOptionProductMap({ includeDisabled: true })
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Services could not be saved."
    });
  }
});

app.get("/api/admin/waitlist", requireAdmin, (req, res) => {
  res.json({
    waitlistEntries: listWaitlistEntries({
      status: toText(req.query.status),
      date: toText(req.query.date),
      query: toText(req.query.q)
    })
  });
});

app.patch("/api/admin/waitlist/:id", requireAdmin, (req, res) => {
  const status = toText(req.body.status);
  if (!["new", "offered", "booked", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Invalid waitlist status." });
  }

  const entry = updateWaitlistEntry(req.params.id, {
    status,
    desiredTime: toText(req.body.desiredTime),
    notes: toText(req.body.notes).slice(0, 1000)
  });
  if (!entry) {
    return res.status(404).json({ message: "Waitlist entry not found." });
  }

  return res.json({ waitlistEntry: entry });
});

app.get("/api/admin/cancellation-policy", requireAdmin, (req, res) => {
  res.json({ policy: getCancellationPolicy() });
});

app.patch("/api/admin/cancellation-policy", requireAdmin, (req, res) => {
  try {
    const policy = normalizeCancellationPolicy(req.body || {});
    setSetting(CANCELLATION_POLICY_KEY, JSON.stringify(policy));
    return res.json({ policy: getCancellationPolicy() });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Cancellation policy could not be saved."
    });
  }
});

app.get("/api/admin/dashboard-stats", requireAdmin, (req, res) => {
  res.json({ stats: getDashboardStats() });
});

app.get("/api/admin/slot-control", requireAdmin, (req, res) => {
  const date = toText(req.query.date);
  if (!isValidIsoDate(date)) {
    return res.status(400).json({ message: "A valid date is required." });
  }

  return res.json(slotControlPayload(date));
});

app.patch("/api/admin/slot-control", requireAdmin, (req, res) => {
  const date = toText(req.body.date);
  const time = normalizeSlotLabel(req.body.time);
  const status = toText(req.body.status).toLowerCase();
  const capacity = normalizeSlotCapacity(req.body.capacity);

  if (!isValidIsoDate(date)) {
    return res.status(400).json({ message: "A valid date is required." });
  }

  if (!time) {
    return res.status(400).json({ message: "A valid time is required." });
  }

  if (!["open", "closed"].includes(status)) {
    return res.status(400).json({ message: "Slot status must be Open or Closed." });
  }

  const schedule = getScheduleConfig();
  schedule.slotOverrides = schedule.slotOverrides || {};
  schedule.slotOverrides[date] = schedule.slotOverrides[date] || {};
  schedule.slotOverrides[date][time] = { status, capacity };
  setSetting(SCHEDULE_SETTING_KEY, JSON.stringify(normalizeScheduleConfig(schedule)));

  return res.json(slotControlPayload(date));
});

app.get("/api/admin/attachments/:id", requireAdmin, (req, res) => {
  const attachment = getAttachment(req.params.id);
  if (!attachment) {
    return res.status(404).send("Attachment not found.");
  }

  return res.download(path.join(uploadDir, attachment.storedName), attachment.originalName);
});

app.get("/api/admin/service-request-attachments/:id", requireAdmin, (req, res) => {
  const attachment = getServiceRequestAttachment(req.params.id);
  if (!attachment) {
    return res.status(404).send("Attachment not found.");
  }

  return res.download(path.join(uploadDir, attachment.storedName), attachment.originalName);
});

app.get("/api/admin/reminder-settings", requireAdmin, (req, res) => {
  res.json({
    reminderMinutesBefore: getReminderMinutesBefore(),
    remindersEnabled: String(process.env.REMINDERS_ENABLED || "true").toLowerCase() !== "false",
    emailConfigured: isEmailConfigured(),
    smsConfigured: isSmsConfigured()
  });
});

app.get("/api/admin/email-settings", requireAdmin, (req, res) => {
  res.json({
    settings: publicEmailSettings()
  });
});

app.patch("/api/admin/email-settings", requireAdmin, (req, res) => {
  try {
    const settings = emailSettingsFromBody(req.body || {});
    setSetting(EMAIL_SETTINGS_KEY, JSON.stringify(settings));
    return res.json({
      settings: publicEmailSettings(getEmailSettings())
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Email settings could not be saved."
    });
  }
});

app.post("/api/admin/email-settings/test", requireAdmin, async (req, res) => {
  try {
    const to = toText(req.body.to);
    if (!isEmail(to)) {
      return res.status(400).json({ message: "Enter a valid test email address." });
    }

    await sendTestEmail(to);
    return res.json({ sent: true });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Test email could not be sent."
    });
  }
});

app.get("/api/admin/schedule-settings", requireAdmin, (req, res) => {
  res.json({
    dayKeys: DAY_KEYS,
    timezone: TIME_ZONE,
    schedule: getScheduleConfig()
  });
});

app.patch("/api/admin/schedule-settings", requireAdmin, (req, res) => {
  try {
    const schedule = normalizeScheduleConfig(req.body.schedule || {});
    setSetting(SCHEDULE_SETTING_KEY, JSON.stringify(schedule));
    return res.json({
      dayKeys: DAY_KEYS,
      timezone: TIME_ZONE,
      schedule: getScheduleConfig()
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Schedule settings could not be saved."
    });
  }
});

app.patch("/api/admin/reminder-settings", requireAdmin, (req, res) => {
  const reminderMinutesBefore = Number(req.body.reminderMinutesBefore);

  if (!Number.isFinite(reminderMinutesBefore) || reminderMinutesBefore < 1 || reminderMinutesBefore > 1440) {
    return res.status(400).json({
      message: "Reminder time must be between 1 and 1440 minutes."
    });
  }

  setSetting(REMINDER_SETTING_KEY, String(Math.round(reminderMinutesBefore)));
  return res.json({
    reminderMinutesBefore: getReminderMinutesBefore(),
    remindersEnabled: String(process.env.REMINDERS_ENABLED || "true").toLowerCase() !== "false",
    emailConfigured: isEmailConfigured(),
    smsConfigured: isSmsConfigured()
  });
});

app.patch("/api/admin/bookings/:id", requireAdmin, (req, res, next) => {
  try {
    const status = toText(req.body.status);
    const paymentStatus = toText(req.body.paymentStatus);
    const existingBooking = getBookingById(req.params.id);

    if (!["new", "confirmed", "completed", "cancelled", "no_show"].includes(status)) {
      return res.status(400).json({ message: "Invalid booking status." });
    }

    if (!["not_required", "pending", "paid", "refunded"].includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid payment status." });
    }

    if (!existingBooking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    const booking = updateBooking(req.params.id, {
      status,
      paymentStatus,
      internalNotes: toText(req.body.internalNotes)
    });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found." });
    }

    createBookingEvent({
      bookingId: booking.id,
      eventType: "admin_update",
      summary: `Admin updated status to ${status} and payment to ${paymentStatus}.`,
      metadata: {
        previousStatus: existingBooking.status,
        previousPaymentStatus: existingBooking.paymentStatus,
        status,
        paymentStatus
      }
    });

    const cancellationPolicy = getCancellationPolicy();
    if (existingBooking.status !== "cancelled" && status === "cancelled" && cancellationPolicy.sendCancellationEmail) {
      sendBookingCancellation(booking, cancellationPolicy)
        .then((result) => createBookingEvent({
          bookingId: booking.id,
          eventType: result.sent ? "cancellation_email_sent" : "cancellation_email_not_sent",
          summary: result.sent ? "Cancellation email sent after admin cancellation." : `Cancellation email not sent (${result.reason || "unknown reason"}).`,
          metadata: result
        }))
        .catch((error) => {
          console.error("Admin cancellation email failed:", error.message);
          createBookingEvent({
            bookingId: booking.id,
            eventType: "cancellation_email_failed",
            summary: "Cancellation email failed after admin cancellation.",
            metadata: { error: error.message }
          });
        });
    }

    return res.json({ booking: adminBooking(booking) });
  } catch (error) {
    return next(error);
  }
});

app.post("/api/admin/bookings/:id/free-slot", requireAdmin, (req, res, next) => {
  try {
    const existingBooking = getBookingById(req.params.id);
    if (!existingBooking) {
      return res.status(404).json({ message: "Booking not found." });
    }
    if (existingBooking.status === "cancelled") {
      return res.status(400).json({ message: "This booking is already cancelled." });
    }

    const noteLine = `Slot freed by admin on ${new Date().toISOString()}.`;
    const internalNotes = [existingBooking.internalNotes, noteLine].filter(Boolean).join("\n");
    cancelManagedBooking(existingBooking.id);
    const booking = updateBooking(existingBooking.id, {
      status: "cancelled",
      paymentStatus: existingBooking.paymentStatus,
      internalNotes
    });
    createBookingEvent({
      bookingId: booking.id,
      eventType: "cancelled",
      summary: "Slot freed by admin. Booking was cancelled so the time can be booked again.",
      metadata: { source: "admin_free_slot" }
    });

    return res.json({ booking: adminBooking(booking) });
  } catch (error) {
    return next(error);
  }
});

app.patch("/api/admin/service-requests/:id", requireAdmin, (req, res, next) => {
  try {
    const status = toText(req.body.status);
    const paymentStatus = toText(req.body.paymentStatus);

    if (!["new", "in_review", "completed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid request status." });
    }

    if (!["pending", "paid", "refunded"].includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid payment status." });
    }

    const serviceRequest = updateServiceRequest(req.params.id, {
      status,
      paymentStatus,
      internalNotes: toText(req.body.internalNotes)
    });
    if (!serviceRequest) {
      return res.status(404).json({ message: "Service request not found." });
    }

    return res.json({ serviceRequest: adminServiceRequest(serviceRequest) });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/admin/export.csv", requireAdmin, (req, res) => {
  const bookings = listBookings({
    status: toText(req.query.status),
    date: toText(req.query.date),
    query: toText(req.query.q)
  });
  const headers = [
    "reference",
    "createdAt",
    "status",
    "paymentStatus",
    "firstName",
    "lastName",
    "phone",
    "email",
    "appointmentDate",
    "appointmentTime",
    "totalCents",
    "internalNotes",
    "products"
  ];

  const escapeCsv = (value) => {
    let text = String(value ?? "");
    // Neutralize spreadsheet formula injection: a cell starting with = + - @
    // (or a leading tab/CR) is treated as a formula by Excel/Sheets.
    if (/^[=+\-@\t\r]/.test(text)) {
      text = `'${text}`;
    }
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = bookings.map((booking) =>
    headers.map((header) => {
      if (header === "products") {
        return escapeCsv(booking.products.map((product) => product.name).join("; "));
      }
      return escapeCsv(booking[header]);
    }).join(",")
  );

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=telepluscare-bookings.csv");
  res.send([headers.join(","), ...rows].join("\n"));
});

function escapeIcs(value) {
  return String(value || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function appointmentToIcsDate(booking) {
  const [year, month, day] = booking.appointmentDate.split("-");
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(booking.appointmentTime);
  if (!match) {
    return `${year}${month}${day}T000000`;
  }
  let hours = Number(match[1]);
  const minutes = match[2];
  if (match[3] === "PM" && hours !== 12) hours += 12;
  if (match[3] === "AM" && hours === 12) hours = 0;
  return `${year}${month}${day}T${String(hours).padStart(2, "0")}${minutes}00`;
}

app.get("/api/admin/calendar.ics", requireAdmin, (req, res) => {
  const bookings = listBookings({ status: toText(req.query.status), date: toText(req.query.date), query: toText(req.query.q) })
    .filter((booking) => booking.status !== "cancelled" && booking.appointmentDate && booking.appointmentTime);
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const events = bookings.map((booking) => {
    const start = appointmentToIcsDate(booking);
    return [
      "BEGIN:VEVENT",
      `UID:${booking.id}@telepluscare-booking`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=${booking.timezone}:${start}`,
      `SUMMARY:${escapeIcs(`TelePlus Care - ${booking.firstName} ${booking.lastName}`)}`,
      `DESCRIPTION:${escapeIcs(`${booking.reference}\\n${booking.email}\\n${booking.phone}\\n${booking.products.map((product) => product.name).join(", ")}`)}`,
      `STATUS:${booking.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
      "END:VEVENT"
    ].join("\r\n");
  });

  res.setHeader("Content-Type", "text/calendar");
  res.setHeader("Content-Disposition", "attachment; filename=telepluscare-bookings.ics");
  res.send([
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TelePlus Care//Booking System//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR"
  ].join("\r\n"));
});

app.get(["/admin", "/admin.html"], requireAdmin, (req, res) => {
  res.sendFile(path.join(publicDir, "admin.html"));
});

app.use(express.static(publicDir, { index: false }));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  res.status(status).json({
    message: error.message || "Something went wrong.",
    details: error.details || undefined
  });
});

app.listen(port, () => {
  console.log(`TelePlus Care booking system running at http://localhost:${port}`);
  console.log(`Admin page: http://localhost:${port}/admin`);
  if (isSquareWebhookConfigured()) {
    console.log(`Square webhook endpoint: ${getSquareWebhookUrl()}`);
  }
  startReminderService();
});
