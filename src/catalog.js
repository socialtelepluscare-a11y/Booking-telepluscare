const { getSetting } = require("./database");

const SERVICE_CATALOG_KEY = "service_catalog";

const DEFAULT_CARE_OPTIONS = {
  "active-alberta-health-card": "Active Alberta Health Card",
  "non-active-alberta-health-card": "Virtual Doctor Visit",
  "canadian-out-of-alberta": "Canadian Out of Alberta",
  "nationwide-refill-non-controlled-drugs": "Prescription Refill Online",
  "doctor-work-note-online": "Doctor Note Online",
  "mental-health-counselling-online": "Mental Health Counselling Online",
  "weight-loss-prescription-assessment": "Weight Loss Online",
  "weight-loss-follow-up-monthly": "Weight Loss Follow Up",
  "trt-hrt-initial-assessment": "TRT/HRT Wellness",
  "trt-hrt-follow-up": "TRT/HRT Follow Up",
  "mens-sexual-health-online": "Men's Sexual Health Online",
  "womens-sexual-health-online": "Women's Sexual Health Online",
  "skin-acne-care-online": "Skin / Acne Care Online",
  "hair-loss-treatment-online": "Hair Loss Treatment Online",
  "six-month-follow-up-package": "Six Month Follow Up Package",
  "international-visitor-to-canada": "International Visitor to Canada"
};

const PRODUCTS = [
  {
    id: "active-alberta-health-card",
    name: "Active Alberta Health Card",
    priceCents: 0,
    description: "For patients with an active Alberta Health Card PHN.",
    category: "All",
    careOption: "Active Alberta Health Card",
    healthCardRule: "active_alberta_free"
  },
  {
    id: "non-active-alberta-health-card",
    name: "Non Active Alberta Health Card",
    priceCents: 8000,
    description: "Virtual visit for patients without an active Alberta PHN.",
    category: "All",
    careOption: "Virtual Doctor Visit",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "canadian-out-of-alberta",
    name: "Canadian Out of Alberta",
    priceCents: 8000,
    description: "Virtual appointment for Canadian patients outside Alberta.",
    category: "All",
    careOption: "Canadian Out of Alberta",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "nationwide-refill-non-controlled-drugs",
    name: "Prescription Refill Online - Non Controlled Drugs",
    priceCents: 5000,
    description: "Prescription refill request for eligible non-controlled drugs.",
    category: "All",
    careOption: "Prescription Refill Online",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "doctor-work-note-online",
    name: "Doctor Note / Work Note Online",
    priceCents: 4500,
    description: "Online doctor note or work/school note request after physician review.",
    category: "All",
    careOption: "Doctor Note Online",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "mental-health-counselling-online",
    name: "Mental Health Counselling Online",
    priceCents: 8000,
    description: "Virtual appointment for stress, anxiety, mood concerns, and counselling support.",
    category: "All",
    careOption: "Mental Health Counselling Online",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "weight-loss-prescription-assessment",
    name: "Weight Loss Online - Prescription After Assessment",
    priceCents: 9900,
    description: "Weight-loss prescription after a clinical assessment.",
    category: "All",
    careOption: "Weight Loss Online",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "weight-loss-follow-up-monthly",
    name: "Follow Up - Weight Loss Drugs Monthly",
    priceCents: 6000,
    description: "Monthly follow-up for weight-loss medication care.",
    category: "All",
    careOption: "Weight Loss Follow Up",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "trt-hrt-initial-assessment",
    name: "TRT/HRT for Wellness - Initial assessment",
    priceCents: 19900,
    description: "Initial TRT/HRT wellness assessment.",
    category: "All",
    careOption: "TRT/HRT Wellness",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "trt-hrt-follow-up",
    name: "TRT/HRT for Wellness - Follow up",
    priceCents: 9900,
    description: "TRT/HRT follow-up appointment.",
    category: "All",
    careOption: "TRT/HRT Follow Up",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "mens-sexual-health-online",
    name: "Men's Sexual Health Online",
    priceCents: 8000,
    description: "Virtual care for erectile dysfunction, libido concerns, STI questions, and men's wellness.",
    category: "All",
    careOption: "Men's Sexual Health Online",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "womens-sexual-health-online",
    name: "Women's Sexual Health Online",
    priceCents: 8000,
    description: "Virtual care for contraception, sexual health questions, STI concerns, and women's wellness.",
    category: "All",
    careOption: "Women's Sexual Health Online",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "skin-acne-care-online",
    name: "Skin / Acne Care Online",
    priceCents: 8000,
    description: "Virtual visit for acne, rashes, eczema, and common skin concerns.",
    category: "All",
    careOption: "Skin / Acne Care Online",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "hair-loss-treatment-online",
    name: "Hair Loss Treatment Online",
    priceCents: 8000,
    description: "Online assessment for hair loss treatment options and prescription eligibility.",
    category: "All",
    careOption: "Hair Loss Treatment Online",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "six-month-follow-up-package",
    name: "Up Front for 6 Month Package 10-15 Min - Follow up For 6 Months",
    priceCents: 25000,
    description: "Prepaid six-month follow-up package.",
    category: "All",
    careOption: "Six Month Follow Up Package",
    healthCardRule: "paid_without_active_alberta"
  },
  {
    id: "international-visitor-to-canada",
    name: "International Visitor to Canada",
    priceCents: 12000,
    description: "Virtual appointment for international visitors in Canada.",
    category: "All",
    careOption: "International Visitor to Canada",
    healthCardRule: "paid_without_active_alberta"
  }
];

