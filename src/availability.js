const TIME_ZONE = "America/Edmonton";
const SCHEDULE_SETTING_KEY = "schedule_config";

const WEEKDAY_SLOTS = [
  "10:00 AM",
  "10:15 AM",
  "10:30 AM",
  "10:45 AM",
  "11:00 AM",
  "11:15 AM",
  "11:30 AM",
  "11:45 AM",
  "12:00 PM",
  "12:15 PM",
  "12:30 PM",
  "12:45 PM",
  "1:00 PM",
  "3:45 PM",
  "4:00 PM",
  "4:15 PM",
  "4:30 PM",
  "4:45 PM"
];

const SATURDAY_SLOTS = [
  "10:00 AM",
  "10:15 AM",
  "10:30 AM",
  "10:45 AM",
  "11:00 AM",
  "11:15 AM",
  "11:30 AM",
  "11:45 AM",
  "12:00 PM",
  "12:15 PM",
  "12:30 PM",
  "12:45 PM",
  "1:00 PM",
  "1:15 PM",
  "1:30 PM",
  "1:45 PM",
  "2:00 PM",
  "2:15 PM",
  "2:30 PM",
  "2:45 PM",
  "3:00 PM",
  "3:15 PM",
  "3:30 PM",
  "3:45 PM"
];

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday"
];

const DEFAULT_SCHEDULE = {
  intervalMinutes: 15,
  days: {
    sunday: { open: false, ranges: [], breaks: [] },
    monday: {
      open: true,
      ranges: [
        { start: "10:00 AM", end: "1:00 PM" },
        { start: "3:45 PM", end: "4:45 PM" }
      ],
      breaks: []
    },
    tuesday: {
      open: true,
      ranges: [
        { start: "10:00 AM", end: "1:00 PM" },
        { start: "3:45 PM", end: "4:45 PM" }
      ],
      breaks: []
    },
    wednesday: {
      open: true,
      ranges: [
        { start: "10:00 AM", end: "1:00 PM" },
        { start: "3:45 PM", end: "4:45 PM" }
      ],
      breaks: []
    },
    thursday: {
      open: true,
      ranges: [
        { start: "10:00 AM", end: "1:00 PM" },
        { start: "3:45 PM", end: "4:45 PM" }
      ],
      breaks: []
    },
    friday: {
      open: true,
      ranges: [
        { start: "10:00 AM", end: "1:00 PM" },
        { start: "3:45 PM", end: "4:45 PM" }
      ],
      breaks: []
    },
    saturday: {
      open: true,
      ranges: [
        { start: "10:00 AM", end: "3:45 PM" }
      ],
      breaks: []
    }
  },
  blockedDates: [],
  blockedSlots: {},
  extraSlots: {},
  slotOverrides: {}
};

function cloneDefaultSchedule() {
  return JSON.parse(JSON.stringify(DEFAULT_SCHEDULE));
}

function getTodayIsoInClinicTimeZone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getClinicWeekday(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.getDay();
}

function getStoredScheduleConfig() {
  try {
    const { getSetting } = require("./database");
    return getSetting(SCHEDULE_SETTING_KEY, JSON.stringify(DEFAULT_SCHEDULE));
  } catch (error) {
    return JSON.stringify(DEFAULT_SCHEDULE);
  }
}

function normalizeTimeWindows(windows, allowSameEnd = false) {
  if (!Array.isArray(windows)) {
    return [];
  }

  return windows
    .map((window) => ({
      start: normalizeSlotLabel(window.start),
      end: normalizeSlotLabel(window.end)
    }))
    .filter((window) => {
      const start = slotToMinutes(window.start);
      const end = slotToMinutes(window.end);
      return Number.isFinite(start) && Number.isFinite(end) && (allowSameEnd ? start <= end : start < end);
    });
}

