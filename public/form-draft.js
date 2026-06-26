(function () {
  const form = document.querySelector("[data-marketing-form-type]");
  if (!form) {
    return;
  }

  const formType = form.dataset.marketingFormType;
  const draftInput = form.querySelector('input[name="draftId"]');
  const visitorKey = "telepluscareVisitorId";
  const draftKey = `telepluscareDraftId:${formType}`;
  const saveDelayMs = 900;
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
  let saveTimer = null;
  let lastField = "";

  function randomId() {
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getStoredId(storage, key) {
    let value = storage.getItem(key);
    if (!value) {
      value = randomId();
      storage.setItem(key, value);
    }
    return value;
  }

  const visitorId = getStoredId(window.localStorage, visitorKey);
  const draftId = getStoredId(window.sessionStorage, draftKey);
  if (draftInput) {
    draftInput.value = draftId;
  }

  function fieldLabel(field) {
    const label = field.closest("label");
    if (label) {
      return label.innerText.replace(/\s+/g, " ").trim().slice(0, 120);
    }
    return field.name || field.id || "";
  }

  function collectFields() {
    const fields = {};
    for (const field of form.querySelectorAll("input, select, textarea")) {
      if (!field.name || field.type === "file" || field.name === "recaptchaToken") {
        continue;
      }

      if (field.type === "checkbox") {
        fields[field.name] = field.checked ? "yes" : "no";
        continue;
      }

      if (field.type === "radio") {
        if (field.checked) {
          fields[field.name] = field.value;
        }
        continue;
      }

      fields[field.name] = field.value;
    }

    const selectedProducts = [...form.querySelectorAll("[data-product-id]:checked")].map((field) => {
      const label = field.closest(".product-option")?.querySelector(".product-copy strong")?.innerText || field.value;
      return {
        id: field.value,
        name: label
      };
    });
    if (selectedProducts.length) {
      fields.selectedProducts = selectedProducts;
    }

    return fields;
  }

  function hasUsefulField(fields) {
    return Object.entries(fields).some(([key, value]) => {
      if (ignoredKeys.has(key)) {
        return false;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      const text = String(value || "").trim();
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

  async function saveDraft() {
    const fields = collectFields();
    if (!hasUsefulField(fields)) {
      return;
    }

    await fetch("/api/marketing/form-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        id: draftId,
        visitorId,
        formType,
        currentPath: window.location.pathname,
        lastField,
        fields
      })
    }).catch(() => {});
  }

  function scheduleSave(event) {
    if (event?.target) {
      lastField = fieldLabel(event.target);
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, saveDelayMs);
  }

  form.addEventListener("input", scheduleSave);
  form.addEventListener("change", scheduleSave);
  form.addEventListener("focusout", scheduleSave);
  window.addEventListener("pagehide", () => {
    clearTimeout(saveTimer);
    saveDraft();
  });
})();
