#!/usr/bin/env node
/**
 * Mawthook Setup Wizard
 * Native setup script — no Docker required.
 * Run: node setup.mjs
 */

import { createInterface } from "readline";
import { execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { randomBytes } from "crypto";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));
const askSecret = (q) => new Promise((res) => {
  process.stdout.write(q);
  process.stdin.setRawMode?.(true);
  let val = "";
  const handler = (buf) => {
    const ch = buf.toString();
    if (ch === "\r" || ch === "\n") {
      process.stdin.setRawMode?.(false);
      process.stdin.removeListener("data", handler);
      process.stdout.write("\n");
      res(val);
    } else if (ch === "\u0003") {
      process.exit();
    } else if (ch === "\u007f") {
      if (val.length > 0) { val = val.slice(0, -1); process.stdout.write("\b \b"); }
    } else {
      val += ch;
      process.stdout.write("*");
    }
  };
  process.stdin.on("data", handler);
});

function run(cmd, opts = {}) {
  execSync(cmd, { stdio: "inherit", ...opts });
}

function tryRun(cmd) {
  try { execSync(cmd, { stdio: "pipe" }); return true; }
  catch { return false; }
}

function getOutput(cmd) {
  try { return execSync(cmd, { stdio: "pipe" }).toString().trim(); }
  catch { return null; }
}

function banner() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║     Mawthook — Native Setup Wizard       ║");
  console.log("╚══════════════════════════════════════════╝\n");
}

function step(n, label) {
  console.log(`\n[${n}] ${label}`);
  console.log("─".repeat(44));
}

// ─── 1. Check Node.js ───────────────────────────────────────────────────────

function checkNode() {
  step(1, "Checking Node.js");
  const raw = getOutput("node --version");
  if (!raw) { console.error("✗  Node.js not found. Install from https://nodejs.org"); process.exit(1); }
  const match = raw.match(/v(\d+)/);
  const major = match ? parseInt(match[1]) : 0;
  if (major < 18) { console.error(`✗  Node.js ${raw} is too old. Need v18+.`); process.exit(1); }
  console.log(`✓  Node.js ${raw}`);
}

// ─── 2. Check npm ───────────────────────────────────────────────────────────

function checkNpm() {
  step(2, "Checking npm");
  const v = getOutput("npm --version");
  if (!v) { console.error("✗  npm not found."); process.exit(1); }
  console.log(`✓  npm ${v}`);
}

// ─── 3. Check MySQL ──────────────────────────────────────────────────────────

function checkMySQL() {
  step(3, "Checking MySQL");
  const v = getOutput("mysql --version");
  if (!v) {
    console.warn("⚠  mysql CLI not found in PATH.");
    console.warn("   Make sure MySQL 8.x is installed and running.");
    console.warn("   On Ubuntu/Debian:  sudo apt install mysql-server");
    console.warn("   On macOS:          brew install mysql");
    console.warn("   On Windows:        https://dev.mysql.com/downloads/installer/");
    console.warn("   Continuing — Prisma will report connection errors if MySQL is unavailable.\n");
  } else {
    console.log(`✓  ${v}`);
  }
}

// ─── 4. Collect DB config ────────────────────────────────────────────────────

async function collectDBConfig() {
  step(4, "MySQL connection details");
  console.log("Leave blank to accept the [default].\n");

  const host = (await ask("  Host      [localhost]: ")).trim() || "localhost";
  const port = (await ask("  Port      [3306]: ")).trim() || "3306";
  const user = (await ask("  User      [mawthook]: ")).trim() || "mawthook";
  const pass = await askSecret("  Password  : ");
  const db   = (await ask("  Database  [mawthook]: ")).trim() || "mawthook";

  return { host, port, user, pass, db };
}

// ─── 5. Collect app config ───────────────────────────────────────────────────

async function collectAppConfig() {
  step(5, "Application settings");
  const appUrl = (await ask("  App URL   [http://localhost:3000]: ")).trim() || "http://localhost:3000";

  console.log("\n  Chatwoot integration (optional — press Enter to skip)");
  const chatwootBase   = (await ask("  Chatwoot Base URL   : ")).trim();
  const chatwootToken  = (await ask("  Chatwoot API Token  : ")).trim();
  const chatwootAcc    = (await ask("  Chatwoot Account ID : ")).trim();
  const chatwootSecret = (await ask("  Chatwoot Webhook Secret [auto-generate]: ")).trim();

  return { appUrl, chatwootBase, chatwootToken, chatwootAcc, chatwootSecret };
}

