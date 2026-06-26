const bookingList = document.querySelector("#bookingList");
const bookingDetail = document.querySelector("#bookingDetail");
const statusFilter = document.querySelector("#statusFilter");
const dateFilter = document.querySelector("#dateFilter");
const searchFilter = document.querySelector("#searchFilter");
const refreshButton = document.querySelector("#refreshButton");
const adminMessage = document.querySelector("#adminMessage");
const adminStats = document.querySelector("#adminStats");
const dashboardCards = document.querySelector("#dashboardCards");
const exportLink = document.querySelector("#exportLink");
const calendarExportLink = document.querySelector("#calendarExportLink");
const slotControlDate = document.querySelector("#slotControlDate");
const slotControlRefreshButton = document.querySelector("#slotControlRefreshButton");
const slotControlStats = document.querySelector("#slotControlStats");
const slotControlGrid = document.querySelector("#slotControlGrid");
const reminderStatus = document.querySelector("#reminderStatus");
const reminderMinutesBefore = document.querySelector("#reminderMinutesBefore");
const saveReminderSettings = document.querySelector("#saveReminderSettings");
const emailSettingsStatus = document.querySelector("#emailSettingsStatus");
const smtpEnabled = document.querySelector("#smtpEnabled");
const patientConfirmationsEnabled = document.querySelector("#patientConfirmationsEnabled");
const serviceRequestConfirmationsEnabled = document.querySelector("#serviceRequestConfirmationsEnabled");
const reminderEmailsEnabled = document.querySelector("#reminderEmailsEnabled");
const adminNotificationsEnabled = document.querySelector("#adminNotificationsEnabled");
const smtpHost = document.querySelector("#smtpHost");
const smtpPort = document.querySelector("#smtpPort");
const smtpSecure = document.querySelector("#smtpSecure");
const smtpUser = document.querySelector("#smtpUser");
const smtpPass = document.querySelector("#smtpPass");
const smtpPasswordStatus = document.querySelector("#smtpPasswordStatus");
const clearSmtpPassword = document.querySelector("#clearSmtpPassword");
const smtpFrom = document.querySelector("#smtpFrom");
const smtpReplyTo = document.querySelector("#smtpReplyTo");
const adminNotificationEmails = document.querySelector("#adminNotificationEmails");
const appointmentSubject = document.querySelector("#appointmentSubject");
const appointmentIntro = document.querySelector("#appointmentIntro");
const serviceRequestSubject = document.querySelector("#serviceRequestSubject");
const serviceRequestIntro = document.querySelector("#serviceRequestIntro");
const reminderSubject = document.querySelector("#reminderSubject");
const reminderIntro = document.querySelector("#reminderIntro");
const adminBookingSubject = document.querySelector("#adminBookingSubject");
const adminServiceRequestSubject = document.querySelector("#adminServiceRequestSubject");
const refundPolicyUrl = document.querySelector("#refundPolicyUrl");
const saveEmailSettings = document.querySelector("#saveEmailSettings");
const cancellationPolicyStatus = document.querySelector("#cancellationPolicyStatus");
const cancellationCutoffHours = document.querySelector("#cancellationCutoffHours");
const noShowFeeDollars = document.querySelector("#noShowFeeDollars");
const refundAdminFeeDollars = document.querySelector("#refundAdminFeeDollars");
const sendCancellationEmail = document.querySelector("#sendCancellationEmail");
const cancellationPolicyText = document.querySelector("#cancellationPolicyText");
const saveCancellationPolicy = document.querySelector("#saveCancellationPolicy");
const testEmailTo = document.querySelector("#testEmailTo");
const sendTestEmailButton = document.querySelector("#sendTestEmailButton");
const scheduleStatus = document.querySelector("#scheduleStatus");
const scheduleInterval = document.querySelector("#scheduleInterval");
const scheduleDays = document.querySelector("#scheduleDays");
const blockedDatePicker = document.querySelector("#blockedDatePicker");
const addBlockedDateButton = document.querySelector("#addBlockedDateButton");
const blockedDatesList = document.querySelector("#blockedDatesList");
const blockedSlotDate = document.querySelector("#blockedSlotDate");
const blockedSlotTime = document.querySelector("#blockedSlotTime");
const addBlockedSlotButton = document.querySelector("#addBlockedSlotButton");
const blockedSlotsList = document.querySelector("#blockedSlotsList");
const extraSlotDate = document.querySelector("#extraSlotDate");
const extraSlotTime = document.querySelector("#extraSlotTime");
const addExtraSlotButton = document.querySelector("#addExtraSlotButton");
const extraSlotsList = document.querySelector("#extraSlotsList");
const saveScheduleSettings = document.querySelector("#saveScheduleSettings");
const listViewButton = document.querySelector("#listViewButton");
const calendarViewButton = document.querySelector("#calendarViewButton");
const adminCalendar = document.querySelector("#adminCalendar");
const bookingTableWrap = document.querySelector("#bookingTableWrap");
const serviceRequestRows = document.querySelector("#serviceRequestRows");
const serviceRequestStats = document.querySelector("#serviceRequestStats");
const serviceRequestSearchFilter = document.querySelector("#serviceRequestSearchFilter");
const serviceRequestTypeFilter = document.querySelector("#serviceRequestTypeFilter");
const serviceRequestStatusFilter = document.querySelector("#serviceRequestStatusFilter");
const serviceRequestRefreshButton = document.querySelector("#serviceRequestRefreshButton");
const marketingRows = document.querySelector("#marketingRows");
const marketingStats = document.querySelector("#marketingStats");
const marketingSearchFilter = document.querySelector("#marketingSearchFilter");
const marketingFormTypeFilter = document.querySelector("#marketingFormTypeFilter");
const marketingStatusFilter = document.querySelector("#marketingStatusFilter");
const marketingRefreshButton = document.querySelector("#marketingRefreshButton");
const serviceBuilderRows = document.querySelector("#serviceBuilderRows");
const serviceBuilderStats = document.querySelector("#serviceBuilderStats");
const addServiceButton = document.querySelector("#addServiceButton");
const saveServicesButton = document.querySelector("#saveServicesButton");
const waitlistRows = document.querySelector("#waitlistRows");
const waitlistStats = document.querySelector("#waitlistStats");
const waitlistSearchFilter = document.querySelector("#waitlistSearchFilter");
const waitlistStatusFilter = document.querySelector("#waitlistStatusFilter");
const waitlistDateFilter = document.querySelector("#waitlistDateFilter");
const waitlistRefreshButton = document.querySelector("#waitlistRefreshButton");
const navCards = document.querySelectorAll("[data-go]");
const adminPages = document.querySelectorAll("[data-page]");

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const monthFormat = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" });
const dayLabels = {
  sunday: "Sunday",
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday"
};

let currentBookings = [];
let selectedBookingId = null;
let currentServices = [];
let currentScheduleConfig = null;
let currentView = "list";
let activePage = window.localStorage.getItem("telepluscareAdminPage") || "home";
let searchDebounce = null;
let serviceRequestSearchDebounce = null;
let marketingSearchDebounce = null;
let waitlistSearchDebounce = null;

function apiUrl(path) {
  return `${window.location.origin}${path}`;
}

function formatCad(cents) {
  return currency.format(cents / 100);
}

function centsToDollars(cents) {
  return Math.round(Number(cents || 0)) / 100;
}

function dollarsToCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.round(number * 100));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setAdminMessage(type, text) {
  adminMessage.className = `form-message show ${type}`;
  adminMessage.textContent = text;
}

function clearAdminMessage() {
  adminMessage.className = "form-message";
  adminMessage.textContent = "";
}

function currentQuery() {
  const params = new URLSearchParams();
  if (statusFilter.value) {
    params.set("status", statusFilter.value);
  }
  if (dateFilter.value) {
    params.set("date", dateFilter.value);
  }
  if (searchFilter.value.trim()) {
    params.set("q", searchFilter.value.trim());
  }
  return params.toString();
}

function serviceRequestQuery() {
  const params = new URLSearchParams();
  if (serviceRequestStatusFilter.value) {
    params.set("status", serviceRequestStatusFilter.value);
  }
  if (serviceRequestTypeFilter.value) {
    params.set("requestType", serviceRequestTypeFilter.value);
  }
  if (serviceRequestSearchFilter.value.trim()) {
    params.set("q", serviceRequestSearchFilter.value.trim());
  }
  return params.toString();
}

function marketingQuery() {
  const params = new URLSearchParams();
  if (marketingStatusFilter.value) {
    params.set("status", marketingStatusFilter.value);
  }
  if (marketingFormTypeFilter.value) {
    params.set("formType", marketingFormTypeFilter.value);
  }
  if (marketingSearchFilter.value.trim()) {
    params.set("q", marketingSearchFilter.value.trim());
  }
  return params.toString();
}

function waitlistQuery() {
  const params = new URLSearchParams();
  if (waitlistStatusFilter.value) {
    params.set("status", waitlistStatusFilter.value);
  }
  if (waitlistDateFilter.value) {
    params.set("date", waitlistDateFilter.value);
  }
  if (waitlistSearchFilter.value.trim()) {
    params.set("q", waitlistSearchFilter.value.trim());
  }
  return params.toString();
}

