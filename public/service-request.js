const requestForm = document.querySelector("#serviceRequestForm");
const formMessage = document.querySelector("#formMessage");
const paymentNote = document.querySelector("#paymentNote");
const reasonInput = document.querySelector("#reason");
const reasonCount = document.querySelector("#reasonCount");
const noteStartDate = document.querySelector("#noteStartDate");
const noteEndDate = document.querySelector("#noteEndDate");
const fileInput = document.querySelector("#attachments");
const submitButton = requestForm.querySelector("button[type='submit']");

// Prescription-refill only: Alberta Health Card holders pay nothing.
const activeHealthCard = document.querySelector("#activeHealthCard");
const phnField = document.querySelector("#phnField");
const phnInput = document.querySelector("#phn");
const feeCategory = document.querySelector("#feeCategory");
const feeTotalPill = document.querySelector("#feeTotalPill");
const feePrice = document.querySelector("#feePrice");
const summaryTotal = document.querySelector("#summaryTotal");
const paymentSection = document.querySelector("#paymentSection");
const PRESCRIPTION_FEE = "$50.00 CAD";

function syncHealthCardPricing() {
  if (!activeHealthCard) {
    return; // not the prescription form (e.g. doctor note)
  }
  const isFree = activeHealthCard.value === "yes";

  if (phnField) phnField.hidden = !isFree;
  if (phnInput) {
    phnInput.required = isFree;
    if (!isFree) phnInput.value = "";
  }

  const priceText = isFree ? "$0.00 CAD" : PRESCRIPTION_FEE;
  if (feeTotalPill) feeTotalPill.textContent = priceText;
  if (feePrice) feePrice.textContent = priceText;
  if (summaryTotal) summaryTotal.textContent = priceText;
  if (feeCategory) {
    feeCategory.textContent = isFree ? "Free with active Alberta Health Card" : "$50 for up to 3 medications";
  }

  // No payment step when it's free.
  if (paymentSection) paymentSection.hidden = isFree;
  const paymentRadio = requestForm.querySelector('input[name="paymentMethod"]');
  if (paymentRadio) {
    paymentRadio.required = !isFree;
    paymentRadio.disabled = isFree;
  }
}

const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
let paymentConfig = { provider: "square", squareConfigured: false };

function formatCad(cents) {
  return `${currency.format(cents / 100)} CAD`;
}

function setMessage(type, text) {
  formMessage.className = `form-message show ${type}`;
  formMessage.textContent = text;
}

function clearMessage() {
  formMessage.className = "form-message";
  formMessage.textContent = "";
}

function loadRecaptcha(siteKey) {
  if (!siteKey || document.querySelector("script[data-recaptcha]")) {
    return;
  }

  const script = document.createElement("script");
  script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
  script.async = true;
  script.defer = true;
  script.dataset.recaptcha = "true";
  document.head.append(script);
}

function getRecaptchaToken() {
  if (!paymentConfig.recaptchaSiteKey) {
    return "";
  }

  return new Promise((resolve, reject) => {
    if (!window.grecaptcha) {
      reject(new Error("Spam-protection check is still loading. Please try again."));
      return;
    }

    window.grecaptcha.ready(() => {
      window.grecaptcha
        .execute(paymentConfig.recaptchaSiteKey, { action: "service_request" })
        .then(resolve)
        .catch(() => reject(new Error("Spam-protection check failed. Please try again.")));
    });
  });
}

function validUsDate(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value || "");
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function validateDoctorNoteRange() {
  if (!noteStartDate || !noteEndDate || !noteStartDate.value || !noteEndDate.value) {
    return true;
  }

  const start = validUsDate(noteStartDate.value);
  const end = validUsDate(noteEndDate.value);
  if (!start || !end) {
    return true;
  }

  const dayRange = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  if (dayRange < 1) {
    setMessage("error", "Doctor note end date cannot be before the start date.");
    return false;
  }

  if (dayRange > 7) {
    setMessage("error", "Doctor note date range must not exceed 7 days.");
    return false;
  }

  return true;
}

function updateReasonCount() {
  reasonCount.textContent = `${reasonInput.value.length}/150`;
}

function validateFiles() {
  if (!fileInput || !fileInput.required) {
    return true;
  }

  if (fileInput.files.length === 0) {
    setMessage("error", "Please upload proof of current medication use.");
    return false;
  }

  return true;
}

async function submitServiceRequest(event) {
  event.preventDefault();
  clearMessage();

  if (!requestForm.reportValidity()) {
    return;
  }

  if (!validateDoctorNoteRange() || !validateFiles()) {
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    const formData = new FormData(requestForm);
    formData.set("recaptchaToken", await getRecaptchaToken());

    const response = await fetch("/api/service-requests", {
      method: "POST",
      body: formData
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details?.join(" ") || data.message || "Request could not be submitted.");
    }

    const request = data.serviceRequest;
    if (request.paymentUrl) {
      setMessage("success", `Request submitted. Reference ${request.reference}. Redirecting to Square secure checkout.`);
      window.location.href = request.paymentUrl;
      return;
    }

    requestForm.reset();
    updateReasonCount();
    setMessage(
      "success",
      `Request submitted. Reference ${request.reference}. Total ${formatCad(request.totalCents)}. Staff will follow up if payment is still pending.`
    );
  } catch (error) {
    setMessage("error", error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = requestForm.dataset.submitLabel || "Submit Request";
  }
}

async function init() {
  const response = await fetch("/api/payment-config");
  paymentConfig = await response.json();
  loadRecaptcha(paymentConfig.recaptchaSiteKey);

  paymentNote.textContent = paymentConfig.squareConfigured
    ? "After you submit, you will continue to Square secure checkout."
    : "Square is selected. Add Square credentials on the server to collect this payment automatically.";

  updateReasonCount();
  syncHealthCardPricing();
}

reasonInput.addEventListener("input", updateReasonCount);
if (activeHealthCard) {
  activeHealthCard.addEventListener("change", syncHealthCardPricing);
}
requestForm.addEventListener("submit", submitServiceRequest);

init().catch((error) => setMessage("error", error.message));
