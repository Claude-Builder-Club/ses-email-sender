import csv

SIGNUPS_FILE = "ASU Student Sign-ups.csv"
MEMBERS_FILE = "Claude Builder Club Members.csv"
OUTPUT_FILE = "emails.csv"

SIGNUPS_EMAIL_COL = 2   # "What is your .edu or university email?"
MEMBERS_EMAIL_COL = 4   # "Email"
MEMBERS_UNSUBSCRIBED_COL = 19  # "Unsubscribed from all emails"
MEMBERS_LEFT_COL = 20          # "Left Group"

seen = set()
unique_emails = []

def collect_emails(filepath, col_index, skip_cols=None):
    with open(filepath, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            if len(row) > col_index:
                if skip_cols and any(
                    len(row) > c and row[c].strip() == "1" for c in skip_cols
                ):
                    continue
                email = row[col_index].strip().lower()
                if email and email not in seen:
                    seen.add(email)
                    unique_emails.append(email)

collect_emails(SIGNUPS_FILE, SIGNUPS_EMAIL_COL)
collect_emails(MEMBERS_FILE, MEMBERS_EMAIL_COL,
               skip_cols=[MEMBERS_UNSUBSCRIBED_COL, MEMBERS_LEFT_COL])

print(f"Total unique emails: {len(unique_emails)}")

with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["email"])
    for email in unique_emails:
        writer.writerow([email])

print(f"Output written to: {OUTPUT_FILE}")
