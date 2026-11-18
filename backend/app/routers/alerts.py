from fastapi import APIRouter, Depends, BackgroundTasks, status, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Village, User
from app.schemas import EWSAlertRequest
from app.alert_manager import trigger_triple_channel_ews_alert
from app.services.sms_service import resolve_village_alert_recipients
from app.routers.auth import get_current_user

import logging
logger = logging.getLogger("alerts_router")

router = APIRouter(prefix="/api/alerts", tags=["Notifications & Alerts"])


@router.post("/trigger-ews-alert", status_code=status.HTTP_202_ACCEPTED)
def trigger_ews_alert(
    payload: EWSAlertRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Triggers paired SMS and Email alerts targeted to a specific role (default: PHC Officer).
    Used by field workers to escalate critical outbreaks to response officers.
    """
    village = None
    if payload.village_id:
        village = db.query(Village).filter(Village.id == payload.village_id).first()
    elif payload.village_name:
        village = db.query(Village).filter(Village.name.ilike(payload.village_name.strip())).first()

    target_role = payload.target_role or "PHC"
    recipients_phone = payload.phone_numbers or []
    recipients_email = payload.email_addresses or []

    if not (recipients_phone or recipients_email) and village:
        resolved = resolve_village_alert_recipients(db, village.id, target_role=target_role)
        recipients_phone = resolved.get("phones", [])
        recipients_email = resolved.get("emails", [])

    if not (recipients_phone or recipients_email):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No {target_role} assigned to this village."
        )

    village_name_display = village.name if village else (payload.village_name or "Unknown Village")
    metrics = {
        "temperature": payload.temperature,
        "humidity": payload.humidity,
        "rainfall": payload.rainfall
    }

    background_tasks.add_task(
        trigger_triple_channel_ews_alert,
        village=village,
        risk_level=payload.risk_level,
        disease_outbreak=payload.disease_outbreak or "Vector-Borne Disease Alert",
        metrics=metrics,
        recipients_phone=recipients_phone,
        recipients_email=recipients_email,
        village_name=village_name_display
    )

    return {
        "status": "queued",
        "message": f"EWS alert for '{village_name_display}' targeting '{target_role}' queued successfully.",
        "target_role": target_role,
        "channels": {
            "sms_recipients": len(recipients_phone),
            "email_recipients": len(recipients_email)
        }
    }


@router.post("/notify-phc", status_code=status.HTTP_202_ACCEPTED)
def notify_phc_officer(
    payload: EWSAlertRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    FLOW 3: Dedicated endpoint for ASHA workers to send alerts to the PHC Officer for their assigned village.
    """
    role = (current_user.role or "").strip().lower()
    if role not in ["asha", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ASHA Workers can trigger alerts to PHC Officers."
        )

    if not payload.village_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="village_id is required."
        )

    assigned_ids = [v.id for v in current_user.assigned_villages]
    if role != "admin" and payload.village_id not in assigned_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are not assigned to village #{payload.village_id}."
        )

    village = db.query(Village).filter(Village.id == payload.village_id).first()
    if not village:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Village #{payload.village_id} not found."
        )

    resolved = resolve_village_alert_recipients(db, village.id, target_role="PHC")
    recipients_phone = resolved.get("phones", [])
    recipients_email = resolved.get("emails", [])

    if not (recipients_phone or recipients_email):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No PHC officer assigned to this village."
        )

    metrics = {
        "temperature": payload.temperature,
        "humidity": payload.humidity,
        "rainfall": payload.rainfall
    }

    background_tasks.add_task(
        trigger_triple_channel_ews_alert,
        village=village,
        risk_level=payload.risk_level or "High",
        disease_outbreak=payload.disease_outbreak or "ASHA Escalate to PHC Alert",
        metrics=metrics,
        recipients_phone=recipients_phone,
        recipients_email=recipients_email,
        village_name=village.name
    )

    return {
        "status": "success",
        "message": f"Alert to PHC Officer for village '{village.name}' queued successfully.",
        "village_id": village.id,
        "target_role": "PHC",
        "channels": {
            "sms_recipients": len(recipients_phone),
            "email_recipients": len(recipients_email)
        }
    }


@router.post("/notify-asha", status_code=status.HTTP_202_ACCEPTED)
def notify_asha_worker(
    payload: EWSAlertRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    FLOW 2: Dedicated endpoint for PHC Officers to send alerts to the ASHA Worker for their assigned village.
    """
    role = (current_user.role or "").strip().lower()
    if role not in ["phc", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only PHC Officers can trigger alerts to ASHA Workers."
        )

    if not payload.village_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="village_id is required."
        )

    assigned_ids = [v.id for v in current_user.assigned_villages]
    if role != "admin" and payload.village_id not in assigned_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You are not assigned to village #{payload.village_id}."
        )

    village = db.query(Village).filter(Village.id == payload.village_id).first()
    if not village:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Village #{payload.village_id} not found."
        )

    resolved = resolve_village_alert_recipients(db, village.id, target_role="ASHA")
    recipients_phone = resolved.get("phones", [])
    recipients_email = resolved.get("emails", [])

    if not (recipients_phone or recipients_email):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No ASHA worker assigned to this village."
        )

    metrics = {
        "temperature": payload.temperature,
        "humidity": payload.humidity,
        "rainfall": payload.rainfall
    }

    background_tasks.add_task(
        trigger_triple_channel_ews_alert,
        village=village,
        risk_level=payload.risk_level or "High",
        disease_outbreak=payload.disease_outbreak or "PHC Dispatch to ASHA Alert",
        metrics=metrics,
        recipients_phone=recipients_phone,
        recipients_email=recipients_email,
        village_name=village.name
    )

    return {
        "status": "success",
        "message": f"Alert to ASHA Worker for village '{village.name}' queued successfully.",
        "village_id": village.id,
        "target_role": "ASHA",
        "channels": {
            "sms_recipients": len(recipients_phone),
            "email_recipients": len(recipients_email)
        }
    }