function updateExportLinks() {
  const query = currentQuery();
  exportLink.href = apiUrl(query ? `/api/admin/export.csv?${query}` : "/api/admin/export.csv");
  calendarExportLink.href = apiUrl(query ? `/api/admin/calendar.ics?${query}` : "/api/admin/calendar.ics");
}

function showPage(name) {
  const allowed = [...adminPages].map((page) => page.dataset.page);
  activePage = allowed.includes(name) ? name : "home";
  window.localStorage.setItem("telepluscareAdminPage", activePage);

  for (const page of adminPages) {
    page.hidden = page.dataset.page !== activePage;
  }

  for (const card of navCards) {
    if (card.classList.contains("nav-card")) {
      card.classList.toggle("active", card.dataset.go === activePage);
    }
  }

  if (activePage === "bookings") {
    renderCurrentView();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderReminderSettings(settings) {
  reminderMinutesBefore.value = settings.reminderMinutesBefore;
  const channels = [
    settings.emailConfigured ? "email ready" : "email not configured",
    settings.smsConfigured ? "SMS ready" : "SMS not configured"
  ].join(" · ");
  reminderStatus.textContent = settings.remindersEnabled
    ? `Automatic reminders are on. ${channels}.`
    : `Automatic reminders are disabled. ${channels}.`;
}

async function loadReminderSettings() {
  const response = await fetch(apiUrl("/api/admin/reminder-settings"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load reminder settings.");
  }

  renderReminderSettings(data);
}

async function updateReminderSettings() {
  const value = Number(reminderMinutesBefore.value);
  const response = await fetch(apiUrl("/api/admin/reminder-settings"), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reminderMinutesBefore: value })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not save reminder settings.");
  }

  renderReminderSettings(data);
  setAdminMessage("success", `Reminder time saved: ${data.reminderMinutesBefore} minutes before appointment.`);
}

function renderEmailSettings(payload) {
  const settings = payload.settings || payload;
  smtpEnabled.checked = settings.smtpEnabled;
  patientConfirmationsEnabled.checked = settings.patientConfirmationsEnabled;
  serviceRequestConfirmationsEnabled.checked = settings.serviceRequestConfirmationsEnabled;
  reminderEmailsEnabled.checked = settings.reminderEmailsEnabled;
  adminNotificationsEnabled.checked = settings.adminNotificationsEnabled;
  smtpHost.value = settings.smtpHost || "";
  smtpPort.value = settings.smtpPort || 587;
  smtpSecure.checked = settings.smtpSecure;
  smtpUser.value = settings.smtpUser || "";
  smtpPass.value = "";
  smtpPasswordStatus.textContent = settings.smtpPasswordSet
    ? "SMTP password is saved. Leave blank to keep it."
    : "No SMTP password saved.";
  clearSmtpPassword.checked = false;
  smtpFrom.value = settings.smtpFrom || "";
  smtpReplyTo.value = settings.smtpReplyTo || "";
  adminNotificationEmails.value = settings.adminNotificationEmails || "";
  appointmentSubject.value = settings.appointmentSubject || "";
  appointmentIntro.value = settings.appointmentIntro || "";
  serviceRequestSubject.value = settings.serviceRequestSubject || "";
  serviceRequestIntro.value = settings.serviceRequestIntro || "";
  reminderSubject.value = settings.reminderSubject || "";
  reminderIntro.value = settings.reminderIntro || "";
  adminBookingSubject.value = settings.adminBookingSubject || "";
  adminServiceRequestSubject.value = settings.adminServiceRequestSubject || "";
  if (refundPolicyUrl) {
    refundPolicyUrl.value = settings.refundPolicyUrl || "";
  }

  if (!settings.smtpEnabled) {
    emailSettingsStatus.textContent = "Email sending is turned off. Turn it on under Email Delivery Setup.";
  } else if (settings.emailConfigured) {
    emailSettingsStatus.textContent = "✓ Your email account is connected — these messages will be sent to patients automatically.";
  } else {
    emailSettingsStatus.textContent = "Almost there: connect your email account under Email Delivery Setup so these messages can send.";
  }
}

function readEmailSettings() {
  return {
    smtpEnabled: smtpEnabled.checked,
    patientConfirmationsEnabled: patientConfirmationsEnabled.checked,
    serviceRequestConfirmationsEnabled: serviceRequestConfirmationsEnabled.checked,
    reminderEmailsEnabled: reminderEmailsEnabled.checked,
    adminNotificationsEnabled: adminNotificationsEnabled.checked,
    smtpHost: smtpHost.value.trim(),
    smtpPort: Number(smtpPort.value || 587),
    smtpSecure: smtpSecure.checked,
    smtpUser: smtpUser.value.trim(),
    smtpPass: smtpPass.value,
    clearSmtpPassword: clearSmtpPassword.checked,
    smtpFrom: smtpFrom.value.trim(),
    smtpReplyTo: smtpReplyTo.value.trim(),
    adminNotificationEmails: adminNotificationEmails.value.trim(),
    appointmentSubject: appointmentSubject.value.trim(),
    appointmentIntro: appointmentIntro.value.trim(),
    serviceRequestSubject: serviceRequestSubject.value.trim(),
    serviceRequestIntro: serviceRequestIntro.value.trim(),
    reminderSubject: reminderSubject.value.trim(),
    reminderIntro: reminderIntro.value.trim(),
    adminBookingSubject: adminBookingSubject.value.trim(),
    adminServiceRequestSubject: adminServiceRequestSubject.value.trim(),
    refundPolicyUrl: refundPolicyUrl ? refundPolicyUrl.value.trim() : ""
  };
}

async function loadEmailSettings() {
  const response = await fetch(apiUrl("/api/admin/email-settings"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load email settings.");
  }

  renderEmailSettings(data);
}

async function updateEmailSettings() {
  const response = await fetch(apiUrl("/api/admin/email-settings"), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(readEmailSettings())
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not save email settings.");
  }

  renderEmailSettings(data);
  await loadReminderSettings();
  setAdminMessage("success", "Email, SMTP, and autoresponder settings saved.");
}

async function sendTestEmail() {
  const to = testEmailTo.value.trim();
  const response = await fetch(apiUrl("/api/admin/email-settings/test"), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not send test email.");
  }

  setAdminMessage("success", `Test email sent to ${to}.`);
}

function renderCancellationPolicy(policy) {
  cancellationCutoffHours.value = policy.cutoffHours;
  noShowFeeDollars.value = centsToDollars(policy.noShowFeeCents);
  refundAdminFeeDollars.value = centsToDollars(policy.refundAdminFeeCents);
  sendCancellationEmail.checked = Boolean(policy.sendCancellationEmail);
  cancellationPolicyText.value = policy.policyText || "";
  cancellationPolicyStatus.textContent = `Patients can cancel online until ${policy.cutoffHours} hour(s) before appointment. No-show fee: ${formatCad(policy.noShowFeeCents)}. Refund admin fee: ${formatCad(policy.refundAdminFeeCents)}.`;
}

async function loadCancellationPolicy() {
  const response = await fetch(apiUrl("/api/admin/cancellation-policy"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load cancellation policy.");
  }

  renderCancellationPolicy(data.policy);
}

async function updateCancellationPolicy() {
  const payload = {
    cutoffHours: Number(cancellationCutoffHours.value || 0),
    noShowFeeCents: dollarsToCents(noShowFeeDollars.value),
    refundAdminFeeCents: dollarsToCents(refundAdminFeeDollars.value),
    sendCancellationEmail: sendCancellationEmail.checked,
    policyText: cancellationPolicyText.value.trim()
  };
  const response = await fetch(apiUrl("/api/admin/cancellation-policy"), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not save cancellation policy.");
  }

  renderCancellationPolicy(data.policy);
  setAdminMessage("success", "Cancellation rules saved.");
}

function minutesToTimeLabel(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function timeLabelToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(String(value || "").trim());
  if (!match) {
    return Number.NaN;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3];
  if (period === "PM" && hours !== 12) {
    hours += 12;
  }
  if (period === "AM" && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}

const scheduleTimeOptions = Array.from({ length: 96 }, (_, index) => minutesToTimeLabel(index * 15));

function timeOptionsHtml(selected) {
  return scheduleTimeOptions.map((time) => `
    <option value="${escapeHtml(time)}" ${time === selected ? "selected" : ""}>${escapeHtml(time)}</option>
  `).join("");
}

function defaultRange(dayKey) {
  return dayKey === "saturday"
    ? { start: "10:00 AM", end: "3:45 PM" }
    : { start: "10:00 AM", end: "1:00 PM" };
}

function defaultBreak() {
  return { start: "1:00 PM", end: "2:00 PM" };
}

function createScheduleRangeRow(dayKey, range = defaultRange(dayKey)) {
  const row = document.createElement("div");
  row.className = "schedule-range-row";
  row.dataset.rangeRow = dayKey;
  row.innerHTML = `
    <label>
      <span>Start</span>
      <select data-range-start="${escapeHtml(dayKey)}">${timeOptionsHtml(range.start)}</select>
    </label>
    <label>
      <span>End</span>
      <select data-range-end="${escapeHtml(dayKey)}">${timeOptionsHtml(range.end)}</select>
    </label>
    <button type="button" class="icon-text-button" data-remove-range="${escapeHtml(dayKey)}">Remove</button>
  `;
  return row;
}

function createScheduleBreakRow(dayKey, breakWindow = defaultBreak()) {
  const row = document.createElement("div");
  row.className = "schedule-range-row schedule-break-row";
  row.dataset.breakRow = dayKey;
  row.innerHTML = `
    <label>
      <span>Break Start</span>
      <select data-break-start="${escapeHtml(dayKey)}">${timeOptionsHtml(breakWindow.start)}</select>
    </label>
    <label>
      <span>Break End</span>
      <select data-break-end="${escapeHtml(dayKey)}">${timeOptionsHtml(breakWindow.end)}</select>
    </label>
    <button type="button" class="icon-text-button" data-remove-break="${escapeHtml(dayKey)}">Remove</button>
  `;
  return row;
}

function ensureRangeEmptyState(dayKey) {
  const container = scheduleDays.querySelector(`[data-day-ranges="${dayKey}"]`);
  if (!container) {
    return;
  }

  container.querySelector(".schedule-empty-state")?.remove();
  if (!container.querySelector("[data-range-row]")) {
    const empty = document.createElement("div");
    empty.className = "schedule-empty-state";
    empty.textContent = "Closed all day";
    container.append(empty);
  }
}

function ensureBreakEmptyState(dayKey) {
  const container = scheduleDays.querySelector(`[data-day-breaks="${dayKey}"]`);
  if (!container) {
    return;
  }

  container.querySelector(".schedule-empty-state")?.remove();
  if (!container.querySelector("[data-break-row]")) {
    const empty = document.createElement("div");
    empty.className = "schedule-empty-state";
    empty.textContent = "No breaks";
    container.append(empty);
  }
}

function appendScheduleRange(dayKey, range = defaultRange(dayKey)) {
  const container = scheduleDays.querySelector(`[data-day-ranges="${dayKey}"]`);
  if (!container) {
    return;
  }
  container.querySelector(".schedule-empty-state")?.remove();
  container.append(createScheduleRangeRow(dayKey, range));
}

function appendScheduleBreak(dayKey, breakWindow = defaultBreak()) {
  const container = scheduleDays.querySelector(`[data-day-breaks="${dayKey}"]`);
  if (!container) {
    return;
  }
  container.querySelector(".schedule-empty-state")?.remove();
  container.append(createScheduleBreakRow(dayKey, breakWindow));
}

function setDayOpenState(dayKey) {
  const row = scheduleDays.querySelector(`[data-schedule-day="${dayKey}"]`);
  if (!row) {
    return;
  }

  const isOpen = row.querySelector(`[data-day-open="${dayKey}"]`).checked;
  row.classList.toggle("is-closed", !isOpen);
  for (const control of row.querySelectorAll("[data-range-start], [data-range-end], [data-remove-range], [data-add-range], [data-break-start], [data-break-end], [data-remove-break], [data-add-break]")) {
    control.disabled = !isOpen;
  }
}

function renderScheduleRanges(dayKey, ranges = []) {
  const container = scheduleDays.querySelector(`[data-day-ranges="${dayKey}"]`);
  if (!container) {
    return;
  }

  container.innerHTML = "";
  for (const range of ranges) {
    appendScheduleRange(dayKey, range);
  }
  ensureRangeEmptyState(dayKey);
}

function renderScheduleBreaks(dayKey, breaks = []) {
  const container = scheduleDays.querySelector(`[data-day-breaks="${dayKey}"]`);
  if (!container) {
    return;
  }

  container.innerHTML = "";
  for (const breakWindow of breaks) {
    appendScheduleBreak(dayKey, breakWindow);
  }
  ensureBreakEmptyState(dayKey);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

function renderDateChips(list, dates = []) {
  const uniqueDates = [...new Set(dates.filter(isIsoDate))].sort();
  list.innerHTML = uniqueDates.length ? "" : `<span class="schedule-empty-chip">None</span>`;
  for (const date of uniqueDates) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "schedule-chip";
    chip.dataset.date = date;
    chip.ariaLabel = `Remove ${date}`;
    chip.innerHTML = `<span>${escapeHtml(date)}</span><span aria-hidden="true">x</span>`;
    list.append(chip);
  }
}

function readDateChips(list) {
  return [...new Set([...list.querySelectorAll(".schedule-chip[data-date]")]
    .map((chip) => chip.dataset.date)
    .filter(isIsoDate))]
    .sort();
}

function renderSlotChips(list, map = {}) {
  const entries = Object.entries(map)
    .flatMap(([date, slots]) => (slots || []).map((slot) => ({ date, slot })))
    .filter((entry) => isIsoDate(entry.date) && Number.isFinite(timeLabelToMinutes(entry.slot)))
    .sort((left, right) => {
      if (left.date !== right.date) {
        return left.date.localeCompare(right.date);
      }
      return timeLabelToMinutes(left.slot) - timeLabelToMinutes(right.slot);
    });

  const seen = new Set();
  list.innerHTML = entries.length ? "" : `<span class="schedule-empty-chip">None</span>`;
  for (const entry of entries) {
    const key = `${entry.date}|${entry.slot}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "schedule-chip schedule-slot-chip";
    chip.dataset.date = entry.date;
    chip.dataset.time = entry.slot;
    chip.ariaLabel = `Remove ${entry.date} ${entry.slot}`;
    chip.innerHTML = `<span>${escapeHtml(entry.date)}</span><strong>${escapeHtml(entry.slot)}</strong><span aria-hidden="true">x</span>`;
    list.append(chip);
  }
}

function readSlotChips(list) {
  const map = {};
  for (const chip of list.querySelectorAll(".schedule-slot-chip[data-date][data-time]")) {
    const date = chip.dataset.date;
    const time = chip.dataset.time;
    if (!isIsoDate(date) || !Number.isFinite(timeLabelToMinutes(time))) {
      continue;
    }
    if (!map[date]) {
      map[date] = [];
    }
    map[date].push(time);
  }

  return Object.entries(map).reduce((cleaned, [date, slots]) => {
    cleaned[date] = [...new Set(slots)].sort((left, right) => timeLabelToMinutes(left) - timeLabelToMinutes(right));
    return cleaned;
  }, {});
}

function addDateChip(list, date) {
  if (!isIsoDate(date)) {
    return false;
  }
  renderDateChips(list, [...readDateChips(list), date]);
  return true;
}

function addSlotChip(list, date, time) {
  if (!isIsoDate(date) || !Number.isFinite(timeLabelToMinutes(time))) {
    return false;
  }
  const map = readSlotChips(list);
  map[date] = [...(map[date] || []), time];
  renderSlotChips(list, map);
  return true;
}

function removeScheduleChip(chip) {
  const list = chip.closest(".schedule-chip-list");
  const isSlotChip = chip.classList.contains("schedule-slot-chip");
  chip.remove();
  if (!list.querySelector(".schedule-chip")) {
    list.innerHTML = `<span class="schedule-empty-chip">None</span>`;
    return;
  }
  if (isSlotChip) {
    renderSlotChips(list, readSlotChips(list));
  } else {
    renderDateChips(list, readDateChips(list));
  }
}

function renderScheduleSettings(payload) {
  const { schedule, timezone, dayKeys = Object.keys(schedule.days) } = payload;
  currentScheduleConfig = schedule;
  scheduleInterval.value = String(schedule.intervalMinutes);
  scheduleStatus.textContent = `Availability uses ${timezone}. Pick open days and appointment windows below.`;
  scheduleDays.innerHTML = dayKeys.map((dayKey) => {
    const day = schedule.days[dayKey] || { open: false, ranges: [] };
    return `
      <div class="schedule-day-row ${day.open ? "" : "is-closed"}" data-schedule-day="${dayKey}">
        <div class="schedule-day-header">
          <label class="schedule-day-toggle">
            <input type="checkbox" data-day-open="${dayKey}" ${day.open ? "checked" : ""}>
            <span>${dayLabels[dayKey] || dayKey}</span>
          </label>
          <div class="schedule-day-actions">
            <button type="button" class="secondary-button" data-add-range="${dayKey}">Add Time</button>
            <button type="button" class="secondary-button" data-add-break="${dayKey}">Add Break</button>
          </div>
        </div>
        <div class="schedule-group">
          <h3>Open Times</h3>
          <div class="schedule-ranges" data-day-ranges="${dayKey}"></div>
        </div>
        <div class="schedule-group">
          <h3>Breaks</h3>
          <div class="schedule-ranges" data-day-breaks="${dayKey}"></div>
        </div>
      </div>
    `;
  }).join("");

  for (const dayKey of dayKeys) {
    const day = schedule.days[dayKey] || { open: false, ranges: [] };
    renderScheduleRanges(dayKey, day.ranges);
    renderScheduleBreaks(dayKey, day.breaks);
    setDayOpenState(dayKey);
  }

  blockedSlotTime.innerHTML = timeOptionsHtml("10:00 AM");
  extraSlotTime.innerHTML = timeOptionsHtml("10:00 AM");
  renderDateChips(blockedDatesList, schedule.blockedDates);
  renderSlotChips(blockedSlotsList, schedule.blockedSlots);
  renderSlotChips(extraSlotsList, schedule.extraSlots);
}

function readScheduleSettings() {
  const days = {};
  for (const row of scheduleDays.querySelectorAll("[data-schedule-day]")) {
    const dayKey = row.dataset.scheduleDay;
    days[dayKey] = {
      open: row.querySelector(`[data-day-open="${dayKey}"]`).checked,
      ranges: [...row.querySelectorAll("[data-range-row]")].map((rangeRow) => ({
        start: rangeRow.querySelector(`[data-range-start="${dayKey}"]`).value,
        end: rangeRow.querySelector(`[data-range-end="${dayKey}"]`).value
      })).filter((range) => {
        const start = timeLabelToMinutes(range.start);
        const end = timeLabelToMinutes(range.end);
        return Number.isFinite(start) && Number.isFinite(end) && start <= end;
      }),
      breaks: [...row.querySelectorAll("[data-break-row]")].map((breakRow) => ({
        start: breakRow.querySelector(`[data-break-start="${dayKey}"]`).value,
        end: breakRow.querySelector(`[data-break-end="${dayKey}"]`).value
      })).filter((breakWindow) => {
        const start = timeLabelToMinutes(breakWindow.start);
        const end = timeLabelToMinutes(breakWindow.end);
        return Number.isFinite(start) && Number.isFinite(end) && start < end;
      })
    };
  }

  return {
    intervalMinutes: Number(scheduleInterval.value),
    days,
    blockedDates: readDateChips(blockedDatesList),
    blockedSlots: readSlotChips(blockedSlotsList),
    extraSlots: readSlotChips(extraSlotsList),
    slotOverrides: currentScheduleConfig?.slotOverrides || {}
  };
}

async function loadScheduleSettings() {
  const response = await fetch(apiUrl("/api/admin/schedule-settings"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load schedule settings.");
  }

  renderScheduleSettings(data);
}

async function updateScheduleSettings() {
  const schedule = readScheduleSettings();
  const response = await fetch(apiUrl("/api/admin/schedule-settings"), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schedule })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not save schedule settings.");
  }

  renderScheduleSettings(data);
  setAdminMessage("success", "Schedule settings saved. Public appointment availability updated.");
  await loadBookings();
}

function clientSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function newServiceDraft() {
  const id = `service-${Date.now()}`;
  return {
    id,
    name: "New TelePlus Care Service",
    priceCents: 8000,
    description: "",
    category: "All",
    careOption: "New TelePlus Care Service",
    healthCardRule: "paid_without_active_alberta",
    requiredFields: [],
    refundText: "",
    enabled: true
  };
}

function renderServiceBuilderStats(services) {
  const enabled = services.filter((service) => service.enabled).length;
  const paid = services.filter((service) => service.enabled && service.priceCents > 0).length;
  serviceBuilderStats.innerHTML = `
    <span>${services.length} services</span>
    <span>${enabled} enabled</span>
    <span>${paid} paid</span>
  `;
}

function serviceRow(service) {
  const requiredFields = Array.isArray(service.requiredFields) ? service.requiredFields.join("\n") : "";
  const card = document.createElement("div");
  card.className = "service-builder-card";
  card.dataset.serviceRow = service.id;
  card.innerHTML = `
    <div class="service-builder-header">
      <label class="checkbox-line">
        <input type="checkbox" data-service-enabled ${service.enabled ? "checked" : ""}>
        <span>Enabled</span>
      </label>
      <span class="service-id-pill">${escapeHtml(service.id)}</span>
    </div>
    <div class="settings-grid">
      <label>
        Service name
        <input data-service-name value="${escapeHtml(service.name)}">
      </label>
      <label>
        Price
        <span class="inline-control">
          <input data-service-price type="number" min="0" max="5000" step="1" value="${centsToDollars(service.priceCents)}">
          <span>CAD</span>
        </span>
      </label>
      <label>
        Main form option
        <input data-service-care-option value="${escapeHtml(service.careOption || service.name)}" placeholder="Virtual Doctor Visit">
      </label>
      <label>
        Health-card rule
        <select data-service-health-card-rule>
          <option value="active_alberta_free">Active Alberta PHN is free</option>
          <option value="paid_without_active_alberta">Paid when no active Alberta PHN</option>
          <option value="always_paid">Always paid</option>
        </select>
      </label>
      <label class="full-width">
        Description
        <textarea data-service-description rows="2">${escapeHtml(service.description)}</textarea>
      </label>
      <label>
        Required field notes
        <textarea data-service-required-fields rows="3" placeholder="Medication proof&#10;Reason for request">${escapeHtml(requiredFields)}</textarea>
      </label>
      <label>
        Refund / policy text
        <textarea data-service-refund-text rows="3" placeholder="Refunds deduct $20 administration/payment charges.">${escapeHtml(service.refundText || "")}</textarea>
      </label>
    </div>
  `;
  card.querySelector("[data-service-health-card-rule]").value = service.healthCardRule || "paid_without_active_alberta";
  return card;
}

function renderServiceBuilder(services) {
  currentServices = services;
  serviceBuilderRows.innerHTML = "";
  if (!services.length) {
    serviceBuilderRows.innerHTML = `<div class="empty-panel">No services configured yet.</div>`;
    renderServiceBuilderStats(services);
    return;
  }

  for (const service of services) {
    serviceBuilderRows.append(serviceRow(service));
  }
  renderServiceBuilderStats(services);
}

function readServices() {
  return [...serviceBuilderRows.querySelectorAll("[data-service-row]")].map((row, index) => {
    const name = row.querySelector("[data-service-name]").value.trim() || "TelePlus Care Service";
    const currentId = row.dataset.serviceRow || "";
    return {
      id: currentId.startsWith("service-") ? currentId : (currentId || clientSlug(name) || `service-${index + 1}`),
      name,
      priceCents: dollarsToCents(row.querySelector("[data-service-price]").value),
      description: row.querySelector("[data-service-description]").value.trim(),
      category: "All",
      careOption: row.querySelector("[data-service-care-option]").value.trim() || name,
      healthCardRule: row.querySelector("[data-service-health-card-rule]").value,
      requiredFields: row.querySelector("[data-service-required-fields]").value
        .split(/\n|,|;/)
        .map((entry) => entry.trim())
        .filter(Boolean),
      refundText: row.querySelector("[data-service-refund-text]").value.trim(),
      enabled: row.querySelector("[data-service-enabled]").checked
    };
  });
}

async function loadServices() {
  const response = await fetch(apiUrl("/api/admin/services"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load services.");
  }

  renderServiceBuilder(data.services || []);
}

async function saveServices() {
  const response = await fetch(apiUrl("/api/admin/services"), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ services: readServices() })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not save services.");
  }

  renderServiceBuilder(data.services || []);
  setAdminMessage("success", "Services saved. Public booking form updated.");
}

async function loadDashboardStats() {
  const response = await fetch(apiUrl("/api/admin/dashboard-stats"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load dashboard stats.");
  }

  renderDashboardStats(data.stats);
}

function renderDashboardStats(stats) {
  dashboardCards.innerHTML = `
    <div class="metric-card">
      <span>Today</span>
      <strong>${stats.today.count}</strong>
      <small>${formatCad(stats.today.revenueCents)}</small>
    </div>
    <div class="metric-card">
      <span>Next 7 Days</span>
      <strong>${stats.week.count}</strong>
      <small>${formatCad(stats.week.revenueCents)}</small>
    </div>
    <div class="metric-card">
      <span>This Month</span>
      <strong>${stats.month.count}</strong>
      <small>${formatCad(stats.month.revenueCents)}</small>
    </div>
    <div class="metric-card">
      <span>No-shows</span>
      <strong>${stats.statusCounts.no_show || 0}</strong>
      <small>${stats.statusCounts.cancelled || 0} cancelled</small>
    </div>
  `;
}

function todayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function bookingPatientLine(booking) {
  return `${booking.firstName} ${booking.lastName}`;
}

function renderSlotControlStats({ date, totalCapacity, booked, open, unavailable }) {
  slotControlStats.innerHTML = `
    <div class="slot-stat">
      <span>Date</span>
      <strong>${escapeHtml(date)}</strong>
    </div>
    <div class="slot-stat booked">
      <span>Filled</span>
      <strong>${booked}</strong>
    </div>
    <div class="slot-stat open">
      <span>Open Spots</span>
      <strong>${open}</strong>
    </div>
    <div class="slot-stat unavailable">
      <span>Unavailable</span>
      <strong>${unavailable}</strong>
    </div>
    <div class="slot-stat">
      <span>Total Capacity</span>
      <strong>${totalCapacity}</strong>
    </div>
  `;
}

function slotStatusLabel(slot) {
  if (slot.status === "closed") {
    return "Closed";
  }
  if (slot.status === "full") {
    return "Full";
  }
  if (slot.status === "unavailable") {
    return "Unavailable";
  }
  return "Open";
}

function slotStatusDescription(slot) {
  if (slot.status === "closed") {
    return "Not available for new booking.";
  }
  if (slot.status === "full") {
    return "Capacity is full for this time.";
  }
  if (slot.status === "unavailable") {
    return "Not available for new booking.";
  }
  return "Available for booking.";
}

function renderSlotControl({ date, slots, bookings, stats = {} }) {
  const activeBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const bookingsByTime = activeBookings.reduce((map, booking) => {
    if (!map.has(booking.appointmentTime)) {
      map.set(booking.appointmentTime, []);
    }
    map.get(booking.appointmentTime).push(booking);
    return map;
  }, new Map());
  const availabilityByTime = new Map(slots.map((slot) => [slot.time, slot]));
  const times = [...new Set([...availabilityByTime.keys(), ...bookingsByTime.keys()])]
    .sort((left, right) => timeLabelToMinutes(left) - timeLabelToMinutes(right));

  renderSlotControlStats({
    date,
    totalCapacity: stats.totalCapacity ?? slots.reduce((sum, slot) => sum + (slot.open ? slot.capacity : 0), 0),
    booked: stats.booked ?? activeBookings.length,
    open: stats.open ?? slots.reduce((sum, slot) => sum + (slot.available ? slot.remaining : 0), 0),
    unavailable: stats.unavailable ?? slots.filter((slot) => slot.status === "closed" || slot.status === "unavailable").length
  });

  if (!times.length) {
    slotControlGrid.innerHTML = `<div class="empty-panel">No appointment spots are configured for this date.</div>`;
    return;
  }

  slotControlGrid.innerHTML = times.map((time) => {
    const bookingsForTime = bookingsByTime.get(time) || [];
    const slot = availabilityByTime.get(time) || {
      time,
      status: bookingsForTime.length ? "full" : "closed",
      open: false,
      available: false,
      capacity: Math.max(1, bookingsForTime.length),
      booked: bookingsForTime.length,
      remaining: 0
    };
    const controlStatus = slot.open ? "open" : "closed";
    const cardClass = slot.status === "open" && bookingsForTime.length ? "booked" : slot.status;
    const booked = slot.booked || bookingsForTime.length;
    const bookingList = bookingsForTime.length
      ? `
        <div class="slot-booking-list">
          ${bookingsForTime.map((booking) => `
            <div class="slot-booking-row">
              <span class="slot-booking-name" title="${escapeHtml(booking.reference)}">${escapeHtml(bookingPatientLine(booking))}</span>
              <button type="button" class="slot-free-btn" data-free-slot="${escapeHtml(booking.id)}" title="Free this slot">Free</button>
            </div>
          `).join("")}
        </div>
      `
      : "";

    return `
      <article class="slot-card ${escapeHtml(cardClass)}" data-slot-card data-slot-time="${escapeHtml(time)}">
        <div class="slot-card-top">
          <strong class="slot-time">${escapeHtml(time)}</strong>
          <span class="slot-pill">${escapeHtml(slotStatusLabel(slot))}</span>
        </div>
        <div class="slot-occupancy">
          <span class="slot-count">${booked}<span class="slot-count-sep">/</span>${escapeHtml(slot.capacity)}</span>
          <span class="slot-occ-label">filled</span>
        </div>
        ${bookingList}
        <div class="slot-admin-controls">
          <select data-slot-status aria-label="Open or close this time">
            <option value="open" ${controlStatus === "open" ? "selected" : ""}>Open</option>
            <option value="closed" ${controlStatus === "closed" ? "selected" : ""}>Closed</option>
          </select>
          <input data-slot-capacity type="number" min="1" max="20" step="1" value="${escapeHtml(slot.capacity)}" aria-label="Capacity">
          <button type="button" class="secondary-button" data-save-slot>Save</button>
        </div>
      </article>
    `;
  }).join("");
}

async function loadSlotOccupancy() {
  const date = slotControlDate.value || todayIsoDate();
  slotControlDate.value = date;
  const [slotControlResponse, bookingsResponse] = await Promise.all([
    fetch(apiUrl(`/api/admin/slot-control?date=${encodeURIComponent(date)}`), {
      credentials: "same-origin"
    }),
    fetch(apiUrl(`/api/admin/bookings?date=${encodeURIComponent(date)}`), {
      credentials: "same-origin"
    })
  ]);
  const slotControlData = await slotControlResponse.json();
  const bookingsData = await bookingsResponse.json();

  if (!slotControlResponse.ok) {
    throw new Error(slotControlData.message || "Could not load slot availability.");
  }
  if (!bookingsResponse.ok) {
    throw new Error(bookingsData.message || "Could not load slot bookings.");
  }

  renderSlotControl({
    date,
    slots: slotControlData.slots || [],
    bookings: bookingsData.bookings || [],
    stats: slotControlData.stats || {}
  });
}

async function updateSlotControl(card) {
  const date = slotControlDate.value || todayIsoDate();
  const time = card.dataset.slotTime;
  const status = card.querySelector("[data-slot-status]").value;
  const rawCapacity = Number(card.querySelector("[data-slot-capacity]").value);
  const capacity = Math.max(1, Math.min(20, Math.round(Number.isFinite(rawCapacity) ? rawCapacity : 1)));

  const response = await fetch(apiUrl("/api/admin/slot-control"), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, time, status, capacity })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not save slot settings.");
  }

  setAdminMessage("success", `${time} saved as ${status === "open" ? "open" : "closed"} with capacity ${capacity}.`);
  await Promise.all([
    loadSlotOccupancy(),
    loadScheduleSettings()
  ]);
}

async function freeBookedSlot(id) {
  const freeButton = [...slotControlGrid.querySelectorAll("[data-free-slot]")]
    .find((button) => button.dataset.freeSlot === id);
  const card = freeButton?.closest(".slot-card");
  const label = card?.querySelector(".slot-card-header strong")?.textContent || "this time";
  if (!window.confirm(`Free ${label}? This will cancel the booking and make the appointment slot available again.`)) {
    return;
  }

  const response = await fetch(apiUrl(`/api/admin/bookings/${id}/free-slot`), {
    method: "POST",
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not free this slot.");
  }

  setAdminMessage("success", `${data.booking.reference} cancelled. The slot is now open.`);
  await Promise.all([
    loadSlotOccupancy(),
    loadBookings()
  ]);
}

function productSummary(products) {
  return products.map((product) => {
    const quantity = product.quantity > 1 ? ` x ${product.quantity}` : "";
    return `${product.name}${quantity}`;
  }).join(", ");
}

function serviceFieldsSummary(booking) {
  const entries = Object.entries(booking.serviceFields || {})
    .filter(([, value]) => String(value || "").trim() !== "");
  if (!entries.length) {
    return "";
  }

  return `
    <details class="lead-fields service-field-summary">
      <summary>${entries.length} service detail${entries.length === 1 ? "" : "s"}</summary>
      <dl>
        ${entries.map(([key, value]) => `
          <dt>${escapeHtml(key)}</dt>
          <dd>${escapeHtml(value)}</dd>
        `).join("")}
      </dl>
    </details>
  `;
}

function attachmentSummary(booking) {
  if (!booking.attachments?.length) {
    return `<span class="muted">None</span>`;
  }

  return booking.attachments.map((attachment) => `
    <a href="${apiUrl(`/api/admin/attachments/${encodeURIComponent(attachment.id)}`)}" target="_blank" rel="noreferrer">
      ${escapeHtml(attachment.originalName)}
    </a>
  `).join("<br>");
}

function paymentLink(booking) {
  if (!booking.squarePaymentLinkUrl) {
    return "";
  }
  return `<div><a href="${booking.squarePaymentLinkUrl}" target="_blank" rel="noreferrer">Square link</a></div>`;
}

function bookingTimeline(booking) {
  if (!booking.events?.length) {
    return `<div class="timeline-list muted">No timeline yet.</div>`;
  }

  return `
    <div class="timeline-list">
      <strong>Timeline</strong>
      ${booking.events.slice(0, 6).map((event) => `
        <div class="timeline-item">
          <span>${escapeHtml(event.createdAt)}</span>
          <small>${escapeHtml(event.summary)}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStats(bookings) {
  const newCount = bookings.filter((booking) => booking.status === "new").length;
  const pendingPayments = bookings.filter((booking) => booking.paymentStatus === "pending").length;
  const totalCents = bookings.reduce((sum, booking) => sum + booking.totalCents, 0);
  adminStats.innerHTML = `
    <span>${bookings.length} bookings</span>
    <span>${newCount} new</span>
    <span>${pendingPayments} payment pending</span>
    <span>${formatCad(totalCents)} total</span>
  `;
}

// ---- Bookings inbox (master list + detail panel) -------------------------

function bookingListItem(booking) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "inbox-item" + (booking.id === selectedBookingId ? " active" : "");
  item.dataset.select = booking.id;
  const when =
    booking.appointmentDate && booking.appointmentTime
      ? `${escapeHtml(booking.appointmentDate)} · ${escapeHtml(booking.appointmentTime)}`
      : "Callback request";
  item.innerHTML = `
    <span class="inbox-item-dot status-${escapeHtml(booking.status)}"></span>
    <span class="inbox-item-main">
      <span class="inbox-item-name">${escapeHtml(booking.firstName)} ${escapeHtml(booking.lastName)}</span>
      <span class="inbox-item-email">${escapeHtml(booking.email)}</span>
      <span class="inbox-item-meta">${when}</span>
    </span>
    <span class="inbox-item-amount">${escapeHtml(formatCad(booking.totalCents))}</span>
  `;
  return item;
}

function detailRow(label, value) {
  if (value === "" || value == null) return "";
  return `<div class="detail-row"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

function renderBookingDetail(booking) {
  if (!booking) {
    bookingDetail.innerHTML = `<div class="inbox-empty">Select a booking to see the details.</div>`;
    return;
  }

  const appointment =
    booking.appointmentDate && booking.appointmentTime
      ? `${escapeHtml(booking.appointmentDate)} at ${escapeHtml(booking.appointmentTime)} <span class="muted">(${escapeHtml(booking.timezone)})</span>`
      : `<span class="pill pill-amber">Callback request</span>`;

  bookingDetail.innerHTML = `
    <div class="detail-head">
      <div>
        <h2>${escapeHtml(booking.firstName)} ${escapeHtml(booking.lastName)}</h2>
        <a class="detail-email" href="mailto:${encodeURIComponent(booking.email)}">${escapeHtml(booking.email)}</a>
      </div>
      <span class="detail-ref">${escapeHtml(booking.reference)}</span>
    </div>

    <dl class="detail-list">
      ${detailRow("Submitted", escapeHtml(booking.createdAt))}
      ${detailRow("Appointment", appointment)}
      ${detailRow("Reason for visit", booking.visitReason ? escapeHtml(booking.visitReason) : "")}
      ${detailRow("Gender", `<span class="pill">${escapeHtml(booking.gender)}</span>`)}
      ${detailRow("Date of birth", escapeHtml(booking.dateOfBirth))}
      ${detailRow("Phone", `<a href="tel:${encodeURIComponent(booking.phone)}">${escapeHtml(booking.phone)}</a>`)}
      ${detailRow("Address", `${escapeHtml(booking.streetAddress)}<br>${escapeHtml(booking.city)}, ${escapeHtml(booking.province)} ${escapeHtml(booking.postalCode)}`)}
      ${detailRow("Care option", escapeHtml(booking.careOption))}
      ${detailRow("Health card", booking.activeHealthCard === "yes" ? `Active${booking.phn ? " · PHN " + escapeHtml(booking.phn) : ""}` : "Not active")}
      ${detailRow("Reminder", escapeHtml(booking.reminderPreference))}
      ${detailRow("Service", `${escapeHtml(productSummary(booking.products))}${serviceFieldsSummary(booking)}`)}
      ${detailRow("Total", `<strong>${escapeHtml(formatCad(booking.totalCents))}</strong>`)}
      ${detailRow("Attachments", attachmentSummary(booking))}
    </dl>

    <div class="detail-actions">
      <label>Status
        <select data-status="${booking.id}">
          <option value="new">New</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No-show</option>
        </select>
      </label>
      <label>Payment
        <select data-payment="${booking.id}">
          <option value="not_required">Not required</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="refunded">Refunded</option>
        </select>
      </label>
      <label class="detail-notes">Internal notes
        <textarea data-notes="${booking.id}" class="notes-input" placeholder="Add a private note for staff">${escapeHtml(booking.internalNotes || "")}</textarea>
      </label>
      ${paymentLink(booking)}
      <button type="button" class="primary-button" data-update="${booking.id}">Save changes</button>
    </div>

    ${bookingTimeline(booking)}
  `;
  bookingDetail.querySelector(`[data-status="${booking.id}"]`).value = booking.status;
  bookingDetail.querySelector(`[data-payment="${booking.id}"]`).value = booking.paymentStatus;
}

function renderBookings(bookings) {
  bookingList.innerHTML = "";
  if (!bookings.length) {
    bookingList.innerHTML = `<div class="inbox-empty">No bookings found.</div>`;
    renderBookingDetail(null);
    renderStats(bookings);
    return;
  }

  if (!bookings.some((booking) => booking.id === selectedBookingId)) {
    selectedBookingId = bookings[0].id;
  }

  for (const booking of bookings) {
    bookingList.append(bookingListItem(booking));
  }
  renderBookingDetail(bookings.find((booking) => booking.id === selectedBookingId));
  renderStats(bookings);
}

function serviceRequestLabel(requestType) {
  const labels = {
    doctor_note: "Doctor Note",
    prescription_refill: "Prescription Refill"
  };
  return labels[requestType] || "Service Request";
}

function serviceRequestAttachmentSummary(serviceRequest) {
  if (!serviceRequest.attachments?.length) {
    return `<span class="muted">None</span>`;
  }

  return serviceRequest.attachments.map((attachment) => `
    <a href="${apiUrl(`/api/admin/service-request-attachments/${encodeURIComponent(attachment.id)}`)}" target="_blank" rel="noreferrer">
      ${escapeHtml(attachment.originalName)}
    </a>
  `).join("<br>");
}

function renderServiceRequestStats(serviceRequests) {
  const newCount = serviceRequests.filter((request) => request.status === "new").length;
  const pendingPayments = serviceRequests.filter((request) => request.paymentStatus === "pending").length;
  const totalCents = serviceRequests.reduce((sum, request) => sum + request.totalCents, 0);
  serviceRequestStats.innerHTML = `
    <span>${serviceRequests.length} requests</span>
    <span>${newCount} new</span>
    <span>${pendingPayments} payment pending</span>
    <span>${formatCad(totalCents)} total</span>
  `;
}

function serviceRequestDetails(serviceRequest) {
  const dates = serviceRequest.noteStartDate
    ? `<div class="muted">${escapeHtml(serviceRequest.noteStartDate)} to ${escapeHtml(serviceRequest.noteEndDate)}</div>`
    : "";

  return `
    <strong>${escapeHtml(serviceRequestLabel(serviceRequest.requestType))}</strong>
    ${dates}
    <div>${escapeHtml(serviceRequest.reason)}</div>
  `;
}

function serviceRequestRow(serviceRequest) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>
      <strong>${escapeHtml(serviceRequest.reference)}</strong>
      <div class="muted">${escapeHtml(serviceRequest.createdAt)}</div>
    </td>
    <td>
      <strong>${escapeHtml(serviceRequest.firstName)} ${escapeHtml(serviceRequest.lastName)}</strong>
      <div>${escapeHtml(serviceRequest.phone)}</div>
      <div><a href="mailto:${encodeURIComponent(serviceRequest.email)}">${escapeHtml(serviceRequest.email)}</a></div>
      <div class="muted">${escapeHtml(serviceRequest.city)}, ${escapeHtml(serviceRequest.province)}</div>
    </td>
    <td>${serviceRequestDetails(serviceRequest)}</td>
    <td><strong>${formatCad(serviceRequest.totalCents)}</strong></td>
    <td>
      <select data-service-status="${serviceRequest.id}">
        <option value="new">New</option>
        <option value="in_review">In review</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </td>
    <td>
      <select data-service-payment="${serviceRequest.id}">
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="refunded">Refunded</option>
      </select>
      ${paymentLink(serviceRequest)}
    </td>
    <td class="attachment-cell">${serviceRequestAttachmentSummary(serviceRequest)}</td>
    <td>
      <textarea data-service-notes="${serviceRequest.id}" class="notes-input" placeholder="Internal notes">${escapeHtml(serviceRequest.internalNotes || "")}</textarea>
    </td>
    <td>
      <button type="button" class="secondary-button" data-service-update="${serviceRequest.id}">Save</button>
    </td>
  `;
  tr.querySelector(`[data-service-status="${serviceRequest.id}"]`).value = serviceRequest.status;
  tr.querySelector(`[data-service-payment="${serviceRequest.id}"]`).value = serviceRequest.paymentStatus;
  return tr;
}

function renderServiceRequests(serviceRequests) {
  serviceRequestRows.innerHTML = "";
  if (!serviceRequests.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="9" class="muted">No service requests found.</td>`;
    serviceRequestRows.append(tr);
    renderServiceRequestStats(serviceRequests);
    return;
  }

  for (const serviceRequest of serviceRequests) {
    serviceRequestRows.append(serviceRequestRow(serviceRequest));
  }
  renderServiceRequestStats(serviceRequests);
}

function marketingFormLabel(formType) {
  const labels = {
    appointment: "Appointment",
    doctor_note: "Doctor Note",
    prescription_refill: "Prescription Refill"
  };
  return labels[formType] || formType;
}

function leadContact(lead) {
  const fields = lead.fields || {};
  const name = [fields.firstName, fields.lastName].filter(Boolean).join(" ");
  const lines = [
    name ? `<strong>${escapeHtml(name)}</strong>` : "",
    fields.phone ? escapeHtml(fields.phone) : "",
    fields.email ? `<a href="mailto:${escapeHtml(fields.email)}">${escapeHtml(fields.email)}</a>` : ""
  ].filter(Boolean);
  return lines.length ? lines.join("<br>") : `<span class="muted">No contact yet</span>`;
}

function formatLeadValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => escapeHtml(entry)).join("<br>");
  }
  return escapeHtml(value);
}

function leadFieldsSummary(lead) {
  const hiddenKeys = new Set(["draftId"]);
  const entries = Object.entries(lead.fields || {})
    .filter(([key, value]) => !hiddenKeys.has(key) && String(value ?? "").trim() !== "");

  if (!entries.length) {
    return `<span class="muted">No fields saved yet</span>`;
  }

  return `
    <details class="lead-fields">
      <summary>${entries.length} fields saved</summary>
      <dl>
        ${entries.map(([key, value]) => `
          <dt>${escapeHtml(key)}</dt>
          <dd>${formatLeadValue(value)}</dd>
        `).join("")}
      </dl>
    </details>
  `;
}

function renderMarketingStats(leads) {
  const active = leads.filter((lead) => lead.status === "active").length;
  const submitted = leads.filter((lead) => lead.status === "submitted").length;
  marketingStats.innerHTML = `
    <span>${leads.length} drafts</span>
    <span>${active} active</span>
    <span>${submitted} submitted</span>
  `;
}

function marketingRow(lead) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>
      <strong>${escapeHtml(lead.updatedAt)}</strong>
      <div class="muted">${escapeHtml(lead.currentPath)}</div>
    </td>
    <td>
      <strong>${escapeHtml(marketingFormLabel(lead.formType))}</strong>
      <div class="muted">${escapeHtml(lead.id)}</div>
    </td>
    <td>${leadContact(lead)}</td>
    <td>${lead.lastField ? escapeHtml(lead.lastField) : "<span class=\"muted\">Not recorded</span>"}</td>
    <td>${leadFieldsSummary(lead)}</td>
    <td>
      <select data-marketing-status="${lead.id}">
        <option value="active">Active</option>
        <option value="submitted">Submitted</option>
        <option value="archived">Archived</option>
      </select>
    </td>
    <td>
      <button type="button" class="secondary-button" data-marketing-update="${lead.id}">Save</button>
    </td>
  `;
  tr.querySelector(`[data-marketing-status="${lead.id}"]`).value = lead.status;
  return tr;
}

function renderMarketingLeads(leads) {
  marketingRows.innerHTML = "";
  if (!leads.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">No abandoned form drafts found.</td>`;
    marketingRows.append(tr);
    renderMarketingStats(leads);
    return;
  }

  for (const lead of leads) {
    marketingRows.append(marketingRow(lead));
  }
  renderMarketingStats(leads);
}

function renderWaitlistStats(entries) {
  const newCount = entries.filter((entry) => entry.status === "new").length;
  const offeredCount = entries.filter((entry) => entry.status === "offered").length;
  waitlistStats.innerHTML = `
    <span>${entries.length} entries</span>
    <span>${newCount} new</span>
    <span>${offeredCount} offered</span>
  `;
}

function waitlistRow(entry) {
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>
      <strong>${escapeHtml(entry.firstName)} ${escapeHtml(entry.lastName)}</strong>
      <div>${escapeHtml(entry.phone)}</div>
      <div><a href="mailto:${escapeHtml(entry.email)}">${escapeHtml(entry.email)}</a></div>
      <div class="muted">${escapeHtml(entry.createdAt)}</div>
    </td>
    <td>
      <strong>${escapeHtml(entry.desiredDate)}</strong>
      <div class="muted">${entry.desiredTime ? escapeHtml(entry.desiredTime) : "Any open time"}</div>
    </td>
    <td>${entry.careOption ? escapeHtml(entry.careOption) : "<span class=\"muted\">Not selected</span>"}</td>
    <td>
      <select data-waitlist-status="${entry.id}">
        <option value="new">New</option>
        <option value="offered">Offered</option>
        <option value="booked">Booked</option>
        <option value="cancelled">Cancelled</option>
      </select>
    </td>
    <td>
      <select data-waitlist-time="${entry.id}">
        <option value="">No time offered</option>
        ${scheduleTimeOptions.map((time) => `<option value="${escapeHtml(time)}">${escapeHtml(time)}</option>`).join("")}
      </select>
    </td>
    <td>
      <textarea data-waitlist-notes="${entry.id}" class="notes-input" placeholder="Follow-up notes">${escapeHtml(entry.notes || "")}</textarea>
    </td>
    <td>
      <button type="button" class="secondary-button" data-waitlist-update="${entry.id}">Save</button>
    </td>
  `;
  tr.querySelector(`[data-waitlist-status="${entry.id}"]`).value = entry.status;
  tr.querySelector(`[data-waitlist-time="${entry.id}"]`).value = entry.desiredTime || "";
  return tr;
}

function renderWaitlist(entries) {
  waitlistRows.innerHTML = "";
  if (!entries.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="7" class="muted">No waitlist entries found.</td>`;
    waitlistRows.append(tr);
    renderWaitlistStats(entries);
    return;
  }

  for (const entry of entries) {
    waitlistRows.append(waitlistRow(entry));
  }
  renderWaitlistStats(entries);
}

