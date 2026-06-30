const nodemailer = require("nodemailer");

const { getSetting } = require("./database");

const EMAIL_SETTINGS_KEY = "email_settings";

const DEFAULT_EMAIL_SETTINGS = {
  smtpEnabled: true,
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPass: "",
  smtpFrom: "TelePlus Care <booking@telepluscare.com>",
  smtpReplyTo: "booking@telepluscare.com",
  patientConfirmationsEnabled: true,
  serviceRequestConfirmationsEnabled: true,
  reminderEmailsEnabled: true,
  adminNotificationsEnabled: true,
  adminNotificationEmails: "booking@telepluscare.com",
  appointmentSubject: "TelePlus Care appointment {reference}",
  appointmentIntro: "Your TelePlus Care appointment request has been received.",
  serviceRequestSubject: "TelePlus Care request {reference}",
  serviceRequestIntro: "Your TelePlus Care {serviceName} request has been received.",
  reminderSubject: "Reminder: TelePlus Care appointment {reference}",
  reminderIntro: "Your TelePlus Care appointment is coming up.",
  adminBookingSubject: "New booking: {reference} - {patientName}",
  adminServiceRequestSubject: "New service request: {reference} - {patientName}",
  // Link shown to patients in confirmation emails so they can read the refund /
  // cancellation policy. Clinic can change this in Admin → Emails & Reminders.
  refundPolicyUrl: "https://telepluscare.com/refund-policy/"
};

function toText(value) {
  return String(value || "").trim();
}

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

function splitEmails(value) {
  return toText(value)
    .split(/\n|,|;/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function envEmailSettings() {
  return {
    smtpEnabled: true,
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: process.env.SMTP_PORT || 587,
    smtpSecure: process.env.SMTP_SECURE || "",
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    smtpFrom: process.env.SMTP_FROM || DEFAULT_EMAIL_SETTINGS.smtpFrom,
    smtpReplyTo: process.env.SMTP_REPLY_TO || process.env.SMTP_FROM || DEFAULT_EMAIL_SETTINGS.smtpReplyTo,
    adminNotificationEmails: process.env.ADMIN_NOTIFICATION_EMAILS || DEFAULT_EMAIL_SETTINGS.adminNotificationEmails
  };
}

function normalizeEmailSettings(rawSettings = {}) {
  const merged = {
    ...DEFAULT_EMAIL_SETTINGS,
    ...rawSettings
  };
  const smtpPort = readInteger(merged.smtpPort, 587, 1, 65535);

  return {
    smtpEnabled: readBoolean(merged.smtpEnabled, true),
    smtpHost: toText(merged.smtpHost).slice(0, 180),
    smtpPort,
    smtpSecure: readBoolean(merged.smtpSecure, smtpPort === 465),
    smtpUser: toText(merged.smtpUser).slice(0, 180),
    smtpPass: String(merged.smtpPass || ""),
    smtpFrom: toText(merged.smtpFrom).slice(0, 250),
    smtpReplyTo: toText(merged.smtpReplyTo).slice(0, 250),
    patientConfirmationsEnabled: readBoolean(merged.patientConfirmationsEnabled, true),
    serviceRequestConfirmationsEnabled: readBoolean(merged.serviceRequestConfirmationsEnabled, true),
    reminderEmailsEnabled: readBoolean(merged.reminderEmailsEnabled, true),
    adminNotificationsEnabled: readBoolean(merged.adminNotificationsEnabled, true),
    adminNotificationEmails: splitEmails(merged.adminNotificationEmails).join("\n").slice(0, 1000),
    appointmentSubject: toText(merged.appointmentSubject || DEFAULT_EMAIL_SETTINGS.appointmentSubject).slice(0, 180),
    appointmentIntro: toText(merged.appointmentIntro || DEFAULT_EMAIL_SETTINGS.appointmentIntro).slice(0, 1200),
    serviceRequestSubject: toText(merged.serviceRequestSubject || DEFAULT_EMAIL_SETTINGS.serviceRequestSubject).slice(0, 180),
    serviceRequestIntro: toText(merged.serviceRequestIntro || DEFAULT_EMAIL_SETTINGS.serviceRequestIntro).slice(0, 1200),
    reminderSubject: toText(merged.reminderSubject || DEFAULT_EMAIL_SETTINGS.reminderSubject).slice(0, 180),
    reminderIntro: toText(merged.reminderIntro || DEFAULT_EMAIL_SETTINGS.reminderIntro).slice(0, 1200),
    adminBookingSubject: toText(merged.adminBookingSubject || DEFAULT_EMAIL_SETTINGS.adminBookingSubject).slice(0, 180),
    adminServiceRequestSubject: toText(merged.adminServiceRequestSubject || DEFAULT_EMAIL_SETTINGS.adminServiceRequestSubject).slice(0, 180),
    refundPolicyUrl: toText(merged.refundPolicyUrl).slice(0, 300)
  };
}

function readStoredEmailSettings() {
  try {
    const value = getSetting(EMAIL_SETTINGS_KEY, "");
    return value ? JSON.parse(value) : {};
  } catch (error) {
    return {};
  }
}

// Drop blank values so an upper layer (env, then DB) only overrides a lower
// layer when it actually carries a value. Without this, a stored settings row
// with empty SMTP fields would clobber a valid .env configuration.
function withoutBlanks(settings) {
  const result = {};
  for (const [key, value] of Object.entries(settings || {})) {
    if (value === "" || value === null || value === undefined) {
      continue;
    }
    result[key] = value;
  }
  return result;
}

function getEmailSettings() {
  return normalizeEmailSettings({
    ...DEFAULT_EMAIL_SETTINGS,
    ...withoutBlanks(envEmailSettings()),
    ...withoutBlanks(readStoredEmailSettings())
  });
}

function publicEmailSettings(settings = getEmailSettings()) {
  return {
    ...settings,
    smtpPass: "",
    smtpPasswordSet: Boolean(settings.smtpPass),
    emailConfigured: isEmailConfigured(settings)
  };
}

function isEmailConfigured(settings = getEmailSettings()) {
  return Boolean(settings.smtpEnabled && settings.smtpHost && settings.smtpFrom);
}

function createTransporter(settings = getEmailSettings()) {
  const auth = settings.smtpUser
    ? {
        user: settings.smtpUser,
        pass: settings.smtpPass || ""
      }
    : undefined;

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.smtpSecure || settings.smtpPort === 465,
    auth
  });
}

