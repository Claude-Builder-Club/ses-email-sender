# ses-email-sender

Bulk HTML email sender using AWS SES. Reads recipients from two source CSVs, deduplicates, and sends each one a templated email with rate limiting.

## Project Structure

```
├── send_bulk.js          # Main script: merges sources, deduplicates, and sends
├── templates/
│   └── email.html        # HTML email template(s)
├── scripts/
│   └── emails.py         # Optional standalone utility to produce emails.csv
├── .env                  # Credentials (gitignored)
└── .env.example          # Env var reference
```

## Setup

**1. Install dependencies**
```bash
npm install
```

**2. Configure environment variables**

Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

```env
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
EMAIL_FROM=you@yourdomain.com
EMAIL_SUBJECT=Your email subject line
```

`EMAIL_FROM` must be a verified identity in your AWS SES account.

**3. Add your source CSVs**

Place both files at the repo root (they are gitignored):

| File | Email column |
|---|---|
| `ASU Student Sign-ups.csv` | Column 2 — `.edu` signup email |
| `Claude Builder Club Members.csv` | Column 4 — `Email` field |

`send_bulk.js` reads both, deduplicates across them, and automatically skips members who have unsubscribed or left the group.

**4. Add your email template**

Place an HTML template in `templates/` and pass its path via `--template` at runtime.

## Usage

**Bulk send:**
```bash
node send_bulk.js --template ./templates/email.html
```

**Test send** (one real email to a single address before going bulk):
```bash
node send_bulk.js --template ./templates/email.html --test you@example.com
```

Output shows live progress:
```
Found 500 unique emails. Starting send...

✓ [1/500] alice@asu.edu
✓ [2/500] bob@asu.edu
...

Done. ✓ 498 sent, ✗ 2 failed.
```

## CLI Flags

| Flag | Required | Description |
|---|---|---|
| `--template <path>` | Yes | Path to the HTML email template |
| `--test <email>` | No | Send to one address only (skips CSV reading) |

## Configuration

Edit the constants at the top of `send_bulk.js`:

| Constant | Default | Description |
|---|---|---|
| `SOURCES` | see file | Array of `{ path, column, filter? }` source CSVs |
| `DELAY_MS` | `100` | Delay between sends (ms) |

The default 100ms delay keeps throughput at ~10 emails/sec, safely under the SES default limit of 14/sec.

## AWS SES Requirements

- Your sending domain or address must be verified in SES
- Your account must be out of the SES sandbox (or recipients must be verified) for production sends
- IAM user needs `ses:SendRawEmail` permission
