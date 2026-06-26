const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const dataDir = path.resolve(process.cwd(), process.env.DATA_DIR || "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "telepluscare-bookings.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    care_option TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    reminder_preference TEXT NOT NULL,
    active_health_card TEXT NOT NULL,
    phn TEXT,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    timezone TEXT NOT NULL,
    products_json TEXT NOT NULL,
    total_cents INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    square_payment_link_id TEXT,
    square_payment_link_url TEXT,
    square_order_id TEXT,
    manage_token_hash TEXT,
    manage_token_created_at TEXT,
    cancelled_at TEXT,
    rescheduled_at TEXT,
    reminder_sent_at TEXT,
    reminder_last_error TEXT,
    internal_notes TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    consent_acknowledged INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_bookings_date
    ON bookings (appointment_date);

  CREATE INDEX IF NOT EXISTS idx_bookings_slot
    ON bookings (appointment_date, appointment_time);

`);

db.exec("DROP INDEX IF EXISTS idx_bookings_open_slot;");

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((entry) => entry.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

ensureColumn("bookings", "square_payment_link_id", "TEXT");
ensureColumn("bookings", "square_payment_link_url", "TEXT");
ensureColumn("bookings", "square_order_id", "TEXT");
ensureColumn("bookings", "manage_token_hash", "TEXT");
ensureColumn("bookings", "manage_token_created_at", "TEXT");
ensureColumn("bookings", "cancelled_at", "TEXT");
ensureColumn("bookings", "rescheduled_at", "TEXT");
ensureColumn("bookings", "reminder_sent_at", "TEXT");
ensureColumn("bookings", "reminder_last_error", "TEXT");
ensureColumn("bookings", "internal_notes", "TEXT");
ensureColumn("bookings", "service_fields_json", "TEXT NOT NULL DEFAULT '{}'");
ensureColumn("bookings", "visit_reason", "TEXT NOT NULL DEFAULT ''");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS booking_attachments (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS service_requests (
    id TEXT PRIMARY KEY,
    reference TEXT NOT NULL UNIQUE,
    request_type TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'new',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    street_address TEXT NOT NULL,
    city TEXT NOT NULL,
    province TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    reason TEXT NOT NULL,
    note_start_date TEXT,
    note_end_date TEXT,
    total_cents INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    square_payment_link_id TEXT,
    square_payment_link_url TEXT,
    square_order_id TEXT,
    internal_notes TEXT,
    fields_json TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS service_request_attachments (
    id TEXT PRIMARY KEY,
    service_request_id TEXT NOT NULL,
    uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS partial_form_drafts (
    id TEXT PRIMARY KEY,
    visitor_id TEXT NOT NULL,
    form_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    current_path TEXT NOT NULL,
    last_field TEXT,
    fields_json TEXT NOT NULL,
    user_agent TEXT,
    ip_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS booking_events (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS waitlist_entries (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'new',
    desired_date TEXT NOT NULL,
    desired_time TEXT,
    care_option TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    notes TEXT
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_manage_token
    ON bookings (manage_token_hash)
    WHERE manage_token_hash IS NOT NULL;

  CREATE INDEX IF NOT EXISTS idx_booking_attachments_booking
    ON booking_attachments (booking_id);

  CREATE INDEX IF NOT EXISTS idx_service_requests_created
    ON service_requests (created_at);

  CREATE INDEX IF NOT EXISTS idx_service_requests_status
    ON service_requests (status);

  CREATE INDEX IF NOT EXISTS idx_service_requests_type
    ON service_requests (request_type);

  CREATE INDEX IF NOT EXISTS idx_service_request_attachments_request
    ON service_request_attachments (service_request_id);

  CREATE INDEX IF NOT EXISTS idx_partial_form_drafts_status
    ON partial_form_drafts (status, updated_at);

  CREATE INDEX IF NOT EXISTS idx_partial_form_drafts_visitor
    ON partial_form_drafts (visitor_id, form_type);

  CREATE INDEX IF NOT EXISTS idx_booking_events_booking
    ON booking_events (booking_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_waitlist_entries_status_date
    ON waitlist_entries (status, desired_date);
`);

