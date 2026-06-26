const productList = document.querySelector("#productList");
const productsSection = document.querySelector("#productsSection");
const productGuide = document.querySelector("#productGuide");
const serviceDetailsSection = document.querySelector("#serviceDetailsSection");
const serviceDetailsFields = document.querySelector("#serviceDetailsFields");
const totalAmount = document.querySelector("#totalAmount");
const bookingForm = document.querySelector("#bookingForm");
const careOptionSelect = bookingForm.querySelector('select[name="careOption"]');
const formMessage = document.querySelector("#formMessage");
const calendarMonth = document.querySelector("#calendarMonth");
const calendarDays = document.querySelector("#calendarDays");
const previousMonthButton = document.querySelector("#previousMonth");
const nextMonthButton = document.querySelector("#nextMonth");
const appointmentDateInput = document.querySelector("#appointmentDate");
const appointmentTimeInput = document.querySelector("#appointmentTime");
const dateOfBirthInput = document.querySelector("#dateOfBirth");
const dateOfBirthPicker = document.querySelector("#dateOfBirthPicker");
const selectedDateLabel = document.querySelector("#selectedDateLabel");
const slotGrid = document.querySelector("#slotGrid");
const activeHealthCard = document.querySelector("#activeHealthCard");
const phnInput = document.querySelector("#phn");
const phnField = document.querySelector("#phnField");
const clinicClock = document.querySelector("#clinicClock");
const paymentSection = document.querySelector("#paymentSection");
const paymentNote = document.querySelector("#paymentNote");
const cardPaymentBox = document.querySelector("#cardPaymentBox");
const cardErrors = document.querySelector("#cardErrors");
const snapshotDate = document.querySelector("#snapshotDate");
const snapshotTime = document.querySelector("#snapshotTime");
const snapshotService = document.querySelector("#snapshotService");
const snapshotTotal = document.querySelector("#snapshotTotal");
const stepIndicators = [...document.querySelectorAll(".step-indicator")];
const formSteps = [...document.querySelectorAll(".form-step")];
const provinceInput = bookingForm.querySelector('[name="province"]');
const appointmentGrid = document.querySelector(".appointment-grid");
const outOfProvinceNotice = document.querySelector("#outOfProvinceNotice");

const timeZone = "America/Edmonton";
const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const monthFormat = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" });
const readableDateFormat = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  month: "long",
  day: "numeric"
});

let products = [];
let selectedDate = "";
let currentMonth = new Date();
let currentStep = 1;
let paymentConfig = { provider: "square", squareConfigured: false };
let squareCard = null;
let squareCardLoading = null;

// Lazy-load Square's Web Payments SDK only when a paid booking actually needs it.
function loadSquareSdk(environment) {
  if (window.Square) {
    return Promise.resolve(window.Square);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = environment === "production"
      ? "https://web.squarecdn.com/v1/square.js"
      : "https://sandbox.web.squarecdn.com/v1/square.js";
    script.onload = () => (window.Square ? resolve(window.Square) : reject(new Error("Secure payment form unavailable.")));
    script.onerror = () => reject(new Error("Could not load the secure payment form. Please refresh and try again."));
    document.head.appendChild(script);
  });
}

// Build the embedded card field once; reused across attempts.
async function ensureSquareCard() {
  if (squareCard) {
    return squareCard;
  }
  if (!paymentConfig.squareConfigured || !paymentConfig.squareApplicationId || !paymentConfig.squareLocationId) {
    return null;
  }
  if (!squareCardLoading) {
    squareCardLoading = (async () => {
      const Square = await loadSquareSdk(paymentConfig.squareEnvironment);
      const payments = Square.payments(paymentConfig.squareApplicationId, paymentConfig.squareLocationId);
      const card = await payments.card();
      await card.attach("#card-container");
      squareCard = card;
      return card;
    })().catch((error) => {
      squareCardLoading = null;
      throw error;
    });
  }
  return squareCardLoading;
}

