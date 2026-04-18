/**
 * Seed jobs + per-user statuses from "Final Showdown - Applications.csv".
 *
 * Idempotent: re-running only fills gaps.
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

const CSV_PATH = path.resolve(
  process.cwd(),
  "Final Showdown - Applications.csv",
);

type Row = {
  Company: string;
  Position: string;
  Link: string;
  "Krish Status": string;
  "Murtaza Status": string;
  "Stavan's Status": string;
  "Parth's Status": string;
  "Krish Referral": string;
  "Murtaza Referral": string;
  "Stavan's Referral Status": string;
  "Parth's Referral": string;
};

/** CSV column display name → status column key → referral column key. */
const USERS = [
  {
    displayName: "Krish",
    statusCol: "Krish Status" as const,
    refCol: "Krish Referral" as const,
  },
  {
    displayName: "Murtaza",
    statusCol: "Murtaza Status" as const,
    refCol: "Murtaza Referral" as const,
  },
  {
    displayName: "Stavan",
    statusCol: "Stavan's Status" as const,
    refCol: "Stavan's Referral Status" as const,
  },
  {
    displayName: "Parth",
    statusCol: "Parth's Status" as const,
    refCol: "Parth's Referral" as const,
  },
];

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
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
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
  for (const u of USERS) {
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

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const rows: Row[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  });

  console.log(`Parsed ${rows.length} rows from CSV.`);

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
      const status = parseCsvAppStatus(r[u.statusCol]);
      const referral = parseCsvReferral(r[u.refCol]);
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