function normalizeScheduleConfig(config = {}) {
  const fallback = cloneDefaultSchedule();
  const intervalMinutes = Number(config.intervalMinutes || fallback.intervalMinutes);
  const normalized = {
    intervalMinutes: [5, 10, 15, 20, 30, 45, 60].includes(intervalMinutes) ? intervalMinutes : 15,
    days: {},
    blockedDates: Array.isArray(config.blockedDates)
      ? [...new Set(config.blockedDates.filter(isValidIsoDate))].sort()
      : [],
    blockedSlots: normalizeDateSlotMap(config.blockedSlots),
    extraSlots: normalizeDateSlotMap(config.extraSlots),
    slotOverrides: normalizeSlotOverrideMap(config.slotOverrides)
  };

  for (const dayKey of DAY_KEYS) {
    const day = config.days?.[dayKey] || fallback.days[dayKey];

    normalized.days[dayKey] = {
      open: Boolean(day.open),
      ranges: normalizeTimeWindows(day.ranges, true),
      breaks: normalizeTimeWindows(day.breaks, false)
    };
  }

  return normalized;
}

function getScheduleConfig() {
  try {
    return normalizeScheduleConfig(JSON.parse(getStoredScheduleConfig()));
  } catch (error) {
    return cloneDefaultSchedule();
  }
}

function getSlotsForDate(isoDate) {
  const schedule = getScheduleConfig();
  return buildSlotsForDate(schedule, isoDate, {
    includeBlockedSlots: false,
    includeClosedOverrides: false
  });
}

function getAdminSlotsForDate(isoDate) {
  const schedule = getScheduleConfig();
  return buildSlotsForDate(schedule, isoDate, {
    includeBlockedSlots: true,
    includeClosedOverrides: true
  });
}

function buildSlotsForDate(schedule, isoDate, options = {}) {
  const weekday = getClinicWeekday(isoDate);
  const dayKey = DAY_KEYS[weekday];
  const overrides = schedule.slotOverrides[isoDate] || {};

  if (schedule.blockedDates.includes(isoDate) && Object.keys(overrides).length === 0) {
    return [];
  }

  const day = schedule.days[dayKey];
  const slots = new Set();

  if (day?.open && !schedule.blockedDates.includes(isoDate)) {
    for (const range of day.ranges) {
      for (const slot of slotsForRange(range.start, range.end, schedule.intervalMinutes)) {
        slots.add(slot);
      }
    }

    for (const breakWindow of day.breaks || []) {
      for (const slot of [...slots]) {
        if (isSlotInsideBreak(slot, breakWindow)) {
          slots.delete(slot);
        }
      }
    }
  }

  for (const slot of schedule.extraSlots[isoDate] || []) {
    slots.add(slot);
  }

  for (const slot of schedule.blockedSlots[isoDate] || []) {
    if (options.includeBlockedSlots) {
      slots.add(slot);
    } else {
      slots.delete(slot);
    }
  }

  for (const [slot, override] of Object.entries(overrides)) {
    if (override.status === "open") {
      slots.add(slot);
    }
    if (override.status === "closed") {
      if (options.includeClosedOverrides) {
        slots.add(slot);
      } else {
        slots.delete(slot);
      }
    }
  }

  return [...slots].sort((left, right) => slotToMinutes(left) - slotToMinutes(right));
}

function getSlotOverride(isoDate, slot, schedule = getScheduleConfig()) {
  const normalizedSlot = normalizeSlotLabel(slot);
  if (!isValidIsoDate(isoDate) || !normalizedSlot) {
    return null;
  }
  return schedule.slotOverrides?.[isoDate]?.[normalizedSlot] || null;
}

function getSlotCapacity(isoDate, slot, schedule = getScheduleConfig()) {
  const override = getSlotOverride(isoDate, slot, schedule);
  return normalizeSlotCapacity(override?.capacity || 1);
}

