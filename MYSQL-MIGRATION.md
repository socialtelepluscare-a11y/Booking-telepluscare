# Moving TelePlus Care to MySQL (Hostinger VPS)

This is the plan to switch the booking system from SQLite to your Hostinger MySQL.
It is staged so your live bookings are never at risk: **SQLite keeps working until
MySQL is tested and confirmed.**

## Where things stand

**Done (in this repo):**
- `mysql2` added to dependencies.
- `DB_DRIVER` switch added to `.env` (`sqlite` by default, `mysql` when ready).
- MySQL schema written: `src/db/mysql-schema.sql` (mirrors the SQLite tables exactly).
- Connection + setup checker: `npm run db:check` — connects, creates the tables, verifies them.
- Runbook: this file.

**Remaining (the actual cutover — best done on the VPS where we can test):**
- Enable the MySQL data layer (convert the data functions to async + a MySQL backend).
  This is the one part that *must* be tested against a real MySQL before real bookings
  run on it, which is why it is done on the VPS, not blind.

## Why it is staged

The app currently uses SQLite with a **synchronous** engine. MySQL's Node driver is
**asynchronous**, so the cutover changes how every part of the app reads/writes data.
That change can be fully tested with SQLite, but the MySQL-specific behaviour can only
be trusted after running against an actual MySQL server. There is no MySQL on the
development machine, so the safe place to finish and verify is your VPS.

## Recommended architecture

Run the **Node app and MySQL on the same Hostinger VPS**. Then the app connects to
`127.0.0.1` — fast, private, and no "Remote MySQL" IP whitelisting needed. (Remote
MySQL over the public internet works but adds latency to every booking action and
breaks whenever your IP changes, so avoid it for production.)

## VPS setup steps

1. **Install Node 22+** on the VPS (via `nvm` or your provider's panel).
2. **Install MySQL/MariaDB** on the same VPS (or use the managed MySQL Hostinger gives you).
3. **Create the database and a user** (in phpMyAdmin or the MySQL CLI). You already have
   the database name `u435532808_Booking`. Note the username and password.
4. **Copy the project to the VPS** and install dependencies:
   ```bash
   npm install
   ```
5. **Fill in `.env`** on the VPS (do NOT commit real passwords):
   ```
   DB_DRIVER=sqlite          # keep sqlite for now; we flip to mysql after the cutover
   MYSQL_HOST=127.0.0.1      # use 127.0.0.1 when MySQL is on the same VPS
   MYSQL_PORT=3306
   MYSQL_USER=your_mysql_user
   MYSQL_PASSWORD=your_mysql_password
   MYSQL_DATABASE=u435532808_Booking
   ```
   If you must use the remote host instead: set `MYSQL_HOST=srv1570.hstgr.io` and add the
   VPS's IP under **Hostinger → Remote MySQL**, choosing the `u435532808_Booking` database.
6. **Test the connection and create the tables:**
   ```bash
   npm run db:check
   ```
   You should see "✅ All tables present". If it fails, the message explains what to fix.

## Finishing the cutover (do this together)

Once `npm run db:check` passes on the VPS:
1. I enable the MySQL data layer (async data functions + MySQL backend).
2. We set `DB_DRIVER=mysql` in `.env` and restart.
3. We run a full smoke test: create a test booking, confirm it appears in admin and in
   the MySQL `bookings` table, update its status, then delete the test row.
4. (Optional) migrate any existing SQLite bookings into MySQL with a one-time export/import.
5. Once confirmed, MySQL is the live database; SQLite stays available only as a fallback.

## Security reminders

- Never paste real DB passwords into chat or commit them — they live only in `.env` on the server.
- Change the admin password: set a strong `ADMIN_PASSWORD` in `.env` (it is still the default).
- Keep `.env` out of version control (it already is, via `.gitignore`).
