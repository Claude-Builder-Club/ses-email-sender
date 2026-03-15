import "dotenv/config";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import fs from "fs";
import readline from "readline";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const FROM = process.env.EMAIL_FROM;         // must match verified SES domain
const SUBJECT = process.env.EMAIL_SUBJECT;
const SOURCES = [
  { path: "./ASU Student Sign-ups.csv",        column: 2 },
  { path: "./Claude Builder Club Members.csv", column: 4,
    // skip members who unsubscribed (col 19) or left the group (col 20)
    filter: (cols) =>
      cols[19]?.trim().replace(/^"|"$/g, "") !== "1" &&
      cols[20]?.trim().replace(/^"|"$/g, "") !== "1",
  },
];
const DELAY_MS = 100;                        // 100ms between sends = ~10/sec (safe under 14/sec limit)
// ────────────────────────────────────────────────────────────────────────────

const client = new SESClient({ region: "us-east-1" });

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readEmails(csvPath, columnIndex, filter) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Source file not found: ${csvPath}`);
  }

  const emails = [];
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isFirstLine = true;
  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      // Skip header row if it doesn't look like an email
      if (!line.split(",")[columnIndex]?.includes("@")) continue;
    }
    const cols = line.split(",");
    if (filter && !filter(cols)) continue;
    const email = cols[columnIndex]?.trim().replace(/^"|"$/g, "").toLowerCase();
    if (email && email.includes("@")) emails.push(email);
  }

  return emails;
}

async function sendEmail(to, rawMime) {
  // Inject the To header dynamically for each recipient
  const rawMessage = rawMime.replace(
    "MIME-Version: 1.0",
    `MIME-Version: 1.0\nTo: ${to}`,
  );

  const command = new SendRawEmailCommand({
    RawMessage: { Data: Buffer.from(rawMessage) },
    Source: FROM,
    Destinations: [to],
  });

  return client.send(command);
}

async function main() {
  // ── TEMPLATE ───────────────────────────────────────────────────────────────
  const templateArgIdx = process.argv.indexOf("--template");
  const templatePath = templateArgIdx !== -1 ? process.argv[templateArgIdx + 1] : null;
  if (!templatePath) {
    throw new Error("--template is required: node send_bulk.js --template ./templates/email.html");
  }
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found: ${templatePath}`);
  }
  const HTML_BODY = fs.readFileSync(templatePath, "utf8");
  const RAW_MIME = `MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8
Subject: ${SUBJECT}

${HTML_BODY}`;
  // ──────────────────────────────────────────────────────────────────────────

  // ── TEST MODE ──────────────────────────────────────────────────────────────
  const testArgIdx = process.argv.indexOf("--test");
  if (testArgIdx !== -1) {
    const testEmail = process.argv[testArgIdx + 1];
    if (!testEmail || !testEmail.includes("@")) {
      throw new Error("--test requires a valid email address: node send_bulk.js --test you@example.com");
    }
    console.log(`Test mode: sending to ${testEmail} only...\n`);
    await sendEmail(testEmail, RAW_MIME);
    console.log(`✓ Test email sent to ${testEmail}`);
    return;
  }
  // ──────────────────────────────────────────────────────────────────────────

  const seen = new Set();
  const emails = [];

  for (const source of SOURCES) {
    const raw = await readEmails(source.path, source.column, source.filter);
    for (const email of raw) {
      if (!seen.has(email)) {
        seen.add(email);
        emails.push(email);
      }
    }
  }

  console.log(`Found ${emails.length} unique emails. Starting send...\n`);

  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      await sendEmail(email, RAW_MIME);
      sent++;
      console.log(`✓ [${sent + failed}/${emails.length}] ${email}`);
    } catch (err) {
      failed++;
      console.error(
        `✗ [${sent + failed}/${emails.length}] ${email} — ${err.message}`,
      );
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. ✓ ${sent} sent, ✗ ${failed} failed.`);
}

main();
