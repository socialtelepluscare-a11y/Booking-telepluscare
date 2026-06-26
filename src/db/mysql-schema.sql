-- TelePlus Care booking system — MySQL schema
-- Mirrors the SQLite tables 1:1 so the app maps cleanly when DB_DRIVER=mysql.
-- Notes vs SQLite:
--   * Indexed / primary-key / unique string columns use VARCHAR (MySQL can't index TEXT without a prefix).
--   * created_at / updated_at use DATETIME defaults (read back as strings via mysql2 dateStrings:true).
--   * MySQL UNIQUE allows multiple NULLs, so manage_token_hash uniqueness needs no partial index.
--   * consent_acknowledged is TINYINT(1) (0/1), matching the SQLite INTEGER boolean.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(64) PRIMARY KEY,
  reference VARCHAR(64) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  care_option VARCHAR(160) NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  gender VARCHAR(40) NOT NULL,
  date_of_birth VARCHAR(20) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  street_address VARCHAR(255) NOT NULL,
  city VARCHAR(120) NOT NULL,
  province VARCHAR(120) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  reminder_preference VARCHAR(60) NOT NULL,
  active_health_card VARCHAR(10) NOT NULL,
  phn VARCHAR(20),
  appointment_date VARCHAR(10) NOT NULL,
  appointment_time VARCHAR(12) NOT NULL,
  timezone VARCHAR(64) NOT NULL,
  products_json TEXT NOT NULL,
  total_cents INT NOT NULL,
  payment_method VARCHAR(40) NOT NULL,
  payment_status VARCHAR(40) NOT NULL,
  square_payment_link_id VARCHAR(191),
  square_payment_link_url TEXT,
  square_order_id VARCHAR(191),
  manage_token_hash VARCHAR(128),
  manage_token_created_at DATETIME NULL,
  cancelled_at DATETIME NULL,
  rescheduled_at DATETIME NULL,
  reminder_sent_at DATETIME NULL,
  reminder_last_error TEXT,
  internal_notes TEXT,
  service_fields_json TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  consent_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY idx_bookings_manage_token (manage_token_hash),
  KEY idx_bookings_date (appointment_date),
  KEY idx_bookings_slot (appointment_date, appointment_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(120) PRIMARY KEY,
  `value` TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS booking_attachments (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT NOT NULL,
  KEY idx_booking_attachments_booking (booking_id),
  CONSTRAINT fk_booking_attachments_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS service_requests (
  id VARCHAR(64) PRIMARY KEY,
  reference VARCHAR(64) NOT NULL UNIQUE,
  request_type VARCHAR(60) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  street_address VARCHAR(255) NOT NULL,
  city VARCHAR(120) NOT NULL,
  province VARCHAR(120) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  date_of_birth VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  note_start_date VARCHAR(20),
  note_end_date VARCHAR(20),
  total_cents INT NOT NULL,
  payment_method VARCHAR(40) NOT NULL,
  payment_status VARCHAR(40) NOT NULL,
  square_payment_link_id VARCHAR(191),
  square_payment_link_url TEXT,
  square_order_id VARCHAR(191),
  internal_notes TEXT,
  fields_json TEXT NOT NULL,
  KEY idx_service_requests_created (created_at),
  KEY idx_service_requests_status (status),
  KEY idx_service_requests_type (request_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS service_request_attachments (
  id VARCHAR(64) PRIMARY KEY,
  service_request_id VARCHAR(64) NOT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes INT NOT NULL,
  KEY idx_service_request_attachments_request (service_request_id),
  CONSTRAINT fk_service_request_attachments FOREIGN KEY (service_request_id)
    REFERENCES service_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS partial_form_drafts (
  id VARCHAR(80) PRIMARY KEY,
  visitor_id VARCHAR(80) NOT NULL,
  form_type VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  current_path VARCHAR(255) NOT NULL,
  last_field VARCHAR(120),
  fields_json TEXT NOT NULL,
  user_agent VARCHAR(500),
  ip_hash VARCHAR(80),
  KEY idx_partial_form_drafts_status (status, updated_at),
  KEY idx_partial_form_drafts_visitor (visitor_id, form_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS booking_events (
  id VARCHAR(64) PRIMARY KEY,
  booking_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  event_type VARCHAR(60) NOT NULL,
  summary TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  KEY idx_booking_events_booking (booking_id, created_at),
  CONSTRAINT fk_booking_events_booking FOREIGN KEY (booking_id)
    REFERENCES bookings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id VARCHAR(64) PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'new',
  desired_date VARCHAR(10) NOT NULL,
  desired_time VARCHAR(12),
  care_option VARCHAR(160),
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(255) NOT NULL,
  notes TEXT,
  KEY idx_waitlist_entries_status_date (status, desired_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