const PRODUCT_BY_ID = new Map(PRODUCTS.map((product) => [product.id, product]));

function toText(value) {
  return String(value || "").trim();
}

function slugify(value) {
  return toText(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function readBoolean(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function readPriceCents(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.max(0, Math.min(500000, Math.round(number)));
}

function normalizeRequiredFields(value) {
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).slice(0, 20);
  }
  return toText(value)
    .split(/\n|,|;/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeServiceCatalog(rawProducts = PRODUCTS) {
  const baseProducts = Array.isArray(rawProducts) && rawProducts.length ? rawProducts : PRODUCTS;
  const defaultById = new Map(PRODUCTS.map((product) => [product.id, product]));
  const seenIds = new Set();

  return baseProducts.map((item, index) => {
    const fallbackId = slugify(item?.name) || `service-${index + 1}`;
    const id = slugify(item?.id) || fallbackId;
    const defaultProduct = defaultById.get(id) || {};
    const healthCardRule = toText(item?.healthCardRule || defaultProduct.healthCardRule || "paid_without_active_alberta");
    const normalized = {
      id,
      name: toText(item?.name || defaultProduct.name || "TelePlus Care Service").slice(0, 140),
      priceCents: readPriceCents(item?.priceCents, defaultProduct.priceCents || 0),
      description: toText(item?.description || defaultProduct.description || "").slice(0, 500),
      category: toText(item?.category || defaultProduct.category || "All").slice(0, 80),
      careOption: toText(item?.careOption || defaultProduct.careOption || DEFAULT_CARE_OPTIONS[id] || "").slice(0, 120),
      healthCardRule: ["active_alberta_free", "paid_without_active_alberta", "always_paid"].includes(healthCardRule)
        ? healthCardRule
        : "paid_without_active_alberta",
      requiredFields: normalizeRequiredFields(item?.requiredFields || defaultProduct.requiredFields || []),
      refundText: toText(item?.refundText || defaultProduct.refundText || "").slice(0, 1000),
      enabled: readBoolean(item?.enabled, true)
    };

    if (seenIds.has(normalized.id)) {
      normalized.id = `${normalized.id}-${index + 1}`;
    }
    seenIds.add(normalized.id);
    return normalized;
  });
}

function readStoredCatalog() {
  try {
    const value = getSetting(SERVICE_CATALOG_KEY, "");
    return value ? JSON.parse(value) : PRODUCTS;
  } catch (error) {
    return PRODUCTS;
  }
}

function getProducts(options = {}) {
  const products = normalizeServiceCatalog(readStoredCatalog());
  return options.includeDisabled ? products : products.filter((product) => product.enabled);
}

function getProductById(id, options = {}) {
  return getProducts(options).find((product) => product.id === id) || null;
}

function getCareOptionProductMap(options = {}) {
  const products = getProducts(options);
  return products.reduce((map, product) => {
    if (product.careOption && product.enabled) {
      map[product.careOption] = product.id;
    }
    return map;
  }, {
    "Virtual Doctor Visit": "non-active-alberta-health-card",
    "General Medical Care": "non-active-alberta-health-card"
  });
}

function formatCurrency(cents) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD"
  }).format(cents / 100);
}

module.exports = {
  PRODUCTS,
  PRODUCT_BY_ID,
  SERVICE_CATALOG_KEY,
  formatCurrency,
  getCareOptionProductMap,
  getProductById,
  getProducts,
  normalizeServiceCatalog
};