db.prepare(`
  INSERT OR IGNORE INTO settings (key, value)
  VALUES ('reminder_minutes_before', ?)
`).run(String(process.env.REMINDER_MINUTES_BEFORE || 30));

const insertBookingStatement = db.prepare(`
  INSERT INTO bookings (
    id,
    reference,
    care_option,
    first_name,
    last_name,
    gender,
    date_of_birth,
    phone,
    email,
    street_address,
    city,
    province,
    postal_code,
    reminder_preference,
    active_health_card,
    phn,
    appointment_date,
    appointment_time,
    timezone,
    products_json,
    total_cents,
    payment_method,
    payment_status,
    square_payment_link_id,
    square_payment_link_url,
    square_order_id,
    manage_token_hash,
    manage_token_created_at,
    service_fields_json,
    visit_reason,
    status,
    consent_acknowledged
  ) VALUES (
    @id,
    @reference,
    @careOption,
    @firstName,
    @lastName,
    @gender,
    @dateOfBirth,
    @phone,
    @email,
    @streetAddress,
    @city,
    @province,
    @postalCode,
    @reminderPreference,
    @activeHealthCard,
    @phn,
    @appointmentDate,
    @appointmentTime,
    @timezone,
    @productsJson,
    @totalCents,
    @paymentMethod,
    @paymentStatus,
    @squarePaymentLinkId,
    @squarePaymentLinkUrl,
    @squareOrderId,
    @manageTokenHash,
    datetime('now'),
    @serviceFieldsJson,
    @visitReason,
    @status,
    @consentAcknowledged
  )
`);

const bookedSlotsStatement = db.prepare(`
  SELECT appointment_time AS appointmentTime
  FROM bookings
  WHERE appointment_date = ?
    AND (? = '' OR id != ?)
    AND status != 'cancelled'
`);

const bookedSlotCountsStatement = db.prepare(`
  SELECT appointment_time AS appointmentTime,
         COUNT(*) AS count
  FROM bookings
  WHERE appointment_date = ?
    AND (? = '' OR id != ?)
    AND status != 'cancelled'
  GROUP BY appointment_time
`);

const listBookingsStatement = db.prepare(`
  SELECT *
  FROM bookings
  WHERE (@status = '' OR status = @status)
    AND (@date = '' OR appointment_date = @date)
    AND (
      @query = ''
      OR lower(reference) LIKE @queryLike
      OR lower(first_name || ' ' || last_name) LIKE @queryLike
      OR lower(email) LIKE @queryLike
      OR replace(phone, ' ', '') LIKE @queryPhone
    )
  ORDER BY appointment_date DESC, appointment_time DESC, created_at DESC
`);

const updateBookingStatement = db.prepare(`
  UPDATE bookings
  SET status = @status,
      payment_status = @paymentStatus,
      internal_notes = @internalNotes,
      updated_at = datetime('now')
  WHERE id = @id
`);

const updateSquarePaymentLinkStatement = db.prepare(`
  UPDATE bookings
  SET square_payment_link_id = @squarePaymentLinkId,
      square_payment_link_url = @squarePaymentLinkUrl,
      square_order_id = @squareOrderId,
      updated_at = datetime('now')
  WHERE id = @id
`);

const getBookingByManageTokenStatement = db.prepare(`
  SELECT *
  FROM bookings
  WHERE manage_token_hash = ?
`);

const cancelManagedBookingStatement = db.prepare(`
  UPDATE bookings
  SET status = 'cancelled',
      cancelled_at = datetime('now'),
      updated_at = datetime('now')
  WHERE id = @id
    AND status != 'cancelled'
`);

const rescheduleManagedBookingStatement = db.prepare(`
  UPDATE bookings
  SET appointment_date = @appointmentDate,
      appointment_time = @appointmentTime,
      reminder_sent_at = NULL,
      reminder_last_error = NULL,
      rescheduled_at = datetime('now'),
      updated_at = datetime('now')
  WHERE id = @id
    AND status != 'cancelled'
`);