function monthDateForCalendar() {
  if (dateFilter.value) {
    return new Date(`${dateFilter.value}T12:00:00`);
  }
  return new Date();
}

function renderCalendar(bookings) {
  const baseDate = monthDateForCalendar();
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const bookingsByDate = new Map();

  for (const booking of bookings) {
    if (!bookingsByDate.has(booking.appointmentDate)) {
      bookingsByDate.set(booking.appointmentDate, []);
    }
    bookingsByDate.get(booking.appointmentDate).push(booking);
  }

  const cells = [];
  for (let index = 0; index < mondayOffset; index += 1) {
    cells.push(`<div class="admin-calendar-day blank"></div>`);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isoDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayBookings = bookingsByDate.get(isoDate) || [];
    cells.push(`
      <div class="admin-calendar-day">
        <strong>${day}</strong>
        <div class="calendar-bookings">
          ${dayBookings.map((booking) => `
            <div class="calendar-booking ${escapeHtml(booking.status)}">
              <span>${escapeHtml(booking.appointmentTime)}</span>
              <b>${escapeHtml(booking.firstName)} ${escapeHtml(booking.lastName)}</b>
              <small>${escapeHtml(booking.status)}</small>
            </div>
          `).join("")}
        </div>
      </div>
    `);
  }

  adminCalendar.innerHTML = `
    <div class="calendar-heading">
      <h2>${monthFormat.format(baseDate)}</h2>
      <span>${bookings.length} matching bookings</span>
    </div>
    <div class="admin-weekdays">
      <span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span>
    </div>
    <div class="admin-calendar-grid">${cells.join("")}</div>
  `;
}

