# ses-email-sender

Bulk HTML email sender using AWS SES. Reads a list of recipients from a CSV and sends each one a templated email with rate limiting.

## Project Structure

```
├── send_bulk.js          # Main send script
├── templates/
│   └── email.html        # HTML email template
├── scripts/
│   └── emails.py         # Utility to deduplicate emails from multiple CSVs
├── emails.csv            # Recipient list (gitignored)
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

**3. Add your recipient list**

Place a CSV file at `emails.csv` with email addresses in the first column (index 0). A header row is fine — it's skipped automatically if it doesn't contain `@`.

```csv
email
alice@example.com
bob@example.com
```

**4. Edit the email template**

Edit `templates/email.html` with your email content.

## Usage

```bash
node send_bulk.js
```

Output shows live progress:
```
Found 500 emails. Starting send...

✓ [1/500] alice@example.com
✓ [2/500] bob@example.com
...

Done. ✓ 498 sent, ✗ 2 failed.
```

## Configuration

Edit the constants at the top of `send_bulk.js`:

| Constant | Default | Description |
|---|---|---|
| `CSV_PATH` | `./emails.csv` | Path to recipient CSV |
| `CSV_COLUMN` | `0` | Column index containing emails |
| `DELAY_MS` | `100` | Delay between sends (ms) |

The default 100ms delay keeps throughput at ~10 emails/sec, safely under the SES default limit of 14/sec.

## Deduplicating Emails from Multiple CSVs

`scripts/emails.py` merges and deduplicates emails from multiple source CSVs into a single output file:

```bash
python3 scripts/emails.py
```

Edit the file paths and column indices at the top of the script to match your sources.

## AWS SES Requirements

- Your sending domain or address must be verified in SES
- Your account must be out of the SES sandbox (or recipients must be verified) for production sends
- IAM user needs `ses:SendRawEmail` permission