const listReminderCandidatesStatement = db.prepare(`
  SELECT *
  FROM bookings
  WHERE status IN ('new', 'confirmed')
    AND reminder_sent_at IS NULL
    AND appointment_date >= @fromDate
    AND appointment_date <= @toDate
  ORDER BY appointment_date ASC, appointment_time ASC
`);

const markReminderSentStatement = db.prepare(`
  UPDATE bookings
  SET reminder_sent_at = datetime('now'),
      reminder_last_error = NULL,
      updated_at = datetime('now')
  WHERE id = ?
`);

const markReminderFailedStatement = db.prepare(`
  UPDATE bookings
  SET reminder_last_error = @error,
      updated_at = datetime('now')
  WHERE id = @id
`);

const getSettingStatement = db.prepare(`
  SELECT value
  FROM settings
  WHERE key = ?
`);

const setSettingStatement = db.prepare(`
  INSERT INTO settings (key, value, updated_at)
  VALUES (@key, @value, datetime('now'))
  ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = datetime('now')
`);

const createAttachmentStatement = db.prepare(`
  INSERT INTO booking_attachments (
    id,
    booking_id,
    original_name,
    stored_name,
    mime_type,
    size_bytes
  ) VALUES (
    @id,
    @bookingId,
    @originalName,
    @storedName,
    @mimeType,
    @sizeBytes
  )
`);

const insertServiceRequestStatement = db.prepare(`
  INSERT INTO service_requests (
    id,
    reference,
    request_type,
    status,
    first_name,
    last_name,
    phone,
    email,
    street_address,
    city,
    province,
    postal_code,
    date_of_birth,
    reason,
    note_start_date,
    note_end_date,
    total_cents,
    payment_method,
    payment_status,
    square_payment_link_id,
    square_payment_link_url,
    square_order_id,
    internal_notes,
    fields_json
  ) VALUES (
    @id,
    @reference,
    @requestType,
    @status,
    @firstName,
    @lastName,
    @phone,
    @email,
    @streetAddress,
    @city,
    @province,
    @postalCode,
    @dateOfBirth,
    @reason,
    @noteStartDate,
    @noteEndDate,
    @totalCents,
    @paymentMethod,
    @paymentStatus,
    @squarePaymentLinkId,
    @squarePaymentLinkUrl,
    @squareOrderId,
    @internalNotes,
    @fieldsJson
  )
`);

const listServiceRequestsStatement = db.prepare(`
  SELECT *
  FROM service_requests
  WHERE (@status = '' OR status = @status)
    AND (@requestType = '' OR request_type = @requestType)
    AND (
      @query = ''
      OR lower(reference) LIKE @queryLike
      OR lower(first_name || ' ' || last_name) LIKE @queryLike
      OR lower(email) LIKE @queryLike
      OR replace(phone, ' ', '') LIKE @queryPhone
    )
  ORDER BY created_at DESC
`);

const updateServiceRequestStatement = db.prepare(`
  UPDATE service_requests
  SET status = @status,
      payment_status = @paymentStatus,
      internal_notes = @internalNotes,
      updated_at = datetime('now')
  WHERE id = @id
`);

const updateServiceRequestSquarePaymentLinkStatement = db.prepare(`
  UPDATE service_requests
  SET square_payment_link_id = @squarePaymentLinkId,
      square_payment_link_url = @squarePaymentLinkUrl,
      square_order_id = @squareOrderId,
      updated_at = datetime('now')
  WHERE id = @id
`);

const createServiceRequestAttachmentStatement = db.prepare(`
  INSERT INTO service_request_attachments (
    id,
    service_request_id,
    original_name,
    stored_name,
    mime_type,
    size_bytes
  ) VALUES (
    @id,
    @serviceRequestId,
    @originalName,
    @storedName,
    @mimeType,
    @sizeBytes
  )
`);