function renderCurrentView() {
  if (activePage !== "bookings") {
    bookingTableWrap.hidden = true;
    adminCalendar.hidden = true;
    return;
  }

  if (currentView === "calendar") {
    bookingTableWrap.hidden = true;
    adminCalendar.hidden = false;
    listViewButton.classList.remove("active");
    calendarViewButton.classList.add("active");
    renderCalendar(currentBookings);
    return;
  }

  adminCalendar.hidden = true;
  bookingTableWrap.hidden = false;
  calendarViewButton.classList.remove("active");
  listViewButton.classList.add("active");
  renderBookings(currentBookings);
}

async function loadBookings() {
  clearAdminMessage();
  updateExportLinks();
  const query = currentQuery();
  const response = await fetch(apiUrl(query ? `/api/admin/bookings?${query}` : "/api/admin/bookings"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load bookings.");
  }

  currentBookings = data.bookings;
  renderCurrentView();
  await loadDashboardStats();
}

async function updateBooking(id) {
  const status = document.querySelector(`[data-status="${id}"]`).value;
  const paymentStatus = document.querySelector(`[data-payment="${id}"]`).value;
  const internalNotes = document.querySelector(`[data-notes="${id}"]`).value;
  const response = await fetch(apiUrl(`/api/admin/bookings/${id}`), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, paymentStatus, internalNotes })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not update booking.");
  }

  setAdminMessage("success", `${data.booking.reference} updated.`);
  await loadBookings();
  await loadSlotOccupancy();
}