function productLines(booking) {
  return booking.products
    .map((product) => {
      const quantity = product.quantity > 1 ? ` x ${product.quantity}` : "";
      return `${product.name}${quantity}`;
    })
    .join(", ");
}

function formatCad(cents) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD"
  }).format(cents / 100);
}

function serviceRequestLabel(requestType) {
  const labels = {
    doctor_note: "Doctor Note Service",
    prescription_refill: "Prescription Refill"
  };
  return labels[requestType] || "TelePlus Care Service";
}

function replaceTokens(template, values) {
  return String(template || "").replace(/\{([A-Za-z0-9_]+)\}/g, (match, key) => {
    return values[key] ?? match;
  });
}

function paragraphHtml(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

const BRAND = {
  name: "TelePlus Care",
  // Accent matches the purple "tele+" logo so emails feel on-brand.
  accent: "#7a2d8f",
  accentDark: "#5e2270",
  ink: "#2b2733",
  muted: "#6b6577",
  line: "#ece6f1",
  bg: "#f4f0f7",
  danger: "#c0392b",
  phone: "587-442-4898",
  email: "booking@telepluscare.com",
  // Email images must load from a PUBLIC url (a recipient's inbox can't reach
  // localhost). Prefer EMAIL_LOGO_URL; fall back to the app's own /images path.
  logoUrl: process.env.EMAIL_LOGO_URL
    || `${(process.env.APP_BASE_URL || "").replace(/\/$/, "")}/images/telepluscare-logo.webp`
};

function formatLongDate(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) {
    return String(isoDate || "");
  }
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return String(isoDate);
  }
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function paymentLabel(status) {
  const labels = {
    paid: "Paid ✓",
    pending: "Payment pending",
    not_required: "No payment needed",
    refunded: "Refunded"
  };
  return labels[status] || status || "";
}

function totalLabel(totalCents) {
  return totalCents > 0 ? `${formatCad(totalCents)} CAD` : "No charge";
}