const listAttachmentsForServiceRequestStatement = db.prepare(`
  SELECT *
  FROM service_request_attachments
  WHERE service_request_id = ?
  ORDER BY uploaded_at DESC
`);

const getServiceRequestAttachmentStatement = db.prepare(`
  SELECT *
  FROM service_request_attachments
  WHERE id = ?
`);

const upsertPartialFormDraftStatement = db.prepare(`
  INSERT INTO partial_form_drafts (
    id,
    visitor_id,
    form_type,
    status,
    current_path,
    last_field,
    fields_json,
    user_agent,
    ip_hash
  ) VALUES (
    @id,
    @visitorId,
    @formType,
    'active',
    @currentPath,
    @lastField,
    @fieldsJson,
    @userAgent,
    @ipHash
  )
  ON CONFLICT(id) DO UPDATE SET
    visitor_id = excluded.visitor_id,
    form_type = excluded.form_type,
    status = CASE
      WHEN partial_form_drafts.status = 'submitted' THEN partial_form_drafts.status
      ELSE 'active'
    END,
    current_path = excluded.current_path,
    last_field = excluded.last_field,
    fields_json = excluded.fields_json,
    user_agent = excluded.user_agent,
    ip_hash = excluded.ip_hash,
    last_seen_at = datetime('now'),
    updated_at = datetime('now')
`);

const markPartialFormDraftSubmittedStatement = db.prepare(`
  UPDATE partial_form_drafts
  SET status = 'submitted',
      updated_at = datetime('now'),
      last_seen_at = datetime('now')
  WHERE id = ?
`);

const updatePartialFormDraftStatusStatement = db.prepare(`
  UPDATE partial_form_drafts
  SET status = @status,
      updated_at = datetime('now')
  WHERE id = @id
`);

const listPartialFormDraftsStatement = db.prepare(`
  SELECT *
  FROM partial_form_drafts
  WHERE (@status = '' OR status = @status)
    AND (@formType = '' OR form_type = @formType)
    AND (
      @query = ''
      OR lower(fields_json) LIKE @queryLike
      OR lower(visitor_id) LIKE @queryLike
      OR lower(id) LIKE @queryLike
      OR lower(last_field) LIKE @queryLike
    )
  ORDER BY updated_at DESC
  LIMIT 250
`);

const listAttachmentsForBookingStatement = db.prepare(`
  SELECT *
  FROM booking_attachments
  WHERE booking_id = ?
  ORDER BY uploaded_at DESC
`);

const getAttachmentStatement = db.prepare(`
  SELECT *
  FROM booking_attachments
  WHERE id = ?
`);

const insertBookingEventStatement = db.prepare(`
  INSERT INTO booking_events (
    id,
    booking_id,
    event_type,
    summary,
    metadata_json
  ) VALUES (
    @id,
    @bookingId,
    @eventType,
    @summary,
    @metadataJson
  )
`);

const listBookingEventsStatement = db.prepare(`
  SELECT *
  FROM booking_events
  WHERE booking_id = ?
  ORDER BY created_at DESC
`);

const insertWaitlistEntryStatement = db.prepare(`
  INSERT INTO waitlist_entries (
    id,
    status,
    desired_date,
    desired_time,
    care_option,
    first_name,
    last_name,
    phone,
    email,
    notes
  ) VALUES (
    @id,
    @status,
    @desiredDate,
    @desiredTime,
    @careOption,
    @firstName,
    @lastName,
    @phone,
    @email,
    @notes
  )
`);

const listWaitlistEntriesStatement = db.prepare(`
  SELECT *
  FROM waitlist_entries
  WHERE (@status = '' OR status = @status)
    AND (@date = '' OR desired_date = @date)
    AND (
      @query = ''
      OR lower(first_name || ' ' || last_name) LIKE @queryLike
      OR lower(email) LIKE @queryLike
      OR replace(phone, ' ', '') LIKE @queryPhone
      OR lower(care_option) LIKE @queryLike
    )
  ORDER BY desired_date ASC, created_at ASC
`);