async function loadServiceRequests() {
  const query = serviceRequestQuery();
  const response = await fetch(apiUrl(query ? `/api/admin/service-requests?${query}` : "/api/admin/service-requests"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load service requests.");
  }

  renderServiceRequests(data.serviceRequests);
}

async function loadMarketingLeads() {
  const query = marketingQuery();
  const response = await fetch(apiUrl(query ? `/api/admin/marketing-leads?${query}` : "/api/admin/marketing-leads"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load marketing drafts.");
  }

  renderMarketingLeads(data.leads);
}

async function loadWaitlist() {
  const query = waitlistQuery();
  const response = await fetch(apiUrl(query ? `/api/admin/waitlist?${query}` : "/api/admin/waitlist"), {
    credentials: "same-origin"
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not load waitlist.");
  }

  renderWaitlist(data.waitlistEntries || []);
}

async function updateServiceRequest(id) {
  const status = document.querySelector(`[data-service-status="${id}"]`).value;
  const paymentStatus = document.querySelector(`[data-service-payment="${id}"]`).value;
  const internalNotes = document.querySelector(`[data-service-notes="${id}"]`).value;
  const response = await fetch(apiUrl(`/api/admin/service-requests/${id}`), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, paymentStatus, internalNotes })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not update service request.");
  }

  setAdminMessage("success", `${data.serviceRequest.reference} updated.`);
  await loadServiceRequests();
}

async function updateMarketingLead(id) {
  const status = document.querySelector(`[data-marketing-status="${id}"]`).value;
  const response = await fetch(apiUrl(`/api/admin/marketing-leads/${id}`), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not update marketing draft.");
  }

  setAdminMessage("success", `Marketing draft ${data.lead.id} updated.`);
  await loadMarketingLeads();
}

async function updateWaitlistEntry(id) {
  const status = document.querySelector(`[data-waitlist-status="${id}"]`).value;
  const desiredTime = document.querySelector(`[data-waitlist-time="${id}"]`).value;
  const notes = document.querySelector(`[data-waitlist-notes="${id}"]`).value;
  const response = await fetch(apiUrl(`/api/admin/waitlist/${id}`), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, desiredTime, notes })
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Could not update waitlist entry.");
  }

  setAdminMessage("success", `${data.waitlistEntry.firstName} ${data.waitlistEntry.lastName} waitlist entry updated.`);
  await loadWaitlist();
}

