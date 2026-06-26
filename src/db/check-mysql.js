#!/usr/bin/env node
/**
 * MySQL connection + setup checker for the TelePlus Care booking system.
 *
 * Run this on the server where MySQL is reachable (e.g. your Hostinger VPS):
 *
 *     npm run db:check
 *
 * It reads the MYSQL_* values from your .env file, connects, creates the
 * tables from src/db/mysql-schema.sql (safe to run repeatedly), and confirms
 * everything is in place. It NEVER deletes data.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");

const REQUIRED_TABLES = [
  "bookings",
  "settings",
  "booking_attachments",
  "service_requests",
  "service_request_attachments",
  "partial_form_drafts",
  "booking_events",
  "waitlist_entries"
];

function readConfig() {
  const config = {
    host: process.env.MYSQL_HOST || "",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || ""
  };

  const missing = ["host", "user", "password", "database"].filter((key) => !config[key]);
  if (missing.length) {
    console.error("Missing MySQL settings in .env:", missing.map((key) => `MYSQL_${key.toUpperCase()}`).join(", "));
    console.error("\nAdd these to your .env file, then run `npm run db:check` again:");
    console.error("  MYSQL_HOST=srv1570.hstgr.io      # or 127.0.0.1 if MySQL is on the same VPS");
    console.error("  MYSQL_PORT=3306");
    console.error("  MYSQL_USER=your_mysql_user");
    console.error("  MYSQL_PASSWORD=your_mysql_password");
    console.error("  MYSQL_DATABASE=u435532808_Booking");
    process.exit(1);
  }

  return config;
}

function loadSchemaStatements() {
  const schemaPath = path.join(__dirname, "mysql-schema.sql");
  const raw = fs.readFileSync(schemaPath, "utf8");
  return raw
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  let mysql;
  try {
    mysql = require("mysql2/promise");
  } catch (error) {
    console.error("The mysql2 package is not installed. Run `npm install` first.");
    process.exit(1);
  }

  const config = readConfig();
  console.log(`Connecting to MySQL at ${config.host}:${config.port} as ${config.user} (database ${config.database})...`);

  let connection;
  try {
    connection = await mysql.createConnection({
      ...config,
      multipleStatements: false,
      connectTimeout: 15000
    });
  } catch (error) {
    console.error("\n❌ Could not connect to MySQL.");
    console.error("   " + error.message);
    console.error("\nCommon fixes:");
    console.error("  • Make sure the database name and user/password are correct.");
    console.error("  • In Hostinger > Remote MySQL, add this server's IP so it can connect");
    console.error("    (or use MYSQL_HOST=127.0.0.1 when the app runs on the same VPS as MySQL).");
    process.exit(1);
  }

  console.log("✅ Connected.");

  const statements = loadSchemaStatements();
  console.log(`Applying schema (${statements.length} tables, safe to repeat)...`);
  for (const statement of statements) {
    await connection.query(statement);
  }

  const [rows] = await connection.query(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ?",
    [config.database]
  );
  const present = new Set(rows.map((row) => String(row.t || row.TABLE_NAME)));
  const missing = REQUIRED_TABLES.filter((table) => !present.has(table));

  await connection.end();

  if (missing.length) {
    console.error("\n❌ These tables are still missing:", missing.join(", "));
    process.exit(1);
  }

  console.log("✅ All tables present:", REQUIRED_TABLES.join(", "));
  console.log("\n🎉 MySQL is ready. Set DB_DRIVER=mysql in .env to use it (once the MySQL data layer is enabled).");
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
