from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Village, SensorData, User
from app.schemas import JurisdictionStatusItem, DispatchTeamRequest
from app.services.sms_service import send_fast2sms_sms
from app.routers.auth import get_current_user

import logging

logger = logging.getLogger("phc_router")


def safe_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


router = APIRouter(prefix="/api/phc", tags=["PHC Monitoring"])


@router.get("/jurisdiction-status", response_model=List[JurisdictionStatusItem])
def get_jurisdiction_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    High-Performance PHC Jurisdiction Status Endpoint with Strict RBAC.
    Executes a single SQL query joining Villages with partitioned window-function ranked latest SensorData.
    - Admin: fetches all villages across the system.
    - ASHA / PHC: filtered by user's assigned_villages.
    """
    try:
        role = (current_user.role or "").strip().lower()

        if role == "admin":
            village_filter = None
        else:
            assigned_ids = [v.id for v in current_user.assigned_villages]
            if not assigned_ids:
                return []
            village_filter = Village.id.in_(assigned_ids)

        # Partitioned window function ranking latest sensor data per village
        window_stmt = (
            db.query(
                SensorData.id.label("sensor_id"),
                SensorData.village_id.label("village_id"),
                SensorData.timestamp.label("timestamp"),
                SensorData.temperature.label("temperature"),
                SensorData.humidity.label("humidity"),
                SensorData.rainfall.label("rainfall"),
                SensorData.risk_score.label("risk_score"),
                func.row_number().over(
                    partition_by=SensorData.village_id,
                    order_by=SensorData.timestamp.desc()
                ).label("rn")
            ).subquery()
        )

        latest_sensor_sub = (
            db.query(window_stmt)
            .filter(window_stmt.c.rn == 1)
            .subquery()
        )

        query = (
            db.query(
                Village.id.label("village_id"),
                Village.name.label("village_name"),
                Village.state,
                Village.district,
                Village.latitude,
                Village.longitude,
                Village.asha_worker_name,
                Village.asha_worker_phone,
                Village.phc_officer_name,
                Village.phc_officer_phone,
                latest_sensor_sub.c.timestamp.label("last_updated"),
                latest_sensor_sub.c.risk_score,
                latest_sensor_sub.c.temperature,
                latest_sensor_sub.c.humidity,
                latest_sensor_sub.c.rainfall
            )
            .outerjoin(latest_sensor_sub, Village.id == latest_sensor_sub.c.village_id)
        )

        if village_filter is not None:
            query = query.filter(village_filter)

        rows = query.order_by(Village.name.asc()).all()

        return [
            {
                "village_id": row.village_id,
                "village_name": row.village_name,
                "state": row.state or "N/A",
                "district": row.district or "N/A",
                "latitude": safe_float(row.latitude),
                "longitude": safe_float(row.longitude),
                "asha_worker_name": row.asha_worker_name,
                "asha_worker_phone": row.asha_worker_phone,
                "phc_officer_name": row.phc_officer_name,
                "phc_officer_phone": row.phc_officer_phone,
                "last_updated": row.last_updated,
                "risk_score": row.risk_score or "Pending",
                "temperature": safe_float(row.temperature),
                "humidity": safe_float(row.humidity),
                "rainfall": safe_float(row.rainfall)
            }
            for row in rows
        ]
    except Exception as exc:
        logger.error(f"Error executing PHC jurisdiction status query: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch PHC jurisdiction status: {str(exc)}"
        )


@router.post("/dispatch-team", status_code=status.HTTP_200_OK)
def dispatch_medical_team(
    payload: DispatchTeamRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Emergency Dispatch Endpoint for PHC Medical Officers.
    Resolves assigned ASHA worker contact (phone & email) for the target village,
    and dispatches paired SMS and HTML email alerts asynchronously.
    """
    from app.alert_manager import trigger_triple_channel_ews_alert
    from app.services.sms_service import resolve_village_alert_recipients

    village = db.query(Village).filter(Village.id == payload.village_id).first()
    if not village:
        raise HTTPException(
            status_code=404,
            detail=f"Village with ID {payload.village_id} not found."
        )

    # Resolve contacts targeted ONLY to ASHA Worker role
    resolved = resolve_village_alert_recipients(db, village.id, target_role="ASHA")
    recipients_phone = resolved.get("phones", [])
    recipients_email = resolved.get("emails", [])

    if not (recipients_phone or recipients_email):
        raise HTTPException(
            status_code=400,
            detail=f"No valid ASHA worker contact details found for village {village.name}."
        )

    outbreak_text = "Emergency Medical Response Team Dispatched"
    if payload.custom_message:
        outbreak_text += f" ({payload.custom_message.strip()})"

    # Queue paired SMS + Email notification delivery to background tasks
    background_tasks.add_task(
        trigger_triple_channel_ews_alert,
        village=village,
        risk_level="Critical",
        disease_outbreak=outbreak_text,
        metrics={"temperature": 0.0, "humidity": 0.0, "rainfall": 0.0},
        recipients_phone=recipients_phone,
        recipients_email=recipients_email
    )

    return {
        "status": "success",
        "message": f"Medical response team dispatched to {village.name}. ASHA worker notified via paired SMS & Email.",
        "target_village": village.name,
        "recipients_phone": recipients_phone,
        "recipients_email": recipients_email
    }