let careOptionProductMap = {
  "Virtual Doctor Visit": "non-active-alberta-health-card",
  "General Medical Care": "non-active-alberta-health-card",
  "Canadian Out of Alberta": "canadian-out-of-alberta",
  "International Visitor to Canada": "international-visitor-to-canada",
  "Doctor Note Online": "doctor-work-note-online",
  "Prescription Refill Online": "nationwide-refill-non-controlled-drugs",
  "Mental Health Counselling Online": "mental-health-counselling-online",
  "Weight Loss Online": "weight-loss-prescription-assessment",
  "Men's Sexual Health Online": "mens-sexual-health-online",
  "Women's Sexual Health Online": "womens-sexual-health-online",
  "Skin / Acne Care Online": "skin-acne-care-online",
  "Hair Loss Treatment Online": "hair-loss-treatment-online",
  "TRT/HRT Wellness": "trt-hrt-initial-assessment"
};

function todayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromIsoDate(isoDate) {
  return new Date(`${isoDate}T12:00:00`);
}

function isoToDob(isoDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(isoDate || ""))) {
    return "";
  }
  const [year, month, day] = isoDate.split("-");
  return `${month}-${day}-${year}`;
}

function dobToIso(dob) {
  const match = String(dob || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) {
    return "";
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
    return "";
  }
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function formatDobTyping(value) {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) {
    return digits;
  }
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
}

function validateDobInput() {
  if (!dateOfBirthInput) {
    return;
  }

  const value = dateOfBirthInput.value.trim();
  if (!value) {
    dateOfBirthInput.setCustomValidity("");
    return;
  }

  if (value.length === 10) {
    const isoDate = dobToIso(value);
    if (!isoDate) {
      dateOfBirthInput.setCustomValidity("Please enter a valid date of birth.");
      return;
    }
    if (isoDate > todayIso()) {
      dateOfBirthInput.setCustomValidity("Date of birth cannot be in the future.");
      return;
    }
  }

  dateOfBirthInput.setCustomValidity("");
}

function syncDobFromPicker() {
  if (!dateOfBirthInput || !dateOfBirthPicker) {
    return;
  }
  dateOfBirthInput.value = isoToDob(dateOfBirthPicker.value);
  validateDobInput();
  dateOfBirthInput.dispatchEvent(new Event("input", { bubbles: true }));
  dateOfBirthInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function syncDobFromText() {
  if (!dateOfBirthInput || !dateOfBirthPicker) {
    return;
  }

  const formatted = formatDobTyping(dateOfBirthInput.value);
  if (dateOfBirthInput.value !== formatted) {
    dateOfBirthInput.value = formatted;
  }

  const isoDate = dobToIso(formatted);
  dateOfBirthPicker.value = isoDate && isoDate <= todayIso() ? isoDate : "";
  validateDobInput();
}

function initDobPicker() {
  if (!dateOfBirthInput || !dateOfBirthPicker) {
    return;
  }
  dateOfBirthPicker.max = todayIso();
  dateOfBirthPicker.min = "1900-01-01";
  if (dateOfBirthInput.value && !dateOfBirthPicker.value) {
    dateOfBirthPicker.value = dobToIso(dateOfBirthInput.value);
  }
  if (dateOfBirthPicker.value && !dateOfBirthInput.value) {
    syncDobFromPicker();
  }
  validateDobInput();
}

function formatCad(cents) {
  return `${currency.format(cents / 100)} CAD`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setMessage(type, text) {
  formMessage.className = `form-message show ${type}`;
  formMessage.textContent = text;
}

function setMessageWithLink(type, text, href, label) {
  setMessage(type, text);
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  link.style.marginLeft = "6px";
  formMessage.append(link);
}

function clearMessage() {
  formMessage.className = "form-message";
  formMessage.textContent = "";
}

function setStep(stepNumber) {
  currentStep = Math.max(1, Math.min(formSteps.length || 1, Number(stepNumber) || 1));

  // The booking form is presented as one continuous page (all sections
  // visible); the step indicators act as progress markers, not gates.
  for (const step of formSteps) {
    step.classList.add("active");
    step.hidden = false;
  }

  for (const indicator of stepIndicators) {
    const indicatorStep = Number(indicator.dataset.step);
    indicator.classList.toggle("active", indicatorStep === currentStep);
    indicator.classList.toggle("completed", indicatorStep <= currentStep);
    indicator.setAttribute("aria-current", indicatorStep === currentStep ? "step" : "false");
  }
}

function validateStep(stepNumber) {
  clearMessage();
  const step = formSteps.find((entry) => Number(entry.dataset.step) === Number(stepNumber));
  if (!step) {
    return true;
  }

  const requiredControls = [...step.querySelectorAll("input, select, textarea")]
    .filter((control) => control.required && !control.disabled && control.type !== "hidden");

  for (const control of requiredControls) {
    if (!control.checkValidity()) {
      control.reportValidity();
      return false;
    }
  }

  if (
    Number(stepNumber) === 3 &&
    showCalendarForProvince(provinceInput?.value) &&
    (!appointmentDateInput.value || !appointmentTimeInput.value)
  ) {
    setMessage("error", "Please select an appointment date and time.");
    return false;
  }

  if (Number(stepNumber) === 4 && selectedProducts().length === 0) {
    setMessage("error", "Please confirm the selected service before continuing.");
    return false;
  }

  return true;
}

function goToNextStep(fromStep) {
  if (!validateStep(fromStep)) {
    return;
  }
  setStep(Number(fromStep) + 1);
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
        .execute(paymentConfig.recaptchaSiteKey, { action: "booking" })
        .then(resolve)
        .catch(() => reject(new Error("Spam-protection check failed. Please try again.")));
    });
  });
}

