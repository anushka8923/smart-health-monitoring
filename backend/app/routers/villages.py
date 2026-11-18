import os
import logging
from typing import List
from fastapi import APIRouter, Depends, status, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.models import Village, SensorData, User
from app.schemas import VillageOnboard, LiveMapVillage, VillageResponse, AshaAssignedPlaceItem, SensorDataResponse
from app.routers.auth import get_current_user

logger = logging.getLogger("villages_router")


def safe_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


router = APIRouter(prefix="/api/villages", tags=["Villages"])


def _format_phone(phone: str) -> str:
    if not phone:
        return ""
    phone = phone.strip()
    if not phone.startswith("+"):
        if phone.startswith("91") and len(phone) == 12:
            phone = f"+{phone}"
        else:
            phone = f"+91{phone.lstrip('0')}"
    return phone


def _create_or_update_user(db: Session, name: str, phone: str, email: str, role: str, village_id: int):
    # Standardize role format ('Admin', 'PHC', 'ASHA')
    if role:
        role_upper = role.strip().upper()
        if role_upper == "ASHA":
            role = "ASHA"
        elif role_upper == "PHC":
            role = "PHC"
        elif role_upper == "ADMIN":
            role = "Admin"

    user = None
    if email and email.strip():
        email_clean = email.lower().strip()
        user = db.query(User).filter(User.email == email_clean).first()
    if not user and phone:
        user = db.query(User).filter(User.phone_number == phone).first()

    village_obj = db.query(Village).filter(Village.id == village_id).first()
    if user:
        user.assigned_village_id = village_id
        if village_obj and village_obj not in user.assigned_villages:
            user.assigned_villages.append(village_obj)
        if name:
            user.name = name
        if phone:
            user.phone_number = phone
        if email and email.strip():
            user.email = email.lower().strip()
        user.role = role
    else:
        # Use provided email or generate non-routable local handle
        user_email = email.lower().strip() if (email and email.strip()) else f"{role.lower()}_v{village_id}_{os.urandom(4).hex()}@noemail.local"
        user = User(
            name=name or f"{role.upper()} Officer",
            email=user_email,
            password_hash="pbkdf2:sha256:default_hash_for_onboarded_user",
            role=role,
            phone_number=phone or None,
            assigned_village_id=village_id
        )
        if village_obj:
            user.assigned_villages.append(village_obj)
        db.add(user)
    return user


