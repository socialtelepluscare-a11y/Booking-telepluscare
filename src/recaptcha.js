function isRecaptchaConfigured() {
  return Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

let warnedMissingRecaptcha = false;

function isRecaptchaDisabled() {
  return ["1", "true", "yes", "on"].includes(String(process.env.DISABLE_RECAPTCHA || "").toLowerCase());
}

async function verifyRecaptcha(token, remoteIp) {
  // Explicit opt-out: skip spam protection entirely, even in production.
  // Set DISABLE_RECAPTCHA=true to launch without reCAPTCHA (re-enable later by
  // removing it and adding RECAPTCHA_SITE_KEY + RECAPTCHA_SECRET_KEY).
  if (isRecaptchaDisabled()) {
    return { success: true, skipped: true };
  }

  if (!isRecaptchaConfigured()) {
    // Fail CLOSED in production: a missing key must not silently disable bot
    // protection on a live deployment. In non-production we allow submissions
    // but log a loud one-time warning so it is obvious during local testing.
    if (process.env.NODE_ENV === "production") {
      const error = new Error("Spam protection is not configured. Please contact the clinic to book.");
      error.statusCode = 503;
      throw error;
    }
    if (!warnedMissingRecaptcha) {
      console.warn(
        "[recaptcha] RECAPTCHA_SECRET_KEY is not set — bot protection is DISABLED. " +
          "Set it before going to production."
      );
      warnedMissingRecaptcha = true;
    }
    return { success: true, skipped: true };
  }

  if (!token) {
    const error = new Error("Please complete the spam-protection check.");
    error.statusCode = 400;
    throw error;
  }

  const body = new URLSearchParams({
    secret: process.env.RECAPTCHA_SECRET_KEY,
    response: token
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json();

  if (!payload.success) {
    const error = new Error("Spam-protection check failed. Please try again.");
    error.statusCode = 400;
    error.details = payload["error-codes"] || [];
    throw error;
  }

  // reCAPTCHA v3 returns a score (0.0 = bot, 1.0 = human). A valid token alone
  // is not enough — reject low scores so automated submissions are blocked.
  if (typeof payload.score === "number") {
    const minScore = Number(process.env.RECAPTCHA_MIN_SCORE || 0.5);
    if (payload.score < minScore) {
      const error = new Error("Spam-protection check failed. Please try again.");
      error.statusCode = 400;
      error.details = ["low-score", String(payload.score)];
      throw error;
    }
  }

  return payload;
}

module.exports = {
  isRecaptchaConfigured,
  verifyRecaptcha
};
