"""Notifications — one inbox resource for both roles.

- GET /notifications?view=teacher: the signed-in teacher's inbox, newest first.
- GET /notifications?view=student: the signed-in student's inbox, newest first.
- POST /notifications/read-all?view=...: mark that inbox as read.
"""
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from ..deps import CurrentUser, check_view, current_user, get_db
from ..models import Notification
from .. import views

router = APIRouter(tags=["notifications"])


@router.get("/notifications")
def list_notifications(view: str = Query(pattern="^(teacher|student)$"),
                       db: Session = Depends(get_db),
                       me: CurrentUser = Depends(current_user)):
    check_view(view, me)
    q = db.query(Notification)
    q = q.filter(Notification.teacher_id == me.user.id) if view == "teacher" \
        else q.filter(Notification.student_id == me.user.id)
    rows = q.order_by(Notification.at.desc(), Notification.id.desc()).all()
    return [views.note_json(n) for n in rows]


@router.post("/notifications/read-all", status_code=204)
def mark_read(view: str = Query(pattern="^(teacher|student)$"),
              db: Session = Depends(get_db),
              me: CurrentUser = Depends(current_user)):
    check_view(view, me)
    q = db.query(Notification).filter(Notification.read.is_(False))
    if view == "teacher":
        q = q.filter(Notification.teacher_id == me.user.id)
    else:
        q = q.filter(Notification.student_id == me.user.id)
    q.update({"read": True})
    db.commit()
    return Response(status_code=204)