function renderClock() {
  const time = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date());
  clinicClock.textContent = `America/Edmonton (${time})`;
}

function updateSnapshot(totalCents = null) {
  if (!snapshotDate) {
    return;
  }

  snapshotDate.textContent = selectedDate
    ? readableDateFormat.format(fromIsoDate(selectedDate))
    : "Select a date";
  snapshotTime.textContent = appointmentTimeInput.value || "Choose a time";

  const selected = selectedProducts();
  if (selected.length === 0) {
    snapshotService.textContent = "None selected";
  } else {
    const selectedNames = selected
      .map((item) => products.find((product) => product.id === item.id)?.name)
      .filter(Boolean);
    snapshotService.textContent = selectedNames.length > 1
      ? `${selectedNames[0]} + ${selectedNames.length - 1} more`
      : selectedNames[0];
  }

  const calculatedTotal = totalCents ?? selected.reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.id);
    return sum + (product ? product.priceCents * Math.max(1, item.quantity) : 0);
  }, 0);
  snapshotTotal.textContent = formatCad(calculatedTotal);
}

function syncPhnField() {
  const needsPhn = activeHealthCard.value === "yes";
  phnInput.required = needsPhn;
  phnInput.disabled = !needsPhn;
  if (!needsPhn) {
    phnInput.value = "";
  }
  phnField.hidden = !needsPhn;
  phnField.classList.toggle("muted", !needsPhn);
}

function bookingTotalCents() {
  return selectedProducts().reduce((sum, item) => {
    const product = products.find((entry) => entry.id === item.id);
    return sum + (product ? product.priceCents * Math.max(1, item.quantity) : 0);
  }, 0);
}

function syncHealthCardProduct() {
  if (!products.length) {
    return;
  }

  const hasActiveCard = activeHealthCard.value === "yes";
  const hasAnsweredHealthCard = ["yes", "no"].includes(activeHealthCard.value);
  const visibleProductId = hasActiveCard
    ? "active-alberta-health-card"
    : careOptionProductMap[careOptionSelect.value] || "non-active-alberta-health-card";
  productsSection.hidden = false;
  if (productGuide) {
    productGuide.hidden = hasAnsweredHealthCard;
  }

  productList.querySelectorAll("[data-product-id]").forEach((checkbox) => {
    const isVisibleProduct = checkbox.value === visibleProductId;
    const productCard = checkbox.closest(".product-option");
    const quantityInput = productList.querySelector(`[data-quantity-for="${checkbox.value}"]`);

    const shouldHideProduct = !hasAnsweredHealthCard || !isVisibleProduct;
    productCard.hidden = shouldHideProduct;
    productCard?.classList.toggle("product-option-hidden", shouldHideProduct);

    checkbox.checked = hasAnsweredHealthCard && isVisibleProduct;
    checkbox.disabled = !isVisibleProduct;
    if (quantityInput) {
      quantityInput.disabled = !isVisibleProduct;
    }
    productCard?.classList.toggle("product-option-disabled", !isVisibleProduct);
  });
  syncServiceDetailsFields();
}