// ─── 6. Admin credentials ────────────────────────────────────────────────────

async function collectAdminCreds() {
  step(6, "Admin account");
  const email = (await ask("  Email     [admin@mawthook.com]: ")).trim() || "admin@mawthook.com";
  const pass  = await askSecret("  Password  [leave blank to use changeme123]: ");
  return { email, pass: pass || "changeme123" };
}

// ─── 7. Write .env ───────────────────────────────────────────────────────────

function writeEnv(dbCfg, appCfg, encKey, jwtSecret) {
  step(7, "Writing .env");

  const { host, port, user, pass, db } = dbCfg;
  const { appUrl, chatwootBase, chatwootToken, chatwootAcc, chatwootSecret } = appCfg;

  const webhookSecret = chatwootSecret || randomBytes(16).toString("hex");

  const content = [
    `# Generated by setup.mjs on ${new Date().toISOString()}`,
    `DATABASE_URL="mysql://${user}:${encodeURIComponent(pass)}@${host}:${port}/${db}"`,
    ``,
    `ENCRYPTION_KEY="${encKey}"`,
    `JWT_SECRET="${jwtSecret}"`,
    ``,
    `APP_URL="${appUrl}"`,
    ``,
    `CHATWOOT_WEBHOOK_SECRET="${webhookSecret}"`,
    `CHATWOOT_BASE_URL="${chatwootBase}"`,
    `CHATWOOT_API_TOKEN="${chatwootToken}"`,
    `CHATWOOT_ACCOUNT_ID="${chatwootAcc}"`,
  ].join("\n") + "\n";

  writeFileSync(".env", content, "utf8");
  console.log("✓  .env written");
}

// ─── 8. Install dependencies ─────────────────────────────────────────────────

function installDeps() {
  step(8, "Installing dependencies  (npm install)");
  run("npm install");
  console.log("✓  Dependencies installed");
}

// ─── 9. Generate Prisma client ───────────────────────────────────────────────

function generatePrisma() {
  step(9, "Generating Prisma client");
  run("npx prisma generate");
  console.log("✓  Prisma client generated");
}

// ─── 10. Run migrations ──────────────────────────────────────────────────────

function runMigrations() {
  step(10, "Running database migrations");
  run("npx prisma migrate deploy");
  console.log("✓  Migrations applied");
}

// ─── 11. Seed admin user ─────────────────────────────────────────────────────

function seedAdmin(email, pass) {
  step(11, "Seeding admin user");
  run(`ADMIN_EMAIL="${email}" ADMIN_PASSWORD="${pass}" node prisma/seed.mjs`);
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function printSummary(appUrl, adminEmail) {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║            Setup complete!               ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`\n  Start dev server:   npm run dev`);
  console.log(`  Start production:   npm run build && npm start`);
  console.log(`\n  Dashboard:          ${appUrl}/dashboard`);
  console.log(`  Login:              ${adminEmail}`);
  console.log(`\n⚠  Change the admin password after first login!\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  banner();

  // Warn if .env already exists
  if (existsSync(".env")) {
    const overwrite = (await ask("⚠  .env already exists. Overwrite? [y/N]: ")).trim().toLowerCase();
    if (overwrite !== "y") {
      console.log("Keeping existing .env. Skipping to install step.\n");
      rl.close();
      installDeps();
      generatePrisma();
      runMigrations();
      console.log("\n✓  Done. Run: npm run dev\n");
      process.exit(0);
    }
  }

  checkNode();
  checkNpm();
  checkMySQL();

  const dbCfg    = await collectDBConfig();
  const appCfg   = await collectAppConfig();
  const admin    = await collectAdminCreds();
  rl.close();

  const encKey   = randomBytes(32).toString("hex");
  const jwtSecret = randomBytes(32).toString("hex");

  console.log("\n  Auto-generated:");
  console.log(`  ENCRYPTION_KEY = ${encKey}`);
  console.log(`  JWT_SECRET     = ${jwtSecret}`);
  console.log("  (These are saved in .env — keep that file private)\n");

  writeEnv(dbCfg, appCfg, encKey, jwtSecret);
  installDeps();
  generatePrisma();
  runMigrations();
  seedAdmin(admin.email, admin.pass);
  printSummary(appCfg.appUrl, admin.email);
}

main().catch((err) => {
  console.error("\n✗  Setup failed:", err.message || err);
  process.exit(1);
});