const updateWaitlistEntryStatement = db.prepare(`
  UPDATE waitlist_entries
  SET status = @status,
      desired_time = @desiredTime,
      notes = @notes,
      updated_at = datetime('now')
  WHERE id = @id
`);

function rowToBooking(row) {
  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    careOption: row.care_option,
    firstName: row.first_name,
    lastName: row.last_name,
    gender: row.gender,
    dateOfBirth: row.date_of_birth,
    phone: row.phone,
    email: row.email,
    streetAddress: row.street_address,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    reminderPreference: row.reminder_preference,
    activeHealthCard: row.active_health_card,
    phn: row.phn,
    appointmentDate: row.appointment_date,
    appointmentTime: row.appointment_time,
    timezone: row.timezone,
    products: parseJson(row.products_json, []),
    totalCents: row.total_cents,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    squarePaymentLinkId: row.square_payment_link_id,
    squarePaymentLinkUrl: row.square_payment_link_url,
    squareOrderId: row.square_order_id,
    manageTokenHash: row.manage_token_hash,
    manageTokenCreatedAt: row.manage_token_created_at,
    serviceFields: parseJson(row.service_fields_json, {}),
    visitReason: row.visit_reason || "",
    cancelledAt: row.cancelled_at,
    rescheduledAt: row.rescheduled_at,
    reminderSentAt: row.reminder_sent_at,
    reminderLastError: row.reminder_last_error,
    internalNotes: row.internal_notes || "",
    status: row.status,
    consentAcknowledged: Boolean(row.consent_acknowledged)
  };
}

function rowToAttachment(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    uploadedAt: row.uploaded_at,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes
  };
}

function parseJson(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch (error) {
    return fallback;
  }
}

function rowToServiceRequest(row) {
  return {
    id: row.id,
    reference: row.reference,
    requestType: row.request_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    streetAddress: row.street_address,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    dateOfBirth: row.date_of_birth,
    reason: row.reason,
    noteStartDate: row.note_start_date || "",
    noteEndDate: row.note_end_date || "",
    totalCents: row.total_cents,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    squarePaymentLinkId: row.square_payment_link_id || "",
    squarePaymentLinkUrl: row.square_payment_link_url || "",
    squareOrderId: row.square_order_id || "",
    internalNotes: row.internal_notes || "",
    fields: parseJson(row.fields_json, {})
  };
}

function rowToServiceRequestAttachment(row) {
  return {
    id: row.id,
    serviceRequestId: row.service_request_id,
    uploadedAt: row.uploaded_at,
    originalName: row.original_name,
    storedName: row.stored_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes
  };
}

function rowToPartialFormDraft(row) {
  return {
    id: row.id,
    visitorId: row.visitor_id,
    formType: row.form_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    currentPath: row.current_path,
    lastField: row.last_field || "",
    fields: parseJson(row.fields_json, {}),
    userAgent: row.user_agent || "",
    ipHash: row.ip_hash || ""
  };
}

function rowToBookingEvent(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    createdAt: row.created_at,
    eventType: row.event_type,
    summary: row.summary,
    metadata: parseJson(row.metadata_json, {})
  };
}

function rowToWaitlistEntry(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    desiredDate: row.desired_date,
    desiredTime: row.desired_time || "",
    careOption: row.care_option || "",
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email: row.email,
    notes: row.notes || ""
  };
}

// Capacity check + insert wrapped in a single transaction so concurrent
// requests for the same slot cannot oversell it (better-sqlite3 serializes the
// transaction, closing the check-then-act race).
const createBookingTransaction = db.transaction((booking, slotGuard) => {
  if (slotGuard && slotGuard.appointmentTime && Number(slotGuard.capacity) > 0) {
    const counts = getBookedSlotCounts(booking.appointmentDate);
    const booked = counts[slotGuard.appointmentTime] || 0;
    if (booked >= Number(slotGuard.capacity)) {
      const error = new Error("That appointment time was just booked. Please choose another time.");
      error.code = "SLOT_FULL";
      throw error;
    }
  }
  insertBookingStatement.run(booking);
});

