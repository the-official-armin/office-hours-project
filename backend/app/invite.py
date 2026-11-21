"""Add people and manage their accounts. Run by a developer; there is no sign-up page.

    cd backend
    venv/bin/python -m app.invite people.csv               # invite everyone in the file (skips emails that have an account)
    venv/bin/python -m app.invite --resend maya@waprep.org  # new activation link (the old one stops working)
    venv/bin/python -m app.invite --deactivate maya@waprep.org
    venv/bin/python -m app.invite --reactivate maya@waprep.org
    venv/bin/python -m app.invite --list

people.csv has a header row. Columns: name, email, role (teacher or student), and optionally grade (students),
subject and group (teachers; group is the "Find a teacher" filter, the subject when left empty):

    name,email,role,grade,subject,group
    Maya Kim,maya.kim@waprep.org,student,Grade 10,,
    Ana Rivera,ana.rivera@waprep.org,teacher,,Mathematics,Math

Uses DATABASE_URL and POSTMARK_TOKEN from backend/.env. Without a token the emails (and their links) are printed in the log.
"""
import argparse
import csv
import logging
import sys
from typing import List

from . import accounts
from .database import Base, SessionLocal, engine
from .errors import RuleError
from .models import STATUS_ACTIVE, STATUS_DEACTIVATED, Student, Teacher


def invite_file(path: str) -> int:
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows: List[dict] = [{(k or "").strip().lower(): (v or "").strip() for k, v in row.items()} for row in csv.DictReader(f)]
    missing = {"name", "email", "role"} - set(rows[0] if rows else {})
    if missing:
        print("The file needs a header row with name, email and role (missing: %s)." % ", ".join(sorted(missing)))
        return 2

    invited = skipped = failed = 0
    db = SessionLocal()
    try:
        for line, row in enumerate(rows, start=2):
            try:
                person = accounts.invite(db, row["name"], row["email"], row["role"].lower(),
                                         grade=row.get("grade", ""), subject=row.get("subject", ""), group=row.get("group", ""))
                invited += 1
                print("invited   %-8s %s (%s)" % (row["role"].lower(), person.email, person.id))
            except RuleError as err:
                db.rollback()
                if err.code == "email_taken":
                    skipped += 1
                    print("skipped   line %d: %s" % (line, err.message))
                else:
                    failed += 1
                    print("ERROR     line %d: %s" % (line, err.message))
    finally:
        db.close()
    print("\n%d invited, %d already had an account, %d with errors." % (invited, skipped, failed))
    return 1 if failed else 0


def one(action: str, email: str) -> int:
    db = SessionLocal()
    try:
        if action == "resend":
            person = accounts.resend_invite(db, email)
            print("New activation link sent to %s." % person.email)
        else:
            person = accounts.set_status(db, email, STATUS_DEACTIVATED if action == "deactivate" else STATUS_ACTIVE)
            print("%s is now %s." % (person.email, person.status))
        return 0
    except RuleError as err:
        print(err.message)
        return 1
    finally:
        db.close()


def list_people() -> int:
    db = SessionLocal()
    try:
        for role, model in (("teacher", Teacher), ("student", Student)):
            for p in db.query(model).order_by(model.email):
                print("%-8s %-12s %-40s %s" % (role, p.status, p.email, p.name))
    finally:
        db.close()
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.invite", description="Invite people and manage their accounts.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("csv", nargs="?", help="CSV file of people to invite")
    group.add_argument("--resend", metavar="EMAIL")
    group.add_argument("--deactivate", metavar="EMAIL")
    group.add_argument("--reactivate", metavar="EMAIL")
    group.add_argument("--list", action="store_true")
    args = parser.parse_args(argv)

    Base.metadata.create_all(engine)  # a brand-new local database; deployed ones are migrated with alembic
    if args.list:
        return list_people()
    if args.resend:
        return one("resend", args.resend)
    if args.deactivate:
        return one("deactivate", args.deactivate)
    if args.reactivate:
        return one("reactivate", args.reactivate)
    return invite_file(args.csv)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    sys.exit(main())