function syncPaymentVisibility(totalCents = bookingTotalCents()) {
  if (!paymentSection) {
    return;
  }

  const hasAnsweredHealthCard = ["yes", "no"].includes(activeHealthCard.value);
  const hidePayment = !hasAnsweredHealthCard || activeHealthCard.value === "yes";
  paymentSection.hidden = hidePayment;
  bookingForm.querySelectorAll('input[name="paymentMethod"]').forEach((input) => {
    input.disabled = hidePayment;
  });

  // Show the embedded card field only when there is actually a fee to charge.
  const needsCard = !hidePayment && totalCents > 0 && paymentConfig.squareConfigured;
  if (cardPaymentBox) {
    cardPaymentBox.hidden = !needsCard;
  }
  if (needsCard) {
    ensureSquareCard().catch((error) => {
      if (cardErrors) cardErrors.textContent = error.message || "Payment form could not load.";
    });
  }
}

function syncHealthCardState() {
  syncPhnField();
  syncHealthCardProduct();
  updateTotal();
}

function syncCareOptionProduct() {
  syncHealthCardState();
}

function renderProducts() {
  productList.innerHTML = products.map((product) => `
    <label class="product-option">
      <input type="checkbox" value="${escapeHtml(product.id)}" data-product-id="${escapeHtml(product.id)}">
      <span class="product-copy">
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(product.description)}</small>
        <span class="product-meta">
          <span class="price">${product.priceCents === 0 ? "Free" : formatCad(product.priceCents)}</span>
          <span class="quantity-control">
            Quantity
            <input type="number" min="1" max="12" value="1" data-quantity-for="${escapeHtml(product.id)}" aria-label="${escapeHtml(product.name)} quantity">
          </span>
        </span>
      </span>
    </label>
  `).join("");

  productList.addEventListener("input", updateTotal);
  productList.addEventListener("change", () => {
    syncHealthCardProduct();
    updateTotal();
  });
  syncHealthCardProduct();
  updateTotal();
}

function selectedProductDetails() {
  const selected = selectedProducts();
  if (!selected.length) {
    return null;
  }
  return products.find((product) => product.id === selected[0].id) || null;
}

