# TelePlus Care Booking System

This is a full local booking system for TelePlus Care. It includes:

- Patient booking form with all requested fields
- Calendar and appointment-time availability
- Product selection, quantity, and CAD totals
- SQLite database storage
- Admin booking dashboard
- CSV export
- Confirmation email with private cancel/reschedule link
- No-login patient self-service cancellation and rescheduling
- Automatic appointment reminders with configurable lead time
- Admin search, dashboard stats, calendar view, no-show status, notes, and file attachments
- Doctor Note request form with 7-day date-range validation
- Prescription Refill request form with required proof upload
- Admin service-request dashboard for doctor notes and prescription refills

## Run locally

```bash
npm install
cp .env.example .env
npm start
```

Open:

- Booking form: `http://localhost:3000`
- Doctor note form: `http://localhost:3000/doctor-note`
- Prescription refill form: `http://localhost:3000/prescription-refill`
- Admin dashboard: `http://localhost:3000/admin`

The default development admin login is:

- Username: `admin`
- Password: `admin123`

Set a real `ADMIN_PASSWORD` in `.env` before using it outside your computer.

## What I need from you for production

To make this fully live on your real website, I need:

1. Hosting choice: TelePlus Care website host, VPS, Render, Railway, Fly.io, Vercel, or similar.
2. Database choice: hosted Postgres/MySQL/Supabase, or keep SQLite only if one server will run the app.
3. Square credentials: Square access token, location ID, and whether you want sandbox or production.
4. Email provider SMTP credentials: SendGrid, Mailgun, Google Workspace, or another SMTP provider.
5. Admin users: names/emails of staff who should access the admin dashboard.
6. Booking rules: final appointment durations, holidays, blocked dates, provider schedules, and cancellation policy.
7. Privacy/legal text: final privacy policy, consent wording, refund policy, and any clinic-specific PHIPA/PIPEDA requirements.
8. Brand assets: logo file, preferred colors, and any real clinic photos or map embed you want used.

## Database

Local database file:

```text
data/telepluscare-bookings.sqlite
```

The app creates the database automatically on first start.

## Square payment setup

This version does not collect card numbers directly, because collecting raw card details would create PCI compliance risk. Paid bookings use Square hosted checkout when Square is configured.

Add these values to `.env`:

```text
SQUARE_ENVIRONMENT=sandbox
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_LOCATION_ID=your_square_location_id
SQUARE_API_VERSION=2026-05-20
APP_BASE_URL=http://localhost:3000
```

Use `SQUARE_ENVIRONMENT=production` and your live Square access token when the site is hosted on the real domain.

Until Square credentials are added, paid bookings are stored as `pending` and staff can follow up manually.

For automatic paid/refunded status updates, the next production step is connecting Square webhooks.

## Doctor note and prescription refill forms

The extra service forms live inside the same app and use the same Square, SMTP, upload, and admin settings:

- Doctor Note: `/doctor-note`
- Prescription Refill: `/prescription-refill`

Doctor notes cost `$45.00 CAD` and the requested note date range is validated server-side so it cannot exceed 7 days.

Prescription refills cost `$50.00 CAD` for up to 3 medications. The form requires a proof upload, such as a bottle photo, medication label, prescription snapshot, PDF, or Word document. The form also shows the controlled-drug notice.

Staff can manage these from the Service Requests section on `/admin`, including status, payment status, internal notes, and proof attachment downloads.

## Confirmation email setup

Patients can cancel or reschedule without logging in through a private link in their confirmation email. Add SMTP settings to `.env`:

```text
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM="TelePlus Care <booking@telepluscare.com>"
```

If SMTP is not configured, the app still creates the booking and prints the private manage-booking link in the server terminal for local testing.

Manage-booking page:

```text
/manage-booking?token=private-token-from-email
```

## Reminder setup

The app checks once per minute for upcoming appointments and sends one reminder per booking. The default is 30 minutes before the appointment. You can change this from the admin dashboard, or set the initial default in `.env`:

```text
REMINDERS_ENABLED=true
REMINDER_MINUTES_BEFORE=30
```

Email reminders use the same SMTP settings as confirmation emails. SMS reminders use Twilio when configured:

```text
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+15875551234
```

If a patient selected text reminders and Twilio is not configured, the server prints a preview locally instead of sending a real SMS.

## Admin tools

The admin dashboard now includes:

- Dashboard stats for today, next 7 days, and this month
- Search by patient name, email, phone, or reference
- Staff list view and calendar view
- CSV export and ICS calendar export
- No-show status
- Internal staff notes
- Attachment download links
- Service request review for doctor notes and prescription refills
- Schedule settings for open days, appointment intervals, blocked dates, closed slots, and extra one-off slots

ICS export:

```text
/api/admin/calendar.ics
```

This can be imported into Google Calendar or Outlook. Direct two-way Google Calendar sync still requires Google Calendar API credentials.

## Schedule settings

Admins can change appointment availability from `/admin` without editing code:

- Slot interval: 5, 10, 15, 20, 30, 45, or 60 minutes
- Open/closed days of week
- Daily time ranges, such as `10:00 AM-1:00 PM, 3:45 PM-4:45 PM`
- Closed dates, one per line
- Closed specific slots, such as `2026-06-12 | 10:00 AM, 10:15 AM`
- Extra open slots, such as `2026-06-14 | 11:00 AM, 11:15 AM`

The public booking form and patient reschedule page use these saved settings immediately.

## Patient intake attachments

Patients can upload attachments from their private manage-booking link. Files are stored under:

```text
data/uploads
```

Allowed file types include PDF, JPG, PNG, WebP, DOC, and DOCX. Configure limits in `.env`:

```text
UPLOAD_DIR=./data/uploads
MAX_UPLOAD_BYTES=10485760
```

## reCAPTCHA

To enable spam protection on the public booking form, add reCAPTCHA v3 keys:

```text
RECAPTCHA_SITE_KEY=your_site_key
RECAPTCHA_SECRET_KEY=your_secret_key
```

## Brand assets

Send the TelePlus Care logo file, preferred colors, and any real clinic photos. The current UI is ready for branding, but the actual image assets are still needed.

## Booking rules included now

- Time zone: `America/Edmonton`
- Monday to Friday appointment slots:
  - 10:00 AM through 1:00 PM
  - 3:45 PM through 4:45 PM
- Saturday appointment slots:
  - 10:00 AM through 3:45 PM
- Sunday closed
- Already-booked slots are blocked automatically
- Active Alberta Health Card product requires a 9-digit PHN
