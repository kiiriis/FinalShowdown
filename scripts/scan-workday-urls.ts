import { prisma } from "../lib/db";

async function main() {
  const all = await prisma.job.findMany({
    select: { id: true, link: true, company: true },
  });

  const workday = all.filter((j) => {
    try {
      return new URL(j.link).host.includes("myworkdayjobs.com");
    } catch {
      return false;
    }
  });

  console.log(`Total jobs:            ${all.length}`);
  console.log(`Workday jobs:          ${workday.length}\n`);

  // Bucket by host (subdomain = the company tenant, e.g. salesforce.wd12)
  const byHost = new Map<string, number>();
  // Segment-count distribution of the path
  const segCount = new Map<number, number>();
  // Samples of path shapes so we can spot patterns
  const pathSamples: Array<{ host: string; path: string; company: string }> = [];
  // Extract the last path segment and look at the suffix after the last "_"
  const idSuffixPattern = new Map<string, number>(); // e.g. "_JR<digits>" → count
  const idExamples = new Map<string, string>();

  for (const j of workday) {
    let u: URL;
    try {
      u = new URL(j.link);
    } catch {
      continue;
    }
    byHost.set(u.host, (byHost.get(u.host) ?? 0) + 1);

    const segs = u.pathname.split("/").filter(Boolean);
    segCount.set(segs.length, (segCount.get(segs.length) ?? 0) + 1);

    pathSamples.push({ host: u.host, path: u.pathname, company: j.company });

    const last = segs[segs.length - 1] ?? "";
    // Capture the suffix after last underscore → e.g. "_JR328085", "_R-00003123"
    const idMatch = last.match(/_([A-Za-z][A-Za-z0-9\-]*\d[A-Za-z0-9\-]*)$/);
    if (idMatch) {
      const full = idMatch[0]; // e.g. "_JR328085"
      // Reduce to shape (letters before numbers): "JR" + "<digits>"
      const shape = full.replace(/\d+/g, "N").replace(/-/g, "-");
      idSuffixPattern.set(shape, (idSuffixPattern.get(shape) ?? 0) + 1);
      if (!idExamples.has(shape)) idExamples.set(shape, full);
    } else {
      idSuffixPattern.set("(no trailing _id)", (idSuffixPattern.get("(no trailing _id)") ?? 0) + 1);
    }
  }

  console.log("Host breakdown (tenant.wdN.myworkdayjobs.com):");
  [...byHost.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([h, n]) => console.log(`  ${n.toString().padStart(4)}  ${h}`));

  console.log("\nPath segment count:");
  [...segCount.entries()]
    .sort((a, b) => a[0] - b[0])
    .forEach(([k, v]) => console.log(`  ${k} segments → ${v} URLs`));

  console.log("\nTrailing _<ID> suffix patterns:");
  [...idSuffixPattern.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([shape, n]) =>
      console.log(
        `  ${n.toString().padStart(4)}  ${shape.padEnd(20)}  e.g. ${idExamples.get(shape) ?? ""}`,
      ),
    );

  console.log("\nRandom path samples (first 15):");
  pathSamples.slice(0, 15).forEach((s) => {
    console.log(`  [${s.company}]`);
    console.log(`     ${s.host}${s.path}`);
  });

  // Look for the same trailing ID appearing in multiple URLs (real dupes hiding)
  const byTrailingId = new Map<string, Array<{ id: string; link: string; company: string }>>();
  for (const j of workday) {
    try {
      const u = new URL(j.link);
      const segs = u.pathname.split("/").filter(Boolean);
      const last = segs[segs.length - 1] ?? "";
      const idMatch = last.match(/_([A-Za-z][A-Za-z0-9\-]*\d[A-Za-z0-9\-]*)$/);
      if (!idMatch) continue;
      const key = `${u.host}|${idMatch[1]}`;
      const list = byTrailingId.get(key) ?? [];
      list.push({ id: j.id, link: j.link, company: j.company });
      byTrailingId.set(key, list);
    } catch {}
  }
  const dupeGroups = [...byTrailingId.entries()].filter(([, v]) => v.length > 1);
  console.log(
    `\nHidden dupes (same host + trailing _ID, different paths): ${dupeGroups.length} group(s)`,
  );
  dupeGroups.slice(0, 10).forEach(([key, list]) => {
    console.log(`\n  ${key}`);
    list.forEach((x) => console.log(`    - [${x.company}] ${x.link}`));
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
