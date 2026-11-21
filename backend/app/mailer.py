"""Email through Postmark. Without POSTMARK_TOKEN the email is written to the log instead (development and tests).

Sending never raises: a failed email is logged and send_email returns False, so it can't break a booking.
Emails about something that happened (a booking, a request) are queued with app/outbox.py and go out in one batch once the
database change is saved, during the request (on Vercel, work after the response can be cut off).
Addresses at example.com (the demo accounts) are never emailed: that domain is reserved and nothing there can arrive.

Check the setup by sending yourself a test email:
    cd backend && venv/bin/python -m app.mailer you@waprep.org
"""
import html
import json
import logging
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import List, Optional

from . import config

log = logging.getLogger("office_hours.email")

POSTMARK_URL = "https://api.postmarkapp.com/email"
POSTMARK_BATCH_URL = "https://api.postmarkapp.com/email/batch"
_BATCH_LIMIT = 500  # Postmark's maximum per batch call
SCHOOL = "Washington Prep Office Hours"
_TIMEOUT_SECONDS = 10


@dataclass
class Email:
    to: str
    subject: str
    text: str
    html: str
    # Postmark tag, to filter its Activity page by kind of email ("invite", "booking", ...).
    tag: str = ""


def render(to: str, subject: str, heading: str, lines: List[str], button: Optional[tuple] = None, tag: str = "") -> Email:
    """One plain email in the school's style: a heading, short paragraphs, and an optional (label, url) button.
    Lines are plain text; they are escaped for the HTML version."""
    text = "\n\n".join([heading, *lines] + (["%s: %s" % button] if button else []) + ["-- " + SCHOOL])
    paragraphs = "".join('<p style="margin:0 0 14px">%s</p>' % html.escape(line) for line in lines)
    cta = ""
    if button:
        label, url = button
        cta = ('<p style="margin:22px 0"><a href="%s" style="background:#1f3a68;color:#ffffff;padding:12px 20px;'
               'border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">%s</a></p>'
               % (html.escape(url, quote=True), html.escape(label)))
    body = (
        '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1b2333;max-width:520px">'
        '<h1 style="font-size:20px;margin:0 0 16px">%s</h1>%s%s'
        '<p style="margin:28px 0 0;font-size:13px;color:#6b7280">%s</p></div>'
        % (html.escape(heading), paragraphs, cta, SCHOOL)
    )
    return Email(to=to, subject=subject, text=text, html=body, tag=tag)


def _deliverable(message: Email) -> bool:
    if not message.to:
        return False
    if message.to.lower().endswith("@example.com"):
        log.info("Email skipped (example.com demo address). To: %s | Subject: %s", message.to, message.subject)
        return False
    return True


def _payload(message: Email) -> dict:
    payload = {
        "From": "%s <%s>" % (SCHOOL, config.EMAIL_FROM),
        "To": message.to,
        "Subject": message.subject,
        "TextBody": message.text,
        "HtmlBody": message.html,
        "MessageStream": "outbound",
    }
    if message.tag:
        payload["Tag"] = message.tag
    return payload


def _post(url: str, body) -> Optional[object]:
    """POSTs JSON to Postmark. The decoded answer, or None after logging why it failed."""
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        method="POST",
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "X-Postmark-Server-Token": config.POSTMARK_TOKEN,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT_SECONDS) as response:
            return json.loads(response.read() or b"null")
    except urllib.error.HTTPError as err:
        # Postmark answers {"ErrorCode": n, "Message": "..."}, e.g. 300 invalid address, 406 inactive recipient.
        log.error("Postmark refused the email (HTTP %s): %s", err.code, err.read().decode(errors="replace"))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as err:
        log.error("Could not reach Postmark: %s", err)
    return None


def _ready(messages: List[Email]) -> List[Email]:
    """The messages that can go out now. Without a token they are logged instead (and count as handled)."""
    messages = [m for m in messages if _deliverable(m)]
    if messages and not config.POSTMARK_TOKEN:
        for m in messages:
            log.info("Email not sent (no POSTMARK_TOKEN). To: %s | Subject: %s\n%s", m.to, m.subject, m.text)
        return []
    if messages and not config.EMAIL_FROM:
        log.error("%d email(s) not sent: EMAIL_FROM is not set.", len(messages))
        return []
    return messages


def send_email(message: Email) -> bool:
    """Sends one email. True when Postmark accepted it (or it was logged because there is no token)."""
    if not _deliverable(message):
        return False
    if not _ready([message]):
        return not config.POSTMARK_TOKEN
    answer = _post(POSTMARK_URL, _payload(message))
    if answer is None:
        log.error("Email to %s not sent: %s", message.to, message.subject)
    return answer is not None


def send_many(messages: List[Email]) -> int:
    """Sends several emails in as few calls as possible. Returns how many Postmark accepted."""
    messages = _ready(messages)
    accepted = 0
    for start in range(0, len(messages), _BATCH_LIMIT):
        chunk = messages[start:start + _BATCH_LIMIT]
        answers = _post(POSTMARK_BATCH_URL, [_payload(m) for m in chunk])
        if not isinstance(answers, list):
            continue
        # One answer per message, in order; ErrorCode 0 means accepted.
        for message, answer in zip(chunk, answers):
            if isinstance(answer, dict) and answer.get("ErrorCode") == 0:
                accepted += 1
                log.info("Email sent. To: %s | Subject: %s", message.to, message.subject)
            else:
                log.error("Postmark refused the email to %s: %s", message.to,
                          answer.get("Message") if isinstance(answer, dict) else answer)
    return accepted


def _send_test(to: str) -> int:
    message = render(
        to,
        "Test email from %s" % SCHOOL,
        "Email is working",
        ["This is a test from the Office Hours backend. If you can read this, Postmark is set up correctly."],
        button=("Open Office Hours", config.APP_URL),
        tag="test",
    )
    if not config.POSTMARK_TOKEN:
        print("POSTMARK_TOKEN is empty in backend/.env, so nothing was sent. This is what would go out:\n")
        print(message.text)
        return 1
    ok = send_email(message)
    print("Sent to %s. Check the inbox (and spam)." % to if ok else "Not sent. See the error above.")
    return 0 if ok else 1


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        print("Usage: python -m app.mailer you@waprep.org")
        sys.exit(2)
    sys.exit(_send_test(sys.argv[1]))
