const crypto = require("crypto");

const SQUARE_API_VERSION = process.env.SQUARE_API_VERSION || "2026-05-20";

function getSquareBaseUrl() {
  return process.env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

function isSquareConfigured() {
  return Boolean(process.env.SQUARE_ACCESS_TOKEN && process.env.SQUARE_LOCATION_ID);
}

function buildReturnUrl(reference) {
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${baseUrl.replace(/\/$/, "")}/payment-return?reference=${encodeURIComponent(reference)}`;
}

async function createSquarePaymentLinkForCharge(charge) {
  if (!isSquareConfigured()) {
    return null;
  }

  const response = await fetch(`${getSquareBaseUrl()}/v2/online-checkout/payment-links`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_API_VERSION
    },
    body: JSON.stringify({
      // Stable per charge so a retry reuses the same payment link instead of
      // creating a duplicate order. Square dedupes on this key.
      idempotency_key: `teleplus-${charge.reference}`,
      description: charge.description,
      quick_pay: {
        name: charge.name,
        price_money: {
          amount: charge.totalCents,
          currency: process.env.SQUARE_CURRENCY || "CAD"
        },
        location_id: process.env.SQUARE_LOCATION_ID
      },
      checkout_options: {
        redirect_url: buildReturnUrl(charge.reference)
      },
      pre_populated_data: {
        buyer_email: charge.email,
        buyer_phone_number: charge.phone
      },
      payment_note: charge.paymentNote
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload.errors?.map((error) => error.detail || error.code).join(" ") ||
      "Square payment link could not be created.";
    const error = new Error(message);
    error.statusCode = 502;
    throw error;
  }

  return {
    id: payload.payment_link?.id || "",
    url: payload.payment_link?.url || "",
    orderId: payload.related_resources?.orders?.[0]?.id || payload.payment_link?.order_id || ""
  };
}

async function createSquarePaymentLink(booking) {
  return createSquarePaymentLinkForCharge({
    reference: booking.reference,
    totalCents: booking.totalCents,
    email: booking.email,
    phone: booking.phone,
    description: `TelePlus Care booking ${booking.reference}`,
    name: `TelePlus Care appointment ${booking.reference}`,
    paymentNote: `TelePlus Care booking ${booking.reference}`
  });
}

async function createSquarePaymentLinkForServiceRequest(serviceRequest) {
  const serviceNames = {
    doctor_note: "Doctor Note Service",
    prescription_refill: "Prescription Refill"
  };
  const serviceName = serviceNames[serviceRequest.requestType] || "TelePlus Care Service";

  return createSquarePaymentLinkForCharge({
    reference: serviceRequest.reference,
    totalCents: serviceRequest.totalCents,
    email: serviceRequest.email,
    phone: serviceRequest.phone,
    description: `TelePlus Care ${serviceName} ${serviceRequest.reference}`,
    name: `${serviceName} ${serviceRequest.reference}`,
    paymentNote: `TelePlus Care service request ${serviceRequest.reference}`
  });
}

function isSquareWebhookConfigured() {
  return Boolean(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
}

function getSquareWebhookUrl() {
  if (process.env.SQUARE_WEBHOOK_URL) {
    return process.env.SQUARE_WEBHOOK_URL;
  }
  const baseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${baseUrl.replace(/\/$/, "")}/api/square/webhook`;
}

// Square signs each webhook: signature = base64( HMAC-SHA256(key, notificationUrl + rawBody) ).
// The notification URL must match EXACTLY what Square posted to. Proxies,
// http/https drift, or APP_BASE_URL drift can break a single hard-coded URL, so
// we verify against several candidates (configured URL, the actual request URL,
// and the derived default) and accept if any matches.
function verifySquareWebhookSignature(rawBody, signatureHeader, requestUrl) {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signatureHeader) {
    return false;
  }

  const providedBuffer = Buffer.from(String(signatureHeader));
  const body = rawBody ? rawBody.toString("utf8") : "";

  const candidates = new Set();
  if (process.env.SQUARE_WEBHOOK_URL) candidates.add(process.env.SQUARE_WEBHOOK_URL);
  if (requestUrl) candidates.add(requestUrl);
  candidates.add(getSquareWebhookUrl());

  for (const url of candidates) {
    const expected = crypto.createHmac("sha256", key).update(url + body).digest("base64");
    const expectedBuffer = Buffer.from(expected);
    if (
      expectedBuffer.length === providedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return true;
    }
  }
  return false;
}

module.exports = {
  createSquarePaymentLink,
  createSquarePaymentLinkForServiceRequest,
  getSquareWebhookUrl,
  isSquareConfigured,
  isSquareWebhookConfigured,
  verifySquareWebhookSignature
};