function titleCase(value) {
  const text = toText(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function fullAddressLine(booking) {
  return [booking.streetAddress, booking.city, booking.province, booking.postalCode]
    .map((part) => toText(part))
    .filter(Boolean)
    .join(", ");
}

function healthCardValue(booking) {
  const raw = toText(booking.activeHealthCard).toLowerCase();
  const isYes = ["yes", "true", "1", "y"].includes(raw);
  if (isYes) {
    return booking.phn ? `Yes (PHN ${toText(booking.phn)})` : "Yes";
  }
  return raw ? titleCase(toText(booking.activeHealthCard)) : "Not provided";
}

function appointmentWhenText(booking) {
  return (!booking.appointmentDate || !booking.appointmentTime)
    ? "Our team will contact you soon to arrange the time"
    : `${booking.appointmentDate} at ${booking.appointmentTime} (${booking.timezone})`;
}

// Every field captured on the booking form — shared by the patient confirmation
// and the staff notification so both show the complete record.
function bookingDetailRows(booking) {
  const whenRow = (!booking.appointmentDate || !booking.appointmentTime)
    ? ["When", "Our team will contact you <strong>soon</strong> to arrange the time."]
    : ["When", `${escapeHtml(formatLongDate(booking.appointmentDate))}<br>${escapeHtml(booking.appointmentTime)} &middot; ${escapeHtml(booking.timezone)}`];

  return [
    booking.careOption ? ["Appointment type", escapeHtml(booking.careOption)] : null,
    ["Patient", escapeHtml(`${booking.firstName} ${booking.lastName}`)],
    booking.gender ? ["Gender", escapeHtml(titleCase(booking.gender))] : null,
    booking.dateOfBirth ? ["Date of birth", escapeHtml(booking.dateOfBirth)] : null,
    ["Phone", escapeHtml(booking.phone)],
    ["Email", `<a href="mailto:${escapeHtml(booking.email)}" style="color:${BRAND.accent}; text-decoration:none;">${escapeHtml(booking.email)}</a>`],
    fullAddressLine(booking) ? ["Address", escapeHtml(fullAddressLine(booking))] : null,
    booking.reminderPreference ? ["Reminder by", escapeHtml(titleCase(booking.reminderPreference))] : null,
    ["Alberta Health Card", escapeHtml(healthCardValue(booking))],
    whenRow,
    ["Service", escapeHtml(productLines(booking))],
    ["Total", escapeHtml(totalLabel(booking.totalCents))],
    booking.paymentStatus === "not_required" ? null : ["Payment", escapeHtml(paymentLabel(booking.paymentStatus))],
    booking.visitReason ? ["Reason for visit", paragraphHtml(booking.visitReason)] : null,
    ["Reference", escapeHtml(booking.reference)]
  ].filter(Boolean);
}

// Plain-text equivalent of bookingDetailRows for the text/multipart body.
function bookingDetailText(booking) {
  const lines = [];
  if (booking.careOption) lines.push(`Appointment type: ${booking.careOption}`);
  lines.push(`Patient: ${booking.firstName} ${booking.lastName}`);
  if (booking.gender) lines.push(`Gender: ${titleCase(booking.gender)}`);
  if (booking.dateOfBirth) lines.push(`Date of birth: ${booking.dateOfBirth}`);
  lines.push(`Phone: ${booking.phone}`);
  lines.push(`Email: ${booking.email}`);
  const address = fullAddressLine(booking);
  if (address) lines.push(`Address: ${address}`);
  if (booking.reminderPreference) lines.push(`Reminder by: ${titleCase(booking.reminderPreference)}`);
  lines.push(`Alberta Health Card: ${healthCardValue(booking)}`);
  lines.push(`Appointment: ${appointmentWhenText(booking)}`);
  lines.push(`Service: ${productLines(booking)}`);
  lines.push(`Total: ${totalLabel(booking.totalCents)}`);
  if (booking.paymentStatus !== "not_required") {
    lines.push(`Payment: ${paymentLabel(booking.paymentStatus)}`);
  }
  if (booking.visitReason) lines.push(`Reason for visit: ${booking.visitReason}`);
  lines.push(`Reference: ${booking.reference}`);
  return lines.join("\n");
}

// One reusable, mobile-friendly, table-based shell so every email looks the same.
function emailLayout({ heading, preheader = "", bodyHtml }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
</head>
<body style="margin:0; padding:0; background:${BRAND.bg};">
<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg}; padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 6px 22px rgba(122,45,143,0.12); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      <tr><td align="center" style="background:#ffffff; padding:26px 32px 20px; border-bottom:3px solid ${BRAND.accent};">
        <img src="${BRAND.logoUrl}" width="64" height="64" alt="TelePlus Care" style="display:block; border:0; outline:none; width:64px; height:64px;">
      </td></tr>
      <tr><td style="padding:30px 32px 8px;">
        <h1 style="margin:0 0 16px; font-size:23px; line-height:1.3; color:${BRAND.ink};">${heading}</h1>
        ${bodyHtml}
      </td></tr>
      <tr><td style="padding:20px 32px 28px; border-top:1px solid ${BRAND.line};">
        <p style="margin:0 0 6px; font-size:13px; color:${BRAND.muted};">Need help? Call <a href="tel:5874424898" style="color:${BRAND.accent}; text-decoration:none;">${BRAND.phone}</a> or email <a href="mailto:${BRAND.email}" style="color:${BRAND.accent}; text-decoration:none;">${BRAND.email}</a>.</p>
        <p style="margin:0; font-size:13px; color:${BRAND.danger};"><strong>Medical emergency? Call 911 immediately.</strong></p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0; font-size:12px; color:${BRAND.muted}; font-family:Arial,sans-serif;">&copy; TelePlus Care</p>
  </td></tr>
</table>
</body>
</html>`;
}

function greetingHtml(firstName) {
  return `<p style="margin:0 0 14px; font-size:16px; color:${BRAND.ink};">Hi ${escapeHtml(firstName)},</p>`;
}

function leadParagraph(text) {
  return `<p style="margin:0 0 18px; font-size:16px; line-height:1.55; color:${BRAND.muted};">${paragraphHtml(text)}</p>`;
}

function detailTable(rows) {
  const body = rows
    .filter(Boolean)
    .map(([label, valueHtml]) => `
      <tr>
        <td style="padding:11px 0; border-bottom:1px solid ${BRAND.line}; color:${BRAND.muted}; font-size:13px; vertical-align:top; width:38%;">${escapeHtml(label)}</td>
        <td style="padding:11px 0; border-bottom:1px solid ${BRAND.line}; color:${BRAND.ink}; font-size:15px; font-weight:600; vertical-align:top;">${valueHtml}</td>
      </tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px; border-collapse:collapse;">${body}</table>`;
}

function emailButton(label, url, variant = "primary") {
  const isPrimary = variant === "primary";
  const background = isPrimary ? BRAND.accent : "#ffffff";
  const color = isPrimary ? "#ffffff" : BRAND.accent;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;"><tr>
    <td style="border-radius:10px; background:${background};">
      <a href="${escapeHtml(url)}" style="display:inline-block; padding:14px 30px; font-size:16px; font-weight:700; color:${color}; text-decoration:none; border:2px solid ${BRAND.accent}; border-radius:10px;">${escapeHtml(label)}</a>
    </td></tr></table>`;
}

function buttonStack(buttonsHtml) {
  return `<div style="text-align:center; margin:24px 0 6px;">${buttonsHtml}</div>`;
}

function bookingTemplateValues(booking, manageUrl = "") {
  const patientName = `${booking.firstName} ${booking.lastName}`;
  return {
    firstName: booking.firstName,
    lastName: booking.lastName,
    patientName,
    reference: booking.reference,
    appointmentDate: booking.appointmentDate,
    appointmentTime: booking.appointmentTime,
    timezone: booking.timezone,
    service: productLines(booking),
    total: `${formatCad(booking.totalCents)} CAD`,
    paymentStatus: booking.paymentStatus,
    paymentUrl: booking.squarePaymentLinkUrl || "",
    manageUrl
  };
}

function serviceRequestTemplateValues(serviceRequest) {
  const patientName = `${serviceRequest.firstName} ${serviceRequest.lastName}`;
  const serviceName = serviceRequestLabel(serviceRequest.requestType);
  return {
    firstName: serviceRequest.firstName,
    lastName: serviceRequest.lastName,
    patientName,
    reference: serviceRequest.reference,
    serviceName,
    total: `${formatCad(serviceRequest.totalCents)} CAD`,
    paymentStatus: serviceRequest.paymentStatus,
    paymentUrl: serviceRequest.squarePaymentLinkUrl || "",
    noteStartDate: serviceRequest.noteStartDate || "",
    noteEndDate: serviceRequest.noteEndDate || ""
  };
}

function buildEmailContent(booking, manageUrl, settings = getEmailSettings()) {
  const refundPolicyUrl = toText(settings.refundPolicyUrl);
  // Deep-link straight to the "Change Appointment Time" section of the manage page.
  const changeUrl = manageUrl ? `${manageUrl}#rescheduleSection` : "";
  const values = { ...bookingTemplateValues(booking, manageUrl), refundPolicyUrl };
  const intro = replaceTokens(settings.appointmentIntro, values);
  const needsScheduling = !booking.appointmentDate || !booking.appointmentTime;
  const paymentLine = booking.squarePaymentLinkUrl
    ? `\nPay securely with Square: ${booking.squarePaymentLinkUrl}\n`
    : "";

  const text = `Hi ${booking.firstName},

${intro}

${bookingDetailText(booking)}
${paymentLine}
Change your appointment time or cancel (no login needed):
${changeUrl || manageUrl}
${refundPolicyUrl ? `\nRefund & cancellation policy: ${refundPolicyUrl}\n` : ""}
If you are experiencing a medical emergency, call 911 immediately.

TelePlus Care`;

  const hasPayment = Boolean(booking.squarePaymentLinkUrl);
  const buttons = hasPayment
    ? emailButton("Pay securely with Square", booking.squarePaymentLinkUrl, "primary") +
      emailButton("Change appointment time", changeUrl || manageUrl, "secondary")
    : emailButton("Change appointment time", changeUrl || manageUrl, "primary");

  const refundLineHtml = refundPolicyUrl
    ? `<p style="margin:12px 0 0; font-size:13px; line-height:1.5; color:${BRAND.muted};">Please review our <a href="${escapeHtml(refundPolicyUrl)}" style="color:${BRAND.accent}; text-decoration:underline;">refund &amp; cancellation policy</a> before your visit.</p>`
    : "";

  const html = emailLayout({
    heading: needsScheduling ? "Request received — we'll call you" : "Appointment request received",
    preheader: needsScheduling ? "We'll contact you soon to set your time." : `${formatLongDate(booking.appointmentDate)} at ${booking.appointmentTime}`,
    bodyHtml: `
      ${greetingHtml(booking.firstName)}
      ${leadParagraph(intro)}
      ${detailTable(bookingDetailRows(booking))}
      ${buttonStack(buttons)}
      <p style="margin:14px 0 0; font-size:13px; line-height:1.5; color:${BRAND.muted};">The button above opens your private booking page &mdash; change your time or cancel, no login needed. Please don't forward this link to anyone else.</p>
      ${refundLineHtml}
    `
  });

  return { text, html };
}

function buildReminderContent(booking, settings = getEmailSettings()) {
  const values = bookingTemplateValues(booking);
  const intro = replaceTokens(settings.reminderIntro, values);
  const text = `Hi ${booking.firstName},

${intro}

Reference: ${booking.reference}
Appointment: ${booking.appointmentDate} at ${booking.appointmentTime} (${booking.timezone})
Patient: ${values.patientName}
Service: ${productLines(booking)}

If you are experiencing a medical emergency, call 911 immediately.

TelePlus Care`;

  const html = emailLayout({
    heading: "Reminder: your appointment is coming up",
    preheader: `${formatLongDate(booking.appointmentDate)} at ${booking.appointmentTime}`,
    bodyHtml: `
      ${greetingHtml(booking.firstName)}
      ${leadParagraph(intro)}
      ${detailTable([
        booking.appointmentDate && booking.appointmentTime
          ? ["When", `${escapeHtml(formatLongDate(booking.appointmentDate))}<br>${escapeHtml(booking.appointmentTime)} &middot; ${escapeHtml(booking.timezone)}`]
          : ["When", "Not yet scheduled — callback request (we'll contact you soon)"],
        ["Service", escapeHtml(productLines(booking))],
        ["Reference", escapeHtml(booking.reference)]
      ])}
      <p style="margin:6px 0 0; font-size:14px; line-height:1.55; color:${BRAND.muted};">Need to change or cancel? Use the private link in your original confirmation email, or call us at ${BRAND.phone}.</p>
    `
  });

  return { text, html };
}

function buildCancellationContent(booking, policy = {}) {
  const values = bookingTemplateValues(booking);
  const policyText = policy.policyText || "If a refund applies, TelePlus Care will process it according to clinic policy.";
  const text = `Hi ${booking.firstName},

Your TelePlus Care appointment has been cancelled.

Reference: ${booking.reference}
Appointment: ${booking.appointmentDate} at ${booking.appointmentTime} (${booking.timezone})
Patient: ${values.patientName}
Service: ${productLines(booking)}

Policy:
${policyText}

If you need help rebooking, call 587-442-4898 or email booking@telepluscare.com.

TelePlus Care`;

  const html = emailLayout({
    heading: "Your appointment was cancelled",
    preheader: `Cancelled: ${formatLongDate(booking.appointmentDate)} at ${booking.appointmentTime}`,
    bodyHtml: `
      ${greetingHtml(booking.firstName)}
      ${leadParagraph("Your TelePlus Care appointment has been cancelled. The details of the cancelled booking are below.")}
      ${detailTable([
        booking.appointmentDate && booking.appointmentTime
          ? ["When", `${escapeHtml(formatLongDate(booking.appointmentDate))}<br>${escapeHtml(booking.appointmentTime)} &middot; ${escapeHtml(booking.timezone)}`]
          : ["When", "Not yet scheduled — callback request (we'll contact you soon)"],
        ["Service", escapeHtml(productLines(booking))],
        ["Reference", escapeHtml(booking.reference)]
      ])}
      <div style="margin:6px 0 0; padding:16px 18px; background:${BRAND.bg}; border-radius:10px;">
        <p style="margin:0 0 6px; font-size:13px; font-weight:700; color:${BRAND.ink};">Cancellation policy</p>
        <p style="margin:0; font-size:14px; line-height:1.55; color:${BRAND.muted};">${paragraphHtml(policyText)}</p>
      </div>
      <p style="margin:18px 0 0; font-size:14px; color:${BRAND.muted};">Want to rebook? Call us at ${BRAND.phone} or email ${BRAND.email}.</p>
    `
  });

  return { text, html };
}

function buildServiceRequestContent(serviceRequest, settings = getEmailSettings()) {
  const values = serviceRequestTemplateValues(serviceRequest);
  const intro = replaceTokens(settings.serviceRequestIntro, values);
  const dateRange = serviceRequest.noteStartDate
    ? `\nDoctor note dates: ${serviceRequest.noteStartDate} to ${serviceRequest.noteEndDate}\n`
    : "";
  const paymentLine = serviceRequest.squarePaymentLinkUrl
    ? `\nPay securely with Square: ${serviceRequest.squarePaymentLinkUrl}\n`
    : "";

  const text = `Hi ${serviceRequest.firstName},

${intro}

Reference: ${serviceRequest.reference}
Patient: ${values.patientName}
Total: ${formatCad(serviceRequest.totalCents)} CAD
Payment status: ${serviceRequest.paymentStatus}
${dateRange}${paymentLine}
Requests are processed during clinic working hours. To schedule or reschedule, call 587-442-4898 or email booking@telepluscare.com.

If you are experiencing a medical emergency, call 911 immediately.

TelePlus Care`;

  const buttons = serviceRequest.squarePaymentLinkUrl
    ? buttonStack(emailButton("Pay securely with Square", serviceRequest.squarePaymentLinkUrl, "primary"))
    : "";

  const html = emailLayout({
    heading: `${values.serviceName} request received`,
    preheader: `We received your ${values.serviceName} request.`,
    bodyHtml: `
      ${greetingHtml(serviceRequest.firstName)}
      ${leadParagraph(intro)}
      ${detailTable([
        ["Service", escapeHtml(values.serviceName)],
        serviceRequest.noteStartDate
          ? ["Note dates", `${escapeHtml(formatLongDate(serviceRequest.noteStartDate))} &ndash; ${escapeHtml(formatLongDate(serviceRequest.noteEndDate))}`]
          : null,
        ["Total", escapeHtml(totalLabel(serviceRequest.totalCents))],
        ["Payment", escapeHtml(paymentLabel(serviceRequest.paymentStatus))],
        ["Reference", escapeHtml(serviceRequest.reference)]
      ])}
      ${buttons}
      <p style="margin:14px 0 0; font-size:14px; line-height:1.55; color:${BRAND.muted};">Requests are processed during clinic working hours. Questions? Call ${BRAND.phone} or email ${BRAND.email}.</p>
    `
  });

  return { text, html };
}

function mailSender(settings) {
  return {
    from: settings.smtpFrom,
    replyTo: settings.smtpReplyTo || undefined
  };
}

async function sendBookingConfirmation(booking, manageUrl) {
  const settings = getEmailSettings();
  const values = bookingTemplateValues(booking, manageUrl);
  const subject = replaceTokens(settings.appointmentSubject, values);
  const { text, html } = buildEmailContent(booking, manageUrl, settings);

  if (!settings.patientConfirmationsEnabled) {
    return { sent: false, reason: "patient_confirmation_disabled" };
  }

  if (!isEmailConfigured(settings)) {
    console.log("Email is not configured. Confirmation email preview:");
    console.log(`To: ${booking.email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Manage booking: ${manageUrl}`);
    if (booking.squarePaymentLinkUrl) {
      console.log(`Square payment: ${booking.squarePaymentLinkUrl}`);
    }
    return { sent: false, reason: "email_not_configured" };
  }

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to: booking.email,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendPaymentRequest(booking, paymentUrl) {
  const settings = getEmailSettings();
  const amount = formatCad(booking.totalCents);
  const subject = `Payment requested — ${booking.reference}`;

  const text = `Hi ${booking.firstName},

TelePlus Care has requested a payment of ${amount} CAD for your booking ${booking.reference}.

Pay securely with Square:
${paymentUrl}

If you have already paid, you can ignore this message. Questions? Call ${BRAND.phone} or email ${BRAND.email}.

TelePlus Care`;

  if (!isEmailConfigured(settings)) {
    console.log("Email is not configured. Payment request preview:");
    console.log(`To: ${booking.email} | Amount: ${amount} CAD | Pay: ${paymentUrl}`);
    return { sent: false, reason: "email_not_configured" };
  }

  const html = emailLayout({
    heading: "Complete your payment",
    preheader: `A payment of ${amount} is requested for ${booking.reference}.`,
    bodyHtml: `
      ${greetingHtml(booking.firstName)}
      ${leadParagraph(`TelePlus Care has requested a payment of ${amount} CAD for your booking. You can pay securely with Square using the button below.`)}
      ${detailTable([
        ["Amount due", escapeHtml(`${amount} CAD`)],
        ["Service", escapeHtml(productLines(booking))],
        ["Reference", escapeHtml(booking.reference)]
      ])}
      ${buttonStack(emailButton("Pay securely with Square", paymentUrl, "primary"))}
      <p style="margin:14px 0 0; font-size:14px; line-height:1.55; color:${BRAND.muted};">Already paid? You can ignore this email. Questions? Call ${BRAND.phone} or email ${BRAND.email}.</p>
    `
  });

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to: booking.email,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendBookingRescheduleConfirmation(booking) {
  const settings = getEmailSettings();
  if (!settings.patientConfirmationsEnabled) {
    return { sent: false, reason: "patient_confirmation_disabled" };
  }

  const subject = `Appointment updated — ${booking.reference}`;
  const text = `Hi ${booking.firstName},

Your TelePlus Care appointment has been rescheduled.

New appointment: ${formatLongDate(booking.appointmentDate)} at ${booking.appointmentTime} (${booking.timezone})
Service: ${productLines(booking)}
Reference: ${booking.reference}

To make further changes, use the private link in your original confirmation email, or call ${BRAND.phone}.

If you are experiencing a medical emergency, call 911 immediately.

TelePlus Care`;

  const html = emailLayout({
    heading: "Your appointment was rescheduled",
    preheader: `New time: ${formatLongDate(booking.appointmentDate)} at ${booking.appointmentTime}`,
    bodyHtml: `
      ${greetingHtml(booking.firstName)}
      ${leadParagraph("Your TelePlus Care appointment has been moved. Here are your new details.")}
      ${detailTable([
        ["New date & time", `${escapeHtml(formatLongDate(booking.appointmentDate))}<br>${escapeHtml(booking.appointmentTime)} &middot; ${escapeHtml(booking.timezone)}`],
        ["Service", escapeHtml(productLines(booking))],
        ["Reference", escapeHtml(booking.reference)]
      ])}
      <p style="margin:6px 0 0; font-size:14px; line-height:1.55; color:${BRAND.muted};">To change or cancel again, use the private link in your original confirmation email, or call ${BRAND.phone}.</p>
    `
  });

  if (!isEmailConfigured(settings)) {
    console.log("Email is not configured. Reschedule email preview:");
    console.log(`To: ${booking.email}`);
    console.log(`Subject: ${subject}`);
    console.log(`New appointment: ${booking.appointmentDate} ${booking.appointmentTime}`);
    return { sent: false, reason: "email_not_configured" };
  }

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to: booking.email,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendAppointmentReminder(booking) {
  const settings = getEmailSettings();
  const values = bookingTemplateValues(booking);
  const subject = replaceTokens(settings.reminderSubject, values);
  const { text, html } = buildReminderContent(booking, settings);

  if (!settings.reminderEmailsEnabled) {
    return { sent: false, reason: "reminder_email_disabled" };
  }

  if (!isEmailConfigured(settings)) {
    console.log("Email is not configured. Reminder email preview:");
    console.log(`To: ${booking.email}`);
    console.log(`Subject: ${subject}`);
    console.log(`Appointment: ${booking.appointmentDate} ${booking.appointmentTime}`);
    return { sent: false, reason: "email_not_configured" };
  }

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to: booking.email,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendBookingCancellation(booking, policy = {}) {
  const settings = getEmailSettings();
  const subject = `TelePlus Care appointment cancelled ${booking.reference}`;
  const { text, html } = buildCancellationContent(booking, policy);

  if (!isEmailConfigured(settings)) {
    console.log("Email is not configured. Cancellation email preview:");
    console.log(`To: ${booking.email}`);
    console.log(`Subject: ${subject}`);
    return { sent: false, reason: "email_not_configured" };
  }

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to: booking.email,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendServiceRequestConfirmation(serviceRequest) {
  const settings = getEmailSettings();
  const values = serviceRequestTemplateValues(serviceRequest);
  const subject = replaceTokens(settings.serviceRequestSubject, values);
  const { text, html } = buildServiceRequestContent(serviceRequest, settings);

  if (!settings.serviceRequestConfirmationsEnabled) {
    return { sent: false, reason: "service_request_confirmation_disabled" };
  }

  if (!isEmailConfigured(settings)) {
    console.log("Email is not configured. Service request email preview:");
    console.log(`To: ${serviceRequest.email}`);
    console.log(`Subject: ${subject}`);
    if (serviceRequest.squarePaymentLinkUrl) {
      console.log(`Square payment: ${serviceRequest.squarePaymentLinkUrl}`);
    }
    return { sent: false, reason: "email_not_configured" };
  }

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to: serviceRequest.email,
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendBookingAdminNotification(booking, manageUrl) {
  const settings = getEmailSettings();
  const recipients = splitEmails(settings.adminNotificationEmails);
  if (!settings.adminNotificationsEnabled || recipients.length === 0) {
    return { sent: false, reason: "admin_notifications_disabled" };
  }
  if (!isEmailConfigured(settings)) {
    return { sent: false, reason: "email_not_configured" };
  }

  const values = bookingTemplateValues(booking, manageUrl);
  const subject = replaceTokens(settings.adminBookingSubject, values);
  const text = `New TelePlus Care booking

${bookingDetailText(booking)}
Manage link: ${manageUrl}`;
  const html = emailLayout({
    heading: "New booking received",
    preheader: `${values.patientName} — ${formatLongDate(booking.appointmentDate)} ${booking.appointmentTime}`,
    bodyHtml: `
      ${leadParagraph(`A new booking just came in for ${values.patientName}.`)}
      ${detailTable(bookingDetailRows(booking))}
      ${buttonStack(emailButton("Open manage link", manageUrl, "secondary"))}
    `
  });

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to: recipients.join(", "),
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendServiceRequestAdminNotification(serviceRequest) {
  const settings = getEmailSettings();
  const recipients = splitEmails(settings.adminNotificationEmails);
  if (!settings.adminNotificationsEnabled || recipients.length === 0) {
    return { sent: false, reason: "admin_notifications_disabled" };
  }
  if (!isEmailConfigured(settings)) {
    return { sent: false, reason: "email_not_configured" };
  }

  const values = serviceRequestTemplateValues(serviceRequest);
  const subject = replaceTokens(settings.adminServiceRequestSubject, values);
  const dateRange = serviceRequest.noteStartDate
    ? `\nDoctor note dates: ${serviceRequest.noteStartDate} to ${serviceRequest.noteEndDate}`
    : "";
  const text = `New TelePlus Care service request

Reference: ${serviceRequest.reference}
Patient: ${values.patientName}
Phone: ${serviceRequest.phone}
Email: ${serviceRequest.email}
Service: ${values.serviceName}
Total: ${values.total}
Payment status: ${serviceRequest.paymentStatus}${dateRange}`;
  const html = emailLayout({
    heading: "New service request",
    preheader: `${values.patientName} — ${values.serviceName}`,
    bodyHtml: `
      ${leadParagraph(`A new ${values.serviceName} request just came in from ${values.patientName}.`)}
      ${detailTable([
        ["Patient", escapeHtml(values.patientName)],
        ["Phone", escapeHtml(serviceRequest.phone)],
        ["Email", `<a href="mailto:${escapeHtml(serviceRequest.email)}" style="color:${BRAND.accent};">${escapeHtml(serviceRequest.email)}</a>`],
        ["Service", escapeHtml(values.serviceName)],
        serviceRequest.noteStartDate
          ? ["Note dates", `${escapeHtml(formatLongDate(serviceRequest.noteStartDate))} &ndash; ${escapeHtml(formatLongDate(serviceRequest.noteEndDate))}`]
          : null,
        ["Total", escapeHtml(values.total)],
        ["Payment", escapeHtml(paymentLabel(serviceRequest.paymentStatus))],
        ["Reference", escapeHtml(serviceRequest.reference)]
      ])}
    `
  });

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to: recipients.join(", "),
    subject,
    text,
    html
  });

  return { sent: true };
}

// Shared staff/doctor notification for booking lifecycle events (reschedule,
// cancellation) — always includes the full booking record.
async function sendBookingStaffEventNotification(booking, { subject, heading, intro }) {
  const settings = getEmailSettings();
  const recipients = splitEmails(settings.adminNotificationEmails);
  if (!settings.adminNotificationsEnabled || recipients.length === 0) {
    return { sent: false, reason: "admin_notifications_disabled" };
  }
  if (!isEmailConfigured(settings)) {
    return { sent: false, reason: "email_not_configured" };
  }

  const text = `${intro}

${bookingDetailText(booking)}`;
  const html = emailLayout({
    heading,
    preheader: intro,
    bodyHtml: `
      ${leadParagraph(intro)}
      ${detailTable(bookingDetailRows(booking))}
    `
  });

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to: recipients.join(", "),
    subject,
    text,
    html
  });

  return { sent: true };
}

async function sendBookingRescheduleAdminNotification(booking, previous = {}) {
  const fromWhen = previous.fromDate && previous.fromTime
    ? `${formatLongDate(previous.fromDate)} at ${previous.fromTime}`
    : "an earlier time";
  const newWhen = booking.appointmentDate && booking.appointmentTime
    ? `${formatLongDate(booking.appointmentDate)} at ${booking.appointmentTime}`
    : "a new time";
  return sendBookingStaffEventNotification(booking, {
    subject: `Booking RESCHEDULED: ${booking.reference} - ${booking.firstName} ${booking.lastName}`,
    heading: "A patient rescheduled their appointment",
    intro: `${booking.firstName} ${booking.lastName} moved their appointment from ${fromWhen} to ${newWhen}. Full booking details below.`
  });
}

async function sendBookingCancellationAdminNotification(booking) {
  const when = booking.appointmentDate && booking.appointmentTime
    ? `${formatLongDate(booking.appointmentDate)} at ${booking.appointmentTime}`
    : "their requested time";
  return sendBookingStaffEventNotification(booking, {
    subject: `Booking CANCELLED: ${booking.reference} - ${booking.firstName} ${booking.lastName}`,
    heading: "A patient cancelled their appointment",
    intro: `${booking.firstName} ${booking.lastName} cancelled their appointment (${when}). Full booking details below.`
  });
}

async function sendTestEmail(to) {
  const settings = getEmailSettings();
  if (!isEmailConfigured(settings)) {
    throw new Error("SMTP is not configured yet.");
  }

  await createTransporter(settings).sendMail({
    ...mailSender(settings),
    to,
    subject: "TelePlus Care email test",
    text: "Success! Your TelePlus Care email setup is working. This is a test message.",
    html: emailLayout({
      heading: "Your email setup is working ✓",
      preheader: "TelePlus Care test email",
      bodyHtml: `${leadParagraph("Success! If you're reading this, your TelePlus Care email setup is working correctly. Patients will now receive confirmations, reminders, and cancellation notices.")}`
    })
  });

  return { sent: true };
}

module.exports = {
  EMAIL_SETTINGS_KEY,
  getEmailSettings,
  isEmailConfigured,
  normalizeEmailSettings,
  publicEmailSettings,
  sendAppointmentReminder,
  sendBookingAdminNotification,
  sendBookingCancellation,
  sendBookingCancellationAdminNotification,
  sendBookingConfirmation,
  sendPaymentRequest,
  sendBookingRescheduleAdminNotification,
  sendBookingRescheduleConfirmation,
  sendServiceRequestAdminNotification,
  sendServiceRequestConfirmation,
  sendTestEmail
};
