import "dotenv/config";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import fs from "fs";
import readline from "readline";

// ── CONFIG ──────────────────────────────────────────────────────────────────
const FROM = process.env.EMAIL_FROM;         // must match verified SES domain
const SUBJECT = process.env.EMAIL_SUBJECT;
const CSV_PATH = "./emails.csv";             // path to your CSV file
const CSV_COLUMN = 0;                        // which column index has the email (0 = first column)
const DELAY_MS = 100;                        // 100ms between sends = ~10/sec (safe under 14/sec limit)
// ────────────────────────────────────────────────────────────────────────────

const client = new SESClient({ region: "us-east-1" });

const HTML_BODY = fs.readFileSync("./templates/email.html", "utf8");

const RAW_MIME = `MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8
Subject: ${SUBJECT}

${HTML_BODY}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readEmails(csvPath, columnIndex) {
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
    const email = line.split(",")[columnIndex]?.trim().replace(/^"|"$/g, "");
    if (email && email.includes("@")) emails.push(email);
  }

  return emails;
}

async function sendEmail(to) {
  // Inject the To header dynamically for each recipient
  const rawMessage = RAW_MIME.replace(
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
  const emails = await readEmails(CSV_PATH, CSV_COLUMN);
  console.log(`Found ${emails.length} emails. Starting send...\n`);

  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      await sendEmail(email);
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