@router.post("/onboard", response_model=VillageResponse, status_code=status.HTTP_201_CREATED)
def onboard_village(
    village_data: VillageOnboard,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    contact = _format_phone(village_data.contact_number)
    asha_phone = _format_phone(village_data.asha_worker_phone)
    phc_phone = _format_phone(village_data.phc_officer_phone)

    new_village = Village(
        name=village_data.name,
        state=village_data.state or "N/A",
        district=village_data.district or "N/A",
        latitude=village_data.latitude,
        longitude=village_data.longitude,
        contact_number=contact or asha_phone or phc_phone,
        asha_worker_name=village_data.asha_worker_name,
        asha_worker_phone=asha_phone,
        asha_worker_email=village_data.asha_worker_email,
        phc_officer_name=village_data.phc_officer_name,
        phc_officer_phone=phc_phone,
        phc_officer_email=village_data.phc_officer_email
    )
    db.add(new_village)
    db.flush()  # Assigns new_village.id without committing transaction

    # Automatically create or link User records for ASHA worker and PHC Medical Officer
    if village_data.asha_worker_name or asha_phone or village_data.asha_worker_email:
        _create_or_update_user(
            db=db,
            name=village_data.asha_worker_name or f"ASHA Worker ({new_village.name})",
            phone=asha_phone,
            email=village_data.asha_worker_email,
            role="ASHA",
            village_id=new_village.id
        )

    if village_data.phc_officer_name or phc_phone or village_data.phc_officer_email:
        _create_or_update_user(
            db=db,
            name=village_data.phc_officer_name or f"PHC Medical Officer ({new_village.name})",
            phone=phc_phone,
            email=village_data.phc_officer_email,
            role="PHC",
            village_id=new_village.id
        )

    # Single atomic database commit for entire onboarding operation
    db.commit()
    db.refresh(new_village)

    # DISABLED per user request: onboarding should not trigger emails
    # background_tasks.add_task(_dispatch_onboarding_welcome_emails, village_id=new_village.id)

    return new_village


def _dispatch_onboarding_welcome_emails(village_id: int):
    """
    Background task sending welcome / assignment emails to PHC and ASHA officers for a newly onboarded village.
    """
    from app.database import SessionLocal
    from app.services.sms_service import resolve_village_alert_recipients
    from app.services.email_service import send_email_batch

    db = SessionLocal()
    try:
        village = db.query(Village).filter(Village.id == village_id).first()
        if not village:
            logger.warning(f"[Onboarding Email] Village #{village_id} not found for welcome email dispatch.")
            db.close()
            return

        phc_recipients = resolve_village_alert_recipients(db, village_id, target_role="PHC")["emails"]
        asha_recipients = resolve_village_alert_recipients(db, village_id, target_role="ASHA")["emails"]

        email_messages = []

        if phc_recipients:
            subject = f"🏥 Smart Health EWS - Assigned as PHC Officer for {village.name}"
            text_body = (
                f"Hello,\n\n"
                f"You have been officially assigned as the PHC Medical Officer for {village.name}.\n\n"
                f"Location Details:\n"
                f" - Village: {village.name}\n"
                f" - District: {village.district or 'N/A'}\n"
                f" - State: {village.state or 'N/A'}\n\n"
                f"You can now access live surveillance telemetry, vector outbreak alerts, and team dispatch tools for {village.name} from your PHC Dashboard.\n\n"
                f"Regards,\nSmart Health EWS Administrative Team"
            )
            html_body = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 24px; border: 1px solid #e2e8f0;">
                    <h2 style="color: #2563eb; margin-top: 0;">🏥 Welcome to Smart Health EWS</h2>
                    <p style="font-size: 15px; color: #334155;">You have been assigned as the <strong>PHC Medical Officer</strong> for <strong>{village.name}</strong>.</p>
                    <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0;">
                        <p style="margin: 0; font-size: 14px; color: #1e40af;"><strong>District:</strong> {village.district or 'N/A'} | <strong>State:</strong> {village.state or 'N/A'}</p>
                    </div>
                    <p style="font-size: 14px; color: #475569;">You can now monitor live telemetry and manage emergency dispatches for this location via your dashboard.</p>
                </div>
            </div>
            """
            email_messages.append({
                "to_emails": phc_recipients,
                "subject": subject,
                "text_content": text_body,
                "html_content": html_body
            })
        else:
            logger.info(f"[Onboarding Email] No PHC Officer email assigned for village #{village_id} ({village.name}). Skipping PHC email.")

        if asha_recipients:
            subject = f"🩺 Smart Health EWS - Assigned as ASHA Worker for {village.name}"
            text_body = (
                f"Hello,\n\n"
                f"You have been officially assigned as the ASHA Worker for {village.name}.\n\n"
                f"Location Details:\n"
                f" - Village: {village.name}\n"
                f" - District: {village.district or 'N/A'}\n"
                f" - State: {village.state or 'N/A'}\n\n"
                f"You can now log community health telemetry, view risk alerts, and escalate emergencies for {village.name} from your ASHA Dashboard.\n\n"
                f"Regards,\nSmart Health EWS Administrative Team"
            )
            html_body = f"""
            <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc;">
                <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 24px; border: 1px solid #e2e8f0;">
                    <h2 style="color: #059669; margin-top: 0;">🩺 Welcome to Smart Health EWS</h2>
                    <p style="font-size: 15px; color: #334155;">You have been assigned as the <strong>ASHA Worker</strong> for <strong>{village.name}</strong>.</p>
                    <div style="background-color: #ecfdf5; border-left: 4px solid #059669; padding: 12px 16px; margin: 16px 0;">
                        <p style="margin: 0; font-size: 14px; color: #065f46;"><strong>District:</strong> {village.district or 'N/A'} | <strong>State:</strong> {village.state or 'N/A'}</p>
                    </div>
                    <p style="font-size: 14px; color: #475569;">You can now log community health data and escalate risk alerts for this place via your dashboard.</p>
                </div>
            </div>
            """
            email_messages.append({
                "to_emails": asha_recipients,
                "subject": subject,
                "text_content": text_body,
                "html_content": html_body
            })
        else:
            logger.info(f"[Onboarding Email] No ASHA Worker email assigned for village #{village_id} ({village.name}). Skipping ASHA email.")

        if email_messages:
            send_email_batch(email_messages)
    except Exception as exc:
        logger.error(f"[Onboarding Email ERROR] Failed to dispatch onboarding emails for village #{village_id}: {exc}", exc_info=True)
    finally:
        db.close()


@router.get("/live-map", response_model=List[LiveMapVillage])
def get_live_map(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    High-Performance Live Map Endpoint with Strict RBAC.
    - Admin: fetches all villages across the system.
    - ASHA / PHC: strictly filtered by current_user.assigned_village_id. Returns [] if unassigned.
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

        # Subquery fetching the latest timestamped sensor reading per village using PostgreSQL DISTINCT ON
        latest_sensor_sub = (
            db.query(SensorData)
            .distinct(SensorData.village_id)
            .order_by(SensorData.village_id, SensorData.timestamp.desc())
            .subquery()
        )

        query = (
            db.query(
                Village.id,
                Village.name,
                Village.state,
                Village.district,
                Village.latitude,
                Village.longitude,
                Village.asha_worker_name,
                Village.asha_worker_phone,
                Village.phc_officer_name,
                Village.phc_officer_phone,
                latest_sensor_sub.c.risk_score,
                latest_sensor_sub.c.temperature,
                latest_sensor_sub.c.humidity,
                latest_sensor_sub.c.rainfall
            )
            .outerjoin(latest_sensor_sub, Village.id == latest_sensor_sub.c.village_id)
        )

        if village_filter is not None:
            query = query.filter(village_filter)

        rows = query.all()

        return [
            {
                "id": row.id,
                "name": row.name,
                "state": row.state or "N/A",
                "district": row.district or "N/A",
                "lat": safe_float(row.latitude),
                "lng": safe_float(row.longitude),
                "risk_score": row.risk_score or "Pending",
                "temperature": safe_float(row.temperature),
                "humidity": safe_float(row.humidity),
                "rainfall": safe_float(row.rainfall),
                "asha_worker_name": row.asha_worker_name,
                "asha_worker_phone": row.asha_worker_phone,
                "phc_officer_name": row.phc_officer_name,
                "phc_officer_phone": row.phc_officer_phone
            }
            for row in rows
        ]
    except Exception as exc:
        logger.error(f"Error fetching live-map villages: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch live-map data: {str(exc)}"
        )


@router.get("/asha/assigned-places", response_model=List[AshaAssignedPlaceItem])
def get_asha_assigned_places(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    ASHA Multi-Place Jurisdiction & Telemetry History Endpoint.
    Retrieves all assigned locations for the authenticated ASHA user (or all system villages for Admins),
    complete with real-time recalculated environmental metrics, risk score, and telemetry history.
    """
    try:
        role = (current_user.role or "").strip().lower()

        if role == "admin":
            villages = db.query(Village).order_by(Village.name.asc()).all()
        else:
            assigned_ids = [v.id for v in current_user.assigned_villages]
            if not assigned_ids:
                return []
            villages = db.query(Village).filter(Village.id.in_(assigned_ids)).order_by(Village.name.asc()).all()

        result = []
        for v in villages:
            history = (
                db.query(SensorData)
                .filter(SensorData.village_id == v.id)
                .order_by(SensorData.timestamp.desc())
                .limit(30)
                .all()
            )

            latest = history[0] if history else None

            result.append({
                "village_id": v.id,
                "village_name": v.name,
                "state": v.state or "N/A",
                "district": v.district or "N/A",
                "latitude": safe_float(v.latitude),
                "longitude": safe_float(v.longitude),
                "contact_number": v.contact_number,
                "asha_worker_name": v.asha_worker_name,
                "asha_worker_phone": v.asha_worker_phone,
                "phc_officer_name": v.phc_officer_name,
                "phc_officer_phone": v.phc_officer_phone,
                "last_updated": latest.timestamp if latest else None,
                "risk_score": latest.risk_score if (latest and latest.risk_score) else "Normal",
                "temperature": safe_float(latest.temperature) if latest else 0.0,
                "humidity": safe_float(latest.humidity) if latest else 0.0,
                "rainfall": safe_float(latest.rainfall) if latest else 0.0,
                "historical_records": [SensorDataResponse.model_validate(h) for h in history]
            })

        return result
    except Exception as exc:
        logger.error(f"Error fetching ASHA assigned places: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch ASHA assigned places: {str(exc)}"
        )




@router.delete("/{village_id}", status_code=status.HTTP_200_OK)
def delete_village(village_id: int, db: Session = Depends(get_db)):
    village = db.query(Village).filter(Village.id == village_id).first()
    if not village:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Village with ID {village_id} not found."
        )

    # Delete related sensor readings and unassign users
    db.query(SensorData).filter(SensorData.village_id == village_id).delete(synchronize_session=False)
    db.query(User).filter(User.assigned_village_id == village_id).update(
        {User.assigned_village_id: None}, synchronize_session=False
    )

    db.delete(village)
    db.commit()

    return {
        "status": "success",
        "message": f"Village '{village.name}' deleted successfully.",
        "village_id": village_id
    }

