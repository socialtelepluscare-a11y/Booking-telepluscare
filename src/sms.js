function isSmsConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

function normalizeNorthAmericanPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  return String(value || "").trim();
}

function reminderMessage(booking) {
  return [
    `TelePlus Care reminder: ${booking.appointmentDate} at ${booking.appointmentTime} (${booking.timezone}).`,
    `Reference ${booking.reference}.`,
    "If this is an emergency, call 911."
  ].join(" ");
}

async function sendSmsReminder(booking) {
  const to = normalizeNorthAmericanPhone(booking.phone);
  const body = reminderMessage(booking);

  if (!isSmsConfigured()) {
    console.log("SMS is not configured. Reminder SMS preview:");
    console.log(`To: ${to}`);
    console.log(body);
    return { sent: false, reason: "sms_not_configured" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const bodyParams = new URLSearchParams({
    From: process.env.TWILIO_FROM_NUMBER,
    To: to,
    Body: body
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: bodyParams
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.message || "Twilio SMS reminder failed.");
  }

  return { sent: true, sid: payload.sid };
}

module.exports = {
  isSmsConfigured,
  sendSmsReminder
};