for (const card of navCards) {
  card.addEventListener("click", () => {
    showPage(card.dataset.go);
  });
}

refreshButton.addEventListener("click", () => {
  loadBookings().catch((error) => setAdminMessage("error", error.message));
});

slotControlRefreshButton.addEventListener("click", () => {
  loadSlotOccupancy().catch((error) => setAdminMessage("error", error.message));
});

slotControlDate.addEventListener("change", () => {
  loadSlotOccupancy().catch((error) => setAdminMessage("error", error.message));
});

serviceRequestRefreshButton.addEventListener("click", () => {
  loadServiceRequests().catch((error) => setAdminMessage("error", error.message));
});

marketingRefreshButton.addEventListener("click", () => {
  loadMarketingLeads().catch((error) => setAdminMessage("error", error.message));
});

waitlistRefreshButton.addEventListener("click", () => {
  loadWaitlist().catch((error) => setAdminMessage("error", error.message));
});

addServiceButton.addEventListener("click", () => {
  currentServices = [...currentServices, newServiceDraft()];
  renderServiceBuilder(currentServices);
});

saveServicesButton.addEventListener("click", () => {
  saveServices().catch((error) => setAdminMessage("error", error.message));
});

statusFilter.addEventListener("change", () => {
  loadBookings().catch((error) => setAdminMessage("error", error.message));
});