function createBooking(booking, slotGuard) {
  createBookingTransaction(booking, slotGuard);
  return getBookingById(booking.id);
}

function getBookingById(id) {
  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(id);
  return row ? rowToBooking(row) : null;
}

function getBookingBySquareOrderId(orderId) {
  if (!orderId) {
    return null;
  }
  const row = db
    .prepare("SELECT * FROM bookings WHERE square_order_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(orderId);
  return row ? rowToBooking(row) : null;
}

function getBookedSlots(appointmentDate, excludeBookingId = "") {
  return bookedSlotsStatement
    .all(appointmentDate, excludeBookingId || "", excludeBookingId || "")
    .map((row) => row.appointmentTime);
}

function getBookedSlotCounts(appointmentDate, excludeBookingId = "") {
  return bookedSlotCountsStatement
    .all(appointmentDate, excludeBookingId || "", excludeBookingId || "")
    .reduce((counts, row) => {
      counts[row.appointmentTime] = Number(row.count || 0);
      return counts;
    }, {});
}

function listBookings(filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const queryPhone = `%${query.replace(/\D/g, "")}%`;
  return listBookingsStatement.all({
    status: filters.status || "",
    date: filters.date || "",
    query,
    queryLike: `%${query}%`,
    queryPhone
  }).map(rowToBooking);
}

function updateBooking(id, updates) {
  const existingBooking = getBookingById(id);
  updateBookingStatement.run({
    id,
    status: updates.status,
    paymentStatus: updates.paymentStatus,
    internalNotes: updates.internalNotes ?? existingBooking?.internalNotes ?? ""
  });
  return getBookingById(id);
}

function updateSquarePaymentLink(id, squarePaymentLink) {
  updateSquarePaymentLinkStatement.run({
    id,
    squarePaymentLinkId: squarePaymentLink.id || "",
    squarePaymentLinkUrl: squarePaymentLink.url || "",
    squareOrderId: squarePaymentLink.orderId || ""
  });
  return getBookingById(id);
}

function getBookingByManageTokenHash(tokenHash) {
  const row = getBookingByManageTokenStatement.get(tokenHash);
  return row ? rowToBooking(row) : null;
}

function cancelManagedBooking(id) {
  cancelManagedBookingStatement.run({ id });
  return getBookingById(id);
}

function rescheduleManagedBooking(id, appointmentDate, appointmentTime) {
  rescheduleManagedBookingStatement.run({
    id,
    appointmentDate,
    appointmentTime
  });
  return getBookingById(id);
}

function listReminderCandidates(fromDate, toDate) {
  return listReminderCandidatesStatement.all({ fromDate, toDate }).map(rowToBooking);
}

function markReminderSent(id) {
  markReminderSentStatement.run(id);
  createBookingEvent({
    bookingId: id,
    eventType: "reminder_sent",
    summary: "Appointment reminder processed."
  });
  return getBookingById(id);
}

function markReminderFailed(id, error) {
  markReminderFailedStatement.run({
    id,
    error: String(error || "Reminder failed.").slice(0, 500)
  });
  createBookingEvent({
    bookingId: id,
    eventType: "reminder_failed",
    summary: "Appointment reminder failed.",
    metadata: { error: String(error || "Reminder failed.").slice(0, 500) }
  });
  return getBookingById(id);
}

function getSetting(key, fallback = "") {
  const row = getSettingStatement.get(key);
  return row ? row.value : fallback;
}

function setSetting(key, value) {
  setSettingStatement.run({
    key,
    value: String(value)
  });
  return getSetting(key);
}

function createAttachment(attachment) {
  createAttachmentStatement.run(attachment);
  return getAttachment(attachment.id);
}

function listAttachmentsForBooking(bookingId) {
  return listAttachmentsForBookingStatement.all(bookingId).map(rowToAttachment);
}

function getAttachment(id) {
  const row = getAttachmentStatement.get(id);
  return row ? rowToAttachment(row) : null;
}

function createServiceRequest(serviceRequest) {
  insertServiceRequestStatement.run(serviceRequest);
  return getServiceRequestById(serviceRequest.id);
}

function getServiceRequestById(id) {
  const row = db.prepare("SELECT * FROM service_requests WHERE id = ?").get(id);
  return row ? rowToServiceRequest(row) : null;
}

function getServiceRequestBySquareOrderId(orderId) {
  if (!orderId) {
    return null;
  }
  const row = db
    .prepare("SELECT * FROM service_requests WHERE square_order_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(orderId);
  return row ? rowToServiceRequest(row) : null;
}

function listServiceRequests(filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const queryPhone = `%${query.replace(/\D/g, "")}%`;
  return listServiceRequestsStatement.all({
    status: filters.status || "",
    requestType: filters.requestType || "",
    query,
    queryLike: `%${query}%`,
    queryPhone
  }).map(rowToServiceRequest);
}

function updateServiceRequest(id, updates) {
  const existingRequest = getServiceRequestById(id);
  if (!existingRequest) {
    return null;
  }

  updateServiceRequestStatement.run({
    id,
    status: updates.status,
    paymentStatus: updates.paymentStatus,
    internalNotes: updates.internalNotes ?? existingRequest.internalNotes ?? ""
  });
  return getServiceRequestById(id);
}

function updateServiceRequestSquarePaymentLink(id, squarePaymentLink) {
  updateServiceRequestSquarePaymentLinkStatement.run({
    id,
    squarePaymentLinkId: squarePaymentLink.id || "",
    squarePaymentLinkUrl: squarePaymentLink.url || "",
    squareOrderId: squarePaymentLink.orderId || ""
  });
  return getServiceRequestById(id);
}

function createServiceRequestAttachment(attachment) {
  createServiceRequestAttachmentStatement.run(attachment);
  return getServiceRequestAttachment(attachment.id);
}

function listAttachmentsForServiceRequest(serviceRequestId) {
  return listAttachmentsForServiceRequestStatement.all(serviceRequestId).map(rowToServiceRequestAttachment);
}

function getServiceRequestAttachment(id) {
  const row = getServiceRequestAttachmentStatement.get(id);
  return row ? rowToServiceRequestAttachment(row) : null;
}

function upsertPartialFormDraft(draft) {
  upsertPartialFormDraftStatement.run(draft);
  return getPartialFormDraftById(draft.id);
}

function markPartialFormDraftSubmitted(id) {
  if (!id) {
    return null;
  }
  markPartialFormDraftSubmittedStatement.run(id);
  return getPartialFormDraftById(id);
}

function updatePartialFormDraftStatus(id, status) {
  updatePartialFormDraftStatusStatement.run({ id, status });
  return getPartialFormDraftById(id);
}

function getPartialFormDraftById(id) {
  const row = db.prepare("SELECT * FROM partial_form_drafts WHERE id = ?").get(id);
  return row ? rowToPartialFormDraft(row) : null;
}

function listPartialFormDrafts(filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  return listPartialFormDraftsStatement.all({
    status: filters.status || "",
    formType: filters.formType || "",
    query,
    queryLike: `%${query}%`
  }).map(rowToPartialFormDraft);
}

function createBookingEvent(event) {
  const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata : {};
  insertBookingEventStatement.run({
    id: event.id || crypto.randomUUID(),
    bookingId: event.bookingId,
    eventType: event.eventType,
    summary: event.summary,
    metadataJson: JSON.stringify(metadata)
  });
  return listBookingEvents(event.bookingId)[0] || null;
}

function listBookingEvents(bookingId) {
  return listBookingEventsStatement.all(bookingId).map(rowToBookingEvent);
}

function createWaitlistEntry(entry) {
  insertWaitlistEntryStatement.run({
    id: entry.id,
    status: entry.status || "new",
    desiredDate: entry.desiredDate,
    desiredTime: entry.desiredTime || "",
    careOption: entry.careOption || "",
    firstName: entry.firstName,
    lastName: entry.lastName,
    phone: entry.phone,
    email: entry.email,
    notes: entry.notes || ""
  });
  return getWaitlistEntryById(entry.id);
}

function getWaitlistEntryById(id) {
  const row = db.prepare("SELECT * FROM waitlist_entries WHERE id = ?").get(id);
  return row ? rowToWaitlistEntry(row) : null;
}

function listWaitlistEntries(filters = {}) {
  const query = String(filters.query || "").trim().toLowerCase();
  const queryPhone = `%${query.replace(/\D/g, "")}%`;
  return listWaitlistEntriesStatement.all({
    status: filters.status || "",
    date: filters.date || "",
    query,
    queryLike: `%${query}%`,
    queryPhone
  }).map(rowToWaitlistEntry);
}

function updateWaitlistEntry(id, updates) {
  const existingEntry = getWaitlistEntryById(id);
  if (!existingEntry) {
    return null;
  }

  updateWaitlistEntryStatement.run({
    id,
    status: updates.status || existingEntry.status,
    desiredTime: updates.desiredTime ?? existingEntry.desiredTime,
    notes: updates.notes ?? existingEntry.notes
  });
  return getWaitlistEntryById(id);
}

function getDashboardStats() {
  const bookings = listBookings();
  // Use the clinic's local date (America/Edmonton), not the server's UTC date,
  // so "Today"/"This week" stay correct during the evening hours.
  const { getTodayIsoInClinicTimeZone } = require("./availability");
  const today = getTodayIsoInClinicTimeZone();
  const todayDate = new Date(`${today}T12:00:00`);
  const weekEnd = new Date(todayDate);
  weekEnd.setDate(todayDate.getDate() + 6);
  const weekEndIso = weekEnd.toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const activeBookings = bookings.filter((booking) => booking.status !== "cancelled");
  const sumTotal = (items) => items.reduce((sum, booking) => sum + booking.totalCents, 0);

  return {
    today: {
      count: activeBookings.filter((booking) => booking.appointmentDate === today).length,
      revenueCents: sumTotal(activeBookings.filter((booking) => booking.appointmentDate === today))
    },
    week: {
      count: activeBookings.filter((booking) => booking.appointmentDate >= today && booking.appointmentDate <= weekEndIso).length,
      revenueCents: sumTotal(activeBookings.filter((booking) => booking.appointmentDate >= today && booking.appointmentDate <= weekEndIso))
    },
    month: {
      count: activeBookings.filter((booking) => booking.appointmentDate.startsWith(month)).length,
      revenueCents: sumTotal(activeBookings.filter((booking) => booking.appointmentDate.startsWith(month)))
    },
    statusCounts: bookings.reduce((counts, booking) => {
      counts[booking.status] = (counts[booking.status] || 0) + 1;
      return counts;
    }, {})
  };
}

module.exports = {
  cancelManagedBooking,
  createAttachment,
  createBooking,
  createBookingEvent,
  createServiceRequest,
  createServiceRequestAttachment,
  createWaitlistEntry,
  getAttachment,
  getBookingById,
  getBookingBySquareOrderId,
  getBookingByManageTokenHash,
  getBookedSlotCounts,
  getBookedSlots,
  getDashboardStats,
  getSetting,
  getServiceRequestAttachment,
  getServiceRequestById,
  getServiceRequestBySquareOrderId,
  getWaitlistEntryById,
  listAttachmentsForBooking,
  listAttachmentsForServiceRequest,
  listBookingEvents,
  listBookings,
  listPartialFormDrafts,
  listReminderCandidates,
  listServiceRequests,
  listWaitlistEntries,
  markPartialFormDraftSubmitted,
  markReminderFailed,
  markReminderSent,
  rescheduleManagedBooking,
  setSetting,
  updateBooking,
  updatePartialFormDraftStatus,
  updateServiceRequest,
  updateServiceRequestSquarePaymentLink,
  updateWaitlistEntry,
  upsertPartialFormDraft,
  updateSquarePaymentLink
};
