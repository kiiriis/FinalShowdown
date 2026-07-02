/**
 * Seed jobs + per-user statuses from a spreadsheet CSV export.
 *
 * Reads `seed.config.json` (see `seed.config.example.json`) to learn where
 * the CSV lives and which columns hold each person's status/referral cells.
 *
 * Idempotent: re-running only fills gaps — but note it re-asserts whatever
 * the CSV says for existing entries (see docs/SEEDING.md).
 *
 * Usage:
 *   npm run seed
 */
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";
import {
  parseCsvAppStatus,
  parseCsvReferral,
} from "../lib/status-maps.js";

const prisma = new PrismaClient();

type SeedUser = {
  displayName: string;
  statusColumn: string;
  referralColumn: string;
};
type SeedConfig = {
  csvPath: string;
  users: SeedUser[];
};

const CONFIG_PATH = path.resolve(process.cwd(), "seed.config.json");

function loadConfig(): SeedConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(
      "seed.config.json not found. Copy seed.config.example.json, point it " +
        "at your CSV export, and map each person's status/referral columns.",
    );
    process.exit(1);
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) as SeedConfig;
  if (!cfg.csvPath || !Array.isArray(cfg.users) || cfg.users.length === 0) {
    console.error(
      "seed.config.json must define `csvPath` and a non-empty `users` array.",
    );
    process.exit(1);
  }
  return cfg;
}

function parseDisplayNames(): Map<string, string> {
  const raw = process.env.USER_DISPLAY_NAMES ?? "";
  const byName = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const [email, name] = pair.split("=").map((s) => s?.trim());
    if (email && name) byName.set(name.toLowerCase(), email.toLowerCase());
  }
  return byName;
}

async function main() {
  const config = loadConfig();
  const csvPath = path.resolve(process.cwd(), config.csvPath);
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at ${csvPath}`);
    process.exit(1);
  }

  const adminEmail = (process.env.ADMIN_SEED_EMAIL ?? "").toLowerCase();
  if (!adminEmail) {
    console.error(
      "ADMIN_SEED_EMAIL is required so imported jobs have an addedBy.",
    );
    process.exit(1);
  }

  const nameToEmail = parseDisplayNames();

  // Ensure users exist (real email if known, placeholder otherwise)
  const users = [];
  for (const u of config.users) {
    const email =
      nameToEmail.get(u.displayName.toLowerCase()) ??
      `${u.displayName.toLowerCase()}@final-showdown.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: { displayName: u.displayName },
      create: {
        email,
        name: u.displayName,
        displayName: u.displayName,
      },
    });
    users.push({ ...u, id: user.id, email });
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: adminEmail.split("@")[0],
      displayName: adminEmail.split("@")[0],
    },
  });

  const raw = fs.readFileSync(csvPath, "utf8");
  const rows: Array<Record<string, string>> = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  console.log(`Parsed ${rows.length} rows from CSV.`);

  // Fail fast on typo'd column names instead of silently importing nothing.
  const headers = new Set(Object.keys(rows[0] ?? {}));
  for (const u of users) {
    for (const col of [u.statusColumn, u.referralColumn]) {
      if (!headers.has(col)) {
        console.error(
          `Column "${col}" (for ${u.displayName}) not found in CSV headers: ` +
            [...headers].join(", "),
        );
        process.exit(1);
      }
    }
  }

  let createdJobs = 0;
  let skippedJobs = 0;
  let createdEntries = 0;

  for (const r of rows) {
    const company = (r.Company ?? "").trim();
    const position = (r.Position ?? "").trim();
    const link = (r.Link ?? "").trim();
    if (!company || !link) {
      skippedJobs++;
      continue;
    }

    const existing = await prisma.job.findUnique({ where: { link } });
    const job =
      existing ??
      (await prisma.job.create({
        data: {
          company,
          position: position || "—",
          link,
          addedById: admin.id,
        },
      }));
    if (!existing) createdJobs++;

    for (const u of users) {
      const status = parseCsvAppStatus(r[u.statusColumn]);
      const referral = parseCsvReferral(r[u.referralColumn]);
      if (status === "NONE" && referral === "NONE") continue;
      const res = await prisma.jobEntry.upsert({
        where: { jobId_userId: { jobId: job.id, userId: u.id } },
        create: { jobId: job.id, userId: u.id, status, referral },
        update: { status, referral },
      });
      if (res) createdEntries++;
    }
  }

  console.log(
    `Done. Jobs: +${createdJobs} new, ${skippedJobs} skipped. Entries touched: ${createdEntries}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
