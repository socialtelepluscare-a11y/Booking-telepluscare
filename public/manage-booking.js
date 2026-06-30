const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const bookingStatus = document.querySelector("#bookingStatus");
const bookingSummary = document.querySelector("#bookingSummary");
const manageMessage = document.querySelector("#manageMessage");
const manageClock = document.querySelector("#manageClock");
const rescheduleSection = document.querySelector("#rescheduleSection");
const cancelSection = document.querySelector("#cancelSection");
const previousMonthButton = document.querySelector("#previousMonth");
const nextMonthButton = document.querySelector("#nextMonth");
const calendarMonth = document.querySelector("#calendarMonth");
const calendarDays = document.querySelector("#calendarDays");
const selectedDateLabel = document.querySelector("#selectedDateLabel");
const slotGrid = document.querySelector("#slotGrid");
const rescheduleButton = document.querySelector("#rescheduleButton");
const cancelButton = document.querySelector("#cancelButton");
const attachmentSection = document.querySelector("#attachmentSection");
const attachmentList = document.querySelector("#attachmentList");
const attachmentForm = document.querySelector("#attachmentForm");
const attachmentInput = document.querySelector("#attachmentInput");

const timeZone = "America/Edmonton";
const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const monthFormat = new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric" });
const readableDateFormat = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  month: "long",
  day: "numeric"
});

let booking = null;
let selectedDate = "";
let selectedTime = "";
let currentMonth = new Date();

function setMessage(type, text) {
  manageMessage.className = `form-message show ${type}`;
  manageMessage.textContent = text;
}

function clearMessage() {
  manageMessage.className = "form-message";
  manageMessage.textContent = "";
}

function formatCad(cents) {
  return `${currency.format(cents / 100)} CAD`;
}

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

function renderClock() {
  const time = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date());
  manageClock.textContent = `America/Edmonton (${time})`;
}

function productSummary(products) {
  return products.map((product) => {
    const quantity = product.quantity > 1 ? ` x ${product.quantity}` : "";
    return `${product.name}${quantity}`;
  }).join(", ");
}

function statusLabel(value) {
  const labels = {
    new: "New",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    not_required: "No payment required",
    pending: "Payment pending",
    paid: "Paid",
    refunded: "Refunded"
  };
  return labels[value] || value;
}

function renderBooking() {
  bookingStatus.innerHTML = `
    <span>${statusLabel(booking.status)}</span>
    <span>${statusLabel(booking.paymentStatus)}</span>
  `;

  const paymentUrlSafe =
    typeof booking.paymentUrl === "string" && /^https:\/\//i.test(booking.paymentUrl)
      ? booking.paymentUrl
      : "";
  bookingSummary.innerHTML = `
    <h2>${escapeHtml(booking.reference)}</h2>
    <div class="summary-grid">
      <div>
        <span class="summary-label">Patient</span>
        <strong>${escapeHtml(booking.firstName)} ${escapeHtml(booking.lastName)}</strong>
        <span>${escapeHtml(booking.email)}</span>
        <span>${escapeHtml(booking.phone)}</span>
      </div>
      <div>
        <span class="summary-label">Appointment</span>
        ${booking.appointmentDate && booking.appointmentTime
          ? `<strong>${escapeHtml(booking.appointmentDate)}</strong>
        <span>${escapeHtml(booking.appointmentTime)}</span>
        <span>${escapeHtml(booking.timezone)}</span>`
          : `<strong>Callback request</strong>
        <span>We'll contact you soon to arrange your time</span>`}
      </div>
      <div>
        <span class="summary-label">Service</span>
        <strong>${escapeHtml(productSummary(booking.products))}</strong>
        <span>${escapeHtml(formatCad(booking.totalCents))}</span>
      </div>
    </div>
    ${
      paymentUrlSafe && booking.status !== "cancelled"
        ? `<a class="primary-link-button" href="${escapeHtml(paymentUrlSafe)}" target="_blank" rel="noreferrer">Continue to Square Payment</a>`
        : ""
    }
  `;

  const cancelled = booking.status === "cancelled";
  rescheduleSection.hidden = cancelled;
  cancelSection.hidden = cancelled;
  attachmentSection.hidden = cancelled;
  renderAttachments();
  if (cancelled) {
    setMessage("success", "This booking is cancelled.");
  }
}

function renderAttachments() {
  if (!booking.attachments?.length) {
    attachmentList.innerHTML = `<p class="payment-note">No attachments uploaded yet.</p>`;
    return;
  }

  attachmentList.innerHTML = booking.attachments.map((attachment) => `
    <div class="attachment-chip">
      <strong>${escapeHtml(attachment.originalName)}</strong>
      <span>${Math.ceil(attachment.sizeBytes / 1024)} KB</span>
    </div>
  `).join("");
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
  selectedTime = "";
  rescheduleButton.disabled = true;
  selectedDateLabel.textContent = readableDateFormat.format(fromIsoDate(isoDate));
  slotGrid.innerHTML = "<p class=\"muted\">Loading appointment times...</p>";
  renderCalendar();

  try {
    const response = await fetch(`/api/manage-booking/availability?token=${encodeURIComponent(token)}&date=${encodeURIComponent(isoDate)}`);
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
    slotGrid.innerHTML = "<p class=\"muted\">No appointment times are available for this date.</p>";
    return;
  }

  slotGrid.innerHTML = "";
  for (const slot of slots) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "slot-button";
    button.textContent = slot.time;
    button.disabled = !slot.available;

    if (selectedDate === booking.appointmentDate && slot.time === booking.appointmentTime) {
      button.classList.add("selected");
      selectedTime = slot.time;
      rescheduleButton.disabled = false;
    }

    button.addEventListener("click", () => {
      selectedTime = slot.time;
      document.querySelectorAll(".slot-button").forEach((entry) => entry.classList.remove("selected"));
      button.classList.add("selected");
      rescheduleButton.disabled = false;
    });
    slotGrid.append(button);
  }
}

async function loadBooking() {
  if (!token) {
    throw new Error("This booking management link is missing a token.");
  }

  const response = await fetch(`/api/manage-booking?token=${encodeURIComponent(token)}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Could not load this booking.");
  }

  booking = data.booking;
  selectedDate = booking.appointmentDate >= todayIso() ? booking.appointmentDate : todayIso();
  currentMonth = fromIsoDate(selectedDate);
  renderBooking();
  renderCalendar();
  if (booking.status !== "cancelled") {
    await selectDate(selectedDate);
  }
}