dateFilter.addEventListener("change", () => {
  loadBookings().catch((error) => setAdminMessage("error", error.message));
});

searchFilter.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    loadBookings().catch((error) => setAdminMessage("error", error.message));
  }, 250);
});

serviceRequestSearchFilter.addEventListener("input", () => {
  clearTimeout(serviceRequestSearchDebounce);
  serviceRequestSearchDebounce = setTimeout(() => {
    loadServiceRequests().catch((error) => setAdminMessage("error", error.message));
  }, 250);
});

serviceRequestTypeFilter.addEventListener("change", () => {
  loadServiceRequests().catch((error) => setAdminMessage("error", error.message));
});

serviceRequestStatusFilter.addEventListener("change", () => {
  loadServiceRequests().catch((error) => setAdminMessage("error", error.message));
});

marketingSearchFilter.addEventListener("input", () => {
  clearTimeout(marketingSearchDebounce);
  marketingSearchDebounce = setTimeout(() => {
    loadMarketingLeads().catch((error) => setAdminMessage("error", error.message));
  }, 250);
});

marketingFormTypeFilter.addEventListener("change", () => {
  loadMarketingLeads().catch((error) => setAdminMessage("error", error.message));
});

marketingStatusFilter.addEventListener("change", () => {
  loadMarketingLeads().catch((error) => setAdminMessage("error", error.message));
});

