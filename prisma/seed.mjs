/**
 * Seed script — creates an initial admin user if none exist.
 *
 * Usage:
 *   node prisma/seed.mjs                          # uses defaults
 *   ADMIN_EMAIL=x ADMIN_PASSWORD=y node prisma/seed.mjs  # custom creds
 *
 * Inside Docker:
 *   docker compose exec app node prisma/seed.mjs
 */

import { PrismaClient } from "../src/generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`⏭  ${userCount} user(s) already exist — skipping seed.`);
    return;
  }

  const email = process.env.ADMIN_EMAIL || "admin@mawthook.com";
  const password = process.env.ADMIN_PASSWORD || "changeme123";

  const hash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hash, name: "Admin" },
  });

  console.log(`✅ Admin user created`);
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   ID:       ${user.id}`);
  console.log(`\n⚠  Change the password after first login!`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