function serviceFieldKey(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function currentServiceFieldValues() {
  return [...serviceDetailsFields.querySelectorAll("[data-service-field]")].reduce((values, input) => {
    values[input.dataset.serviceFieldLabel] = input.value;
    return values;
  }, {});
}

function syncServiceDetailsFields() {
  if (!serviceDetailsSection || !serviceDetailsFields) {
    return;
  }

  const product = selectedProductDetails();
  const requiredFields = Array.isArray(product?.requiredFields) ? product.requiredFields : [];
  const previousValues = currentServiceFieldValues();

  serviceDetailsSection.hidden = requiredFields.length === 0;
  if (!requiredFields.length) {
    serviceDetailsFields.innerHTML = "";
    return;
  }

  serviceDetailsFields.innerHTML = requiredFields.map((label) => {
    const key = serviceFieldKey(label);
    const value = previousValues[label] || "";
    return `
      <label class="full-width">
        ${escapeHtml(label)}*
        <textarea data-service-field data-service-field-label="${escapeHtml(label)}" name="service_${key}" rows="3" required>${escapeHtml(value)}</textarea>
      </label>
    `;
  }).join("");
}

function selectedProducts() {
  return [...productList.querySelectorAll("input[type='checkbox']:checked")].map((checkbox) => {
    const quantityInput = productList.querySelector(`[data-quantity-for="${checkbox.value}"]`);
    return {
      id: checkbox.value,
      quantity: Number(quantityInput?.value || 1)
    };
  });
}

function updateTotal() {
  const total = bookingTotalCents();
  totalAmount.textContent = formatCad(total);
  updateSnapshot(total);
  syncPaymentVisibility(total);
}

function firstBookableDate() {
  return todayIso();
}

// Empty province (not entered yet) defaults to the calendar; only a real
// non-Alberta province switches to the "we'll call you" window.
function showCalendarForProvince(value) {
  const province = String(value || "").trim().toLowerCase();
  if (!province) {
    return true;
  }
  return province === "ab" || province === "alberta";
}

// Walk forward from today until a date actually has an open slot, so the form
// never opens stuck on a day whose times are all in the past.
async function findFirstAvailableDate(maxDays = 30) {
  const start = fromIsoDate(todayIso());
  for (let offset = 0; offset < maxDays; offset += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    const iso = toIsoDate(date);
    try {
      const response = await fetch(`/api/availability?date=${encodeURIComponent(iso)}`);
      const data = await response.json();
      if (response.ok && Array.isArray(data.slots) && data.slots.some((slot) => slot.available)) {
        return iso;
      }
    } catch (error) {
      // Ignore and keep scanning forward.
    }
  }
  return todayIso();
}

async function ensureSelectedDate() {
  if (selectedDate && appointmentDateInput.value) {
    return;
  }
  const iso = await findFirstAvailableDate();
  selectedDate = iso;
  currentMonth = fromIsoDate(iso);
  renderCalendar();
  await selectDate(iso);
}

function syncAppointmentMode() {
  const showCalendar = showCalendarForProvince(provinceInput?.value);

  if (appointmentGrid) {
    appointmentGrid.hidden = !showCalendar;
  }
  if (outOfProvinceNotice) {
    outOfProvinceNotice.hidden = showCalendar;
  }
  appointmentDateInput.required = showCalendar;
  appointmentTimeInput.required = showCalendar;

  if (!showCalendar) {
    selectedDate = "";
    appointmentDateInput.value = "";
    appointmentTimeInput.value = "";
    updateSnapshot();
  } else {
    ensureSelectedDate().catch(() => {});
  }
}

function renderCalendar() {
  calendarDays.innerHTML = "";
  calendarMonth.textContent = monthFormat.format(currentMonth);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const minDate = todayIso();

  for (let index = 0; index < mondayOffset; index += 1) {
    const blank = document.createElement("button");
    blank.type = "button";
    blank.className = "calendar-day blank";
    blank.disabled = true;
    blank.tabIndex = -1;
    calendarDays.append(blank);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const isoDate = toIsoDate(date);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calendar-day";
    button.textContent = day;
    button.disabled = isoDate < minDate;

    if (isoDate === selectedDate) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => selectDate(isoDate));
    calendarDays.append(button);
  }
}