waitlistSearchFilter.addEventListener("input", () => {
  clearTimeout(waitlistSearchDebounce);
  waitlistSearchDebounce = setTimeout(() => {
    loadWaitlist().catch((error) => setAdminMessage("error", error.message));
  }, 250);
});

waitlistStatusFilter.addEventListener("change", () => {
  loadWaitlist().catch((error) => setAdminMessage("error", error.message));
});

waitlistDateFilter.addEventListener("change", () => {
  loadWaitlist().catch((error) => setAdminMessage("error", error.message));
});

scheduleDays.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-range]");
  if (addButton) {
    appendScheduleRange(addButton.dataset.addRange);
    setDayOpenState(addButton.dataset.addRange);
    return;
  }

  const addBreakButton = event.target.closest("[data-add-break]");
  if (addBreakButton) {
    appendScheduleBreak(addBreakButton.dataset.addBreak);
    setDayOpenState(addBreakButton.dataset.addBreak);
    return;
  }

  const removeButton = event.target.closest("[data-remove-range]");
  if (removeButton) {
    const dayKey = removeButton.dataset.removeRange;
    removeButton.closest("[data-range-row]")?.remove();
    ensureRangeEmptyState(dayKey);
    return;
  }

  const removeBreakButton = event.target.closest("[data-remove-break]");
  if (removeBreakButton) {
    const dayKey = removeBreakButton.dataset.removeBreak;
    removeBreakButton.closest("[data-break-row]")?.remove();
    ensureBreakEmptyState(dayKey);
  }
});

scheduleDays.addEventListener("change", (event) => {
  const dayToggle = event.target.closest("[data-day-open]");
  if (!dayToggle) {
    return;
  }

  const dayKey = dayToggle.dataset.dayOpen;
  if (dayToggle.checked && !scheduleDays.querySelector(`[data-day-ranges="${dayKey}"] [data-range-row]`)) {
    appendScheduleRange(dayKey);
  }
  ensureBreakEmptyState(dayKey);
  setDayOpenState(dayKey);
});

addBlockedDateButton.addEventListener("click", () => {
  if (addDateChip(blockedDatesList, blockedDatePicker.value)) {
    blockedDatePicker.value = "";
  }
});

addBlockedSlotButton.addEventListener("click", () => {
  if (addSlotChip(blockedSlotsList, blockedSlotDate.value, blockedSlotTime.value)) {
    blockedSlotDate.value = "";
  }
});

addExtraSlotButton.addEventListener("click", () => {
  if (addSlotChip(extraSlotsList, extraSlotDate.value, extraSlotTime.value)) {
    extraSlotDate.value = "";
  }
});

for (const list of [blockedDatesList, blockedSlotsList, extraSlotsList]) {
  list.addEventListener("click", (event) => {
    const chip = event.target.closest(".schedule-chip");
    if (chip) {
      removeScheduleChip(chip);
    }
  });
}

listViewButton.addEventListener("click", () => {
  currentView = "list";
  renderCurrentView();
});

calendarViewButton.addEventListener("click", () => {
  currentView = "calendar";
  renderCurrentView();
});

bookingList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-select]");
  if (!item) {
    return;
  }
  selectedBookingId = item.dataset.select;
  renderBookings(currentBookings);
});

bookingDetail.addEventListener("click", (event) => {
  const button = event.target.closest("[data-update]");
  if (!button) {
    return;
  }
  updateBooking(button.dataset.update).catch((error) => setAdminMessage("error", error.message));
});

slotControlGrid.addEventListener("click", (event) => {
  const saveButton = event.target.closest("[data-save-slot]");
  if (saveButton) {
    const card = saveButton.closest("[data-slot-card]");
    updateSlotControl(card).catch((error) => setAdminMessage("error", error.message));
    return;
  }

  const button = event.target.closest("[data-free-slot]");
  if (!button) {
    return;
  }
  freeBookedSlot(button.dataset.freeSlot).catch((error) => setAdminMessage("error", error.message));
});

serviceRequestRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-service-update]");
  if (!button) {
    return;
  }
  updateServiceRequest(button.dataset.serviceUpdate).catch((error) => setAdminMessage("error", error.message));
});

marketingRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-marketing-update]");
  if (!button) {
    return;
  }
  updateMarketingLead(button.dataset.marketingUpdate).catch((error) => setAdminMessage("error", error.message));
});

waitlistRows.addEventListener("click", (event) => {
  const button = event.target.closest("[data-waitlist-update]");
  if (!button) {
    return;
  }
  updateWaitlistEntry(button.dataset.waitlistUpdate).catch((error) => setAdminMessage("error", error.message));
});

saveReminderSettings.addEventListener("click", () => {
  updateReminderSettings().catch((error) => setAdminMessage("error", error.message));
});

saveEmailSettings.addEventListener("click", () => {
  updateEmailSettings().catch((error) => setAdminMessage("error", error.message));
});

saveCancellationPolicy.addEventListener("click", () => {
  updateCancellationPolicy().catch((error) => setAdminMessage("error", error.message));
});

for (const button of document.querySelectorAll("[data-save-email-settings]")) {
  button.addEventListener("click", () => {
    updateEmailSettings().catch((error) => setAdminMessage("error", error.message));
  });
}

sendTestEmailButton.addEventListener("click", () => {
  sendTestEmail().catch((error) => setAdminMessage("error", error.message));
});

saveScheduleSettings.addEventListener("click", () => {
  updateScheduleSettings().catch((error) => setAdminMessage("error", error.message));
});

showPage(activePage);

loadReminderSettings().catch((error) => setAdminMessage("error", error.message));
loadEmailSettings().catch((error) => setAdminMessage("error", error.message));
loadCancellationPolicy().catch((error) => setAdminMessage("error", error.message));
loadScheduleSettings().catch((error) => setAdminMessage("error", error.message));
loadServices().catch((error) => setAdminMessage("error", error.message));
loadDashboardStats().catch((error) => setAdminMessage("error", error.message));
loadSlotOccupancy().catch((error) => setAdminMessage("error", error.message));
loadBookings().catch((error) => setAdminMessage("error", error.message));
loadMarketingLeads().catch((error) => setAdminMessage("error", error.message));
loadWaitlist().catch((error) => setAdminMessage("error", error.message));
loadServiceRequests().catch((error) => setAdminMessage("error", error.message));
