const { DateTime } = require("luxon");

const { TIME_ZONE } = require("./availability");
const {
  getSetting,
  listReminderCandidates,
  markReminderFailed,
  markReminderSent
} = require("./database");
const { sendAppointmentReminder } = require("./email");
const { sendSmsReminder } = require("./sms");

const REMINDER_SETTING_KEY = "reminder_minutes_before";

function getReminderMinutesBefore() {
  const rawValue = Number(getSetting(REMINDER_SETTING_KEY, process.env.REMINDER_MINUTES_BEFORE || 30));
  if (!Number.isFinite(rawValue)) {
    return 30;
  }
  return Math.max(1, Math.min(1440, Math.round(rawValue)));
}

function bookingDateTime(booking) {
  return DateTime.fromFormat(
    `${booking.appointmentDate} ${booking.appointmentTime}`,
    "yyyy-MM-dd h:mm a",
    { zone: booking.timezone || TIME_ZONE }
  );
}

function preferenceWantsEmail(preference) {
  const value = String(preference || "").toLowerCase();
  return value.includes("email") || (!value.includes("text") && !value.includes("message"));
}

function preferenceWantsSms(preference) {
  const value = String(preference || "").toLowerCase();
  return value.includes("text") || value.includes("message");
}

function shouldSendReminder(booking, now, minutesBefore) {
  const appointmentAt = bookingDateTime(booking);
  if (!appointmentAt.isValid) {
    return false;
  }

  return appointmentAt > now && appointmentAt <= now.plus({ minutes: minutesBefore });
}

async function sendReminder(booking) {
  const results = [];
  const errors = [];
  let emailAttempted = false;

  const tryEmail = async (label) => {
    emailAttempted = true;
    try {
      results.push(await sendAppointmentReminder(booking));
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
    }
  };

  if (preferenceWantsEmail(booking.reminderPreference)) {
    await tryEmail("email");
  }

  if (preferenceWantsSms(booking.reminderPreference)) {
    try {
      results.push(await sendSmsReminder(booking));
    } catch (error) {
      errors.push(`sms: ${error.message}`);
    }
  }

  // A channel that returns { sent: false } (disabled or not configured) is NOT a
  // real delivery. Only count results where something actually went out.
  const wasDelivered = () => results.some((result) => result && result.sent);

  // If the patient's preferred channel could not deliver, fall back to email.
  if (!wasDelivered() && !emailAttempted) {
    await tryEmail("email fallback");
  }

  if (wasDelivered()) {
    markReminderSent(booking.id);
    console.log(`Reminder sent for ${booking.reference}.`);
    return;
  }

  // Leave reminder_sent_at NULL so the booking stays a candidate and retries
  // automatically once email/SMS is configured (or until the appointment passes).
  const skippedReasons = results
    .filter((result) => result && !result.sent && result.reason)
    .map((result) => result.reason);
  const reason = [...errors, ...skippedReasons].join("; ") || "No reminder channel was available.";
  markReminderFailed(booking.id, reason);
}

async function runReminderScan() {
  const minutesBefore = getReminderMinutesBefore();
  const now = DateTime.now().setZone(TIME_ZONE);
  const toDate = now.plus({ days: 2 }).toISODate();
  const candidates = listReminderCandidates(now.toISODate(), toDate);

  for (const booking of candidates) {
    if (!shouldSendReminder(booking, now, minutesBefore)) {
      continue;
    }
    await sendReminder(booking);
  }

  return { checked: candidates.length, minutesBefore };
}

function startReminderService() {
  if (String(process.env.REMINDERS_ENABLED || "true").toLowerCase() === "false") {
    console.log("Appointment reminders are disabled.");
    return;
  }

  let running = false;
  const tick = async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      await runReminderScan();
    } catch (error) {
      console.error("Reminder scan failed:", error.message);
    } finally {
      running = false;
    }
  };

  setTimeout(tick, 2000);
  setInterval(tick, 60 * 1000);
  console.log(`Appointment reminders enabled (${getReminderMinutesBefore()} minutes before).`);
}

module.exports = {
  REMINDER_SETTING_KEY,
  getReminderMinutesBefore,
  runReminderScan,
  startReminderService
};