async function rescheduleBooking() {
  clearMessage();

  if (!selectedDate || !selectedTime) {
    setMessage("error", "Please select a new appointment date and time.");
    return;
  }

  rescheduleButton.disabled = true;
  rescheduleButton.textContent = "Saving...";

  try {
    const response = await fetch("/api/manage-booking/reschedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        appointmentDate: selectedDate,
        appointmentTime: selectedTime
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.details?.join(" ") || data.message || "Could not reschedule booking.");
    }

    booking = data.booking;
    renderBooking();
    await selectDate(booking.appointmentDate);
    const rescheduledMsg = `Booking rescheduled to ${booking.appointmentDate} at ${booking.appointmentTime}.`;
    setMessage("success", rescheduledMsg);
    if (window.tpAlert) {
      window.tpAlert.success("Appointment updated!", rescheduledMsg);
    }
  } catch (error) {
    setMessage("error", error.message);
    if (window.tpAlert) {
      window.tpAlert.error("Could not reschedule", error.message);
    }
  } finally {
    rescheduleButton.disabled = false;
    rescheduleButton.textContent = "Save New Time";
  }
}

async function cancelBooking() {
  clearMessage();

  const confirmed = window.tpAlert
    ? await window.tpAlert.confirm(
        "Cancel this appointment?",
        "This will release your appointment time. This can't be undone.",
        "Yes, cancel it"
      )
    : window.confirm("Cancel this appointment?");
  if (!confirmed) {
    return;
  }

  cancelButton.disabled = true;
  cancelButton.textContent = "Cancelling...";

  try {
    const response = await fetch("/api/manage-booking/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Could not cancel booking.");
    }

    booking = data.booking;
    renderBooking();
    setMessage("success", "Your appointment has been cancelled.");
    if (window.tpAlert) {
      window.tpAlert.success("Appointment cancelled", "Your appointment time has been released.");
    }
  } catch (error) {
    setMessage("error", error.message);
    if (window.tpAlert) {
      window.tpAlert.error("Could not cancel", error.message);
    }
  } finally {
    cancelButton.disabled = false;
    cancelButton.textContent = "Cancel Appointment";
  }
}

async function uploadAttachments(event) {
  event.preventDefault();
  clearMessage();

  if (!attachmentInput.files.length) {
    setMessage("error", "Please choose at least one file to upload.");
    return;
  }

  const formData = new FormData();
  formData.set("token", token);
  for (const file of attachmentInput.files) {
    formData.append("attachments", file);
  }

  const submitButton = attachmentForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  submitButton.textContent = "Uploading...";

  try {
    const response = await fetch("/api/manage-booking/attachments", {
      method: "POST",
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Could not upload attachments.");
    }

    booking.attachments = data.attachments;
    attachmentInput.value = "";
    renderAttachments();
    setMessage("success", "Attachments uploaded.");
  } catch (error) {
    setMessage("error", error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Upload Attachments";
  }
}

previousMonthButton.addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  renderCalendar();
});

rescheduleButton.addEventListener("click", rescheduleBooking);
cancelButton.addEventListener("click", cancelBooking);
attachmentForm.addEventListener("submit", uploadAttachments);

renderClock();
setInterval(renderClock, 30000);
loadBooking().catch((error) => {
  setMessage("error", error.message);
  bookingSummary.innerHTML = "";
  rescheduleSection.hidden = true;
  cancelSection.hidden = true;
  attachmentSection.hidden = true;
});
