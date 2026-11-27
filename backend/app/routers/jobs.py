"""Scheduled jobs, called by a timer (Vercel Cron, cron-job.org, ...), never by the app.

GET (Vercel Cron's method) or POST /jobs/reminders with "Authorization: Bearer <CRON_SECRET>".
"""
import hmac

from fastapi import APIRouter, Header
from fastapi.concurrency import run_in_threadpool

from .. import config, reminders
from ..errors import RuleError

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _check_secret(authorization: str) -> None:
    if not config.CRON_SECRET:
        raise RuleError("not_found", "Not found.")
    given = authorization[7:].strip() if authorization.lower().startswith("bearer ") else ""
    if not hmac.compare_digest(given.encode(), config.CRON_SECRET.encode()):
        raise RuleError("unauthorized", "Wrong or missing job secret.")


@router.api_route("/reminders", methods=["GET", "POST"])
async def send_reminders(authorization: str = Header(default="")):
    """Sends every reminder that is due now. Answers how many of each kind went out."""
    _check_secret(authorization)
    return {"sent": await run_in_threadpool(reminders.run_once)}