async function selectDate(isoDate) {
  selectedDate = isoDate;
  appointmentDateInput.value = isoDate;
  appointmentTimeInput.value = "";
  selectedDateLabel.textContent = readableDateFormat.format(fromIsoDate(isoDate));
  slotGrid.innerHTML = "<p class=\"muted\">Loading appointment times...</p>";
  updateSnapshot();
  renderCalendar();

  try {
    const response = await fetch(`/api/availability?date=${encodeURIComponent(isoDate)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Could not load availability.");
    }
    renderSlots(data.slots);
  } catch (error) {
    slotGrid.innerHTML = "";
    setMessage("error", error.message);
  }
}

function renderSlots(slots) {
  if (!slots.length) {
    renderWaitlistPrompt("No appointment times are configured for this date.");
    return;
  }

  slotGrid.innerHTML = "";
  for (const slot of slots) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot-button";
    button.textContent = slot.time;
    button.disabled = !slot.available;
    button.addEventListener("click", () => {
      appointmentTimeInput.value = slot.time;
      document.querySelectorAll(".slot-button").forEach((entry) => entry.classList.remove("selected"));
      button.classList.add("selected");
      updateSnapshot();
    });
    slotGrid.append(button);
  }

  if (!slots.some((slot) => slot.available)) {
    const prompt = document.createElement("div");
    prompt.className = "waitlist-prompt";
    prompt.innerHTML = `
      <strong>No open slots for this date</strong>
      <span>Join the waitlist and staff can follow up if a spot opens.</span>
      <button type="button" class="secondary-button" data-join-waitlist>Join Waitlist</button>
    `;
    slotGrid.append(prompt);
  }
}

function renderWaitlistPrompt(message) {
  slotGrid.innerHTML = `
    <div class="waitlist-prompt">
      <strong>${message}</strong>
      <span>Join the waitlist and staff can follow up if a spot opens.</span>
      <button type="button" class="secondary-button" data-join-waitlist>Join Waitlist</button>
    </div>
  `;
}

function readFormPayload() {
  const formData = new FormData(bookingForm);
  const serviceFields = [...serviceDetailsFields.querySelectorAll("[data-service-field]")].reduce((fields, input) => {
    fields[input.dataset.serviceFieldLabel] = input.value;
    return fields;
  }, {});
  return {
    careOption: formData.get("careOption"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    gender: formData.get("gender"),
    dateOfBirth: formData.get("dateOfBirth"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    streetAddress: formData.get("streetAddress"),
    city: formData.get("city"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
    reminderPreference: formData.get("reminderPreference"),
    activeHealthCard: formData.get("activeHealthCard"),
    phn: formData.get("phn"),
    visitReason: formData.get("visitReason"),
    draftId: formData.get("draftId"),
    appointmentDate: formData.get("appointmentDate"),
    appointmentTime: formData.get("appointmentTime"),
    products: selectedProducts(),
    serviceFields,
    paymentMethod: formData.get("paymentMethod") || "not_required",
    consentAcknowledged: formData.get("consentAcknowledged") === "on"
  };
}

async function submitBooking(event) {
  event.preventDefault();
  clearMessage();

  if (!bookingForm.reportValidity()) {
    return;
  }

  if (
    showCalendarForProvince(provinceInput?.value) &&
    (!appointmentDateInput.value || !appointmentTimeInput.value)
  ) {
    setMessage("error", "Please select an appointment date and time.");
    return;
  }

  if (selectedProducts().length === 0) {
    setMessage("error", "Please select at least one product.");
    return;
  }

  const submitButton = bookingForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    const payload = readFormPayload();
    payload.recaptchaToken = await getRecaptchaToken();

    // Pay before the booking is confirmed: tokenize the card on this page and
    // send the token. The server charges it and only then creates the booking.
    if (paymentConfig.squareConfigured && bookingTotalCents() > 0) {
      if (cardErrors) cardErrors.textContent = "";
      submitButton.textContent = "Processing payment...";
      const card = await ensureSquareCard();
      if (!card) {
        throw new Error("The secure payment form is not ready. Please refresh and try again.");
      }
      const result = await card.tokenize();
      if (result.status !== "OK") {
        const detail = (result.errors || []).map((entry) => entry.message).join(" ");
        throw new Error(detail || "Please check your card details and try again.");
      }
      payload.paymentToken = result.token;
    }

    const response = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details?.join(" ") || data.message || "Booking could not be submitted.");
    }

    bookingForm.reset();
    syncHealthCardState();
    selectedDate = "";
    appointmentDateInput.value = "";
    appointmentTimeInput.value = "";
    syncAppointmentMode();
    const paidPrefix = data.booking.paid ? "Payment received. " : "";
    const successMessage = data.booking.appointmentDate && data.booking.appointmentTime
      ? `${paidPrefix}Appointment confirmed. Reference ${data.booking.reference}. Your booking is set for ${data.booking.appointmentDate} at ${data.booking.appointmentTime}.`
      : `${paidPrefix}Request submitted. Reference ${data.booking.reference}. Our team will contact you within 3 hours (we're open 9 AM–5 PM) to arrange your appointment time.`;
    if (data.booking.manageUrl) {
      setMessageWithLink("success", successMessage, data.booking.manageUrl, "Manage booking");
    } else {
      setMessage("success", `${successMessage} Confirmation email sent.`);
    }
  } catch (error) {
    setMessage("error", error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Confirm Booking";
  }
}

async function joinWaitlist() {
  clearMessage();
  const payload = readFormPayload();
  const required = [
    ["firstName", "First name is required for the waitlist."],
    ["lastName", "Last name is required for the waitlist."],
    ["phone", "Phone number is required for the waitlist."],
    ["email", "Email is required for the waitlist."]
  ];

  for (const [field, message] of required) {
    if (!String(payload[field] || "").trim()) {
      setMessage("error", message);
      bookingForm.querySelector(`[name="${field}"]`)?.focus();
      return;
    }
  }

  if (!selectedDate) {
    setMessage("error", "Please select a date before joining the waitlist.");
    return;
  }

  const waitlistButton = slotGrid.querySelector("[data-join-waitlist]");
  if (waitlistButton) {
    waitlistButton.disabled = true;
    waitlistButton.textContent = "Joining...";
  }

  try {
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        email: payload.email,
        desiredDate: selectedDate,
        desiredTime: "",
        careOption: payload.careOption,
        notes: "Patient joined waitlist from the booking form."
      })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.details?.join(" ") || data.message || "Could not join waitlist.");
    }

    setMessage("success", "You are on the waitlist for this date. TelePlus Care staff will follow up if a spot opens.");
  } catch (error) {
    setMessage("error", error.message);
    if (waitlistButton) {
      waitlistButton.disabled = false;
      waitlistButton.textContent = "Join Waitlist";
    }
  }
}