function isSlotInsideBreak(slot, breakWindow) {
  const slotMinutes = slotToMinutes(slot);
  const startMinutes = slotToMinutes(breakWindow.start);
  const endMinutes = slotToMinutes(breakWindow.end);
  return (
    Number.isFinite(slotMinutes) &&
    Number.isFinite(startMinutes) &&
    Number.isFinite(endMinutes) &&
    slotMinutes >= startMinutes &&
    slotMinutes < endMinutes
  );
}

function slotToMinutes(slot) {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(slot);
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

function normalizeSlotLabel(value) {
  const minutes = slotToMinutes(String(value || "").trim().toUpperCase());
  return Number.isFinite(minutes) ? minutesToSlot(minutes) : "";
}

function minutesToSlot(totalMinutes) {
  const minutesInDay = ((totalMinutes % 1440) + 1440) % 1440;
  const hours24 = Math.floor(minutesInDay / 60);
  const minutes = minutesInDay % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function slotsForRange(startSlot, endSlot, intervalMinutes) {
  const startMinutes = slotToMinutes(startSlot);
  const endMinutes = slotToMinutes(endSlot);

  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes) || startMinutes > endMinutes) {
    return [];
  }

  const slots = [];
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += intervalMinutes) {
    slots.push(minutesToSlot(minutes));
  }
  return slots;
}

function normalizeDateSlotMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((map, [date, slots]) => {
    if (!isValidIsoDate(date) || !Array.isArray(slots)) {
      return map;
    }

    const normalizedSlots = [...new Set(slots.map(normalizeSlotLabel).filter(Boolean))]
      .sort((left, right) => slotToMinutes(left) - slotToMinutes(right));
    if (normalizedSlots.length > 0) {
      map[date] = normalizedSlots;
    }
    return map;
  }, {});
}

function normalizeSlotCapacity(value) {
  const capacity = Number(value);
  if (!Number.isFinite(capacity)) {
    return 1;
  }
  return Math.max(1, Math.min(20, Math.round(capacity)));
}

function normalizeSlotOverrideMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.entries(value).reduce((map, [date, overrides]) => {
    if (!isValidIsoDate(date) || !overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
      return map;
    }

    const normalizedOverrides = Object.entries(overrides).reduce((dateMap, [slot, override]) => {
      const normalizedSlot = normalizeSlotLabel(slot);
      if (!normalizedSlot || !override || typeof override !== "object" || Array.isArray(override)) {
        return dateMap;
      }

      const status = override.status === "closed" ? "closed" : "open";
      dateMap[normalizedSlot] = {
        status,
        capacity: normalizeSlotCapacity(override.capacity)
      };
      return dateMap;
    }, {});

    if (Object.keys(normalizedOverrides).length > 0) {
      map[date] = Object.fromEntries(
        Object.entries(normalizedOverrides)
          .sort(([left], [right]) => slotToMinutes(left) - slotToMinutes(right))
      );
    }
    return map;
  }, {});
}

function getCurrentMinutesInClinicTimeZone() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return (Number(values.hour) % 24) * 60 + Number(values.minute);
}

function isSlotBookable(isoDate, slot) {
  const today = getTodayIsoInClinicTimeZone();

  if (isoDate < today) {
    return false;
  }

  if (isoDate > today) {
    return true;
  }

  return slotToMinutes(slot) > getCurrentMinutesInClinicTimeZone();
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }

  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && value === date.toISOString().slice(0, 10);
}

module.exports = {
  DAY_KEYS,
  DEFAULT_SCHEDULE,
  SCHEDULE_SETTING_KEY,
  TIME_ZONE,
  WEEKDAY_SLOTS,
  SATURDAY_SLOTS,
  getTodayIsoInClinicTimeZone,
  getAdminSlotsForDate,
  getScheduleConfig,
  getSlotCapacity,
  getSlotOverride,
  getSlotsForDate,
  isSlotBookable,
  isValidIsoDate,
  normalizeScheduleConfig,
  normalizeSlotCapacity,
  normalizeSlotLabel,
  slotToMinutes
};