async function init() {
  renderClock();
  setInterval(renderClock, 30000);
  initDobPicker();
  syncHealthCardState();

  const [productsResponse, paymentResponse] = await Promise.all([
    fetch("/api/products"),
    fetch("/api/payment-config")
  ]);
  const productsData = await productsResponse.json();
  paymentConfig = await paymentResponse.json();
  loadRecaptcha(paymentConfig.recaptchaSiteKey);
  paymentNote.textContent = paymentConfig.squareConfigured
    ? "Paid bookings are charged securely on this page before your appointment is confirmed."
    : "Online card payment isn't enabled yet. Add Square credentials on the server to collect payments.";
  products = productsData.products;
  careOptionProductMap = {
    ...careOptionProductMap,
    ...(productsData.careOptionProductMap || {})
  };
  renderProducts();

  selectedDate = await findFirstAvailableDate();
  currentMonth = fromIsoDate(selectedDate);
  renderCalendar();
  await selectDate(selectedDate);
  syncAppointmentMode();
  setStep(1);
}

previousMonthButton.addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  renderCalendar();
});

activeHealthCard.addEventListener("change", syncHealthCardState);
dateOfBirthInput?.addEventListener("input", syncDobFromText);
dateOfBirthInput?.addEventListener("change", syncDobFromText);
dateOfBirthPicker?.addEventListener("input", syncDobFromPicker);
dateOfBirthPicker?.addEventListener("change", syncDobFromPicker);
careOptionSelect.addEventListener("change", syncCareOptionProduct);
provinceInput?.addEventListener("input", syncAppointmentMode);
provinceInput?.addEventListener("change", syncAppointmentMode);
bookingForm.addEventListener("submit", submitBooking);
document.querySelector("#step1-next")?.addEventListener("click", () => goToNextStep(1));
document.querySelector("#step2-prev")?.addEventListener("click", () => setStep(1));
document.querySelector("#step2-next")?.addEventListener("click", () => goToNextStep(2));
document.querySelector("#step3-prev")?.addEventListener("click", () => setStep(2));
document.querySelector("#step3-next")?.addEventListener("click", () => goToNextStep(3));
document.querySelector("#step4-prev")?.addEventListener("click", () => setStep(3));
document.querySelector("#step4-next")?.addEventListener("click", () => goToNextStep(4));
document.querySelector("#step5-prev")?.addEventListener("click", () => setStep(4));
slotGrid.addEventListener("click", (event) => {
  if (event.target.closest("[data-join-waitlist]")) {
    joinWaitlist();
  }
});

init().catch((error) => setMessage("error", error.message));
