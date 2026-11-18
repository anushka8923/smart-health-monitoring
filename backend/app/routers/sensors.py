import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Village, SensorData, User
from app.services import fetch_live_weather
from app.ml_engine import calculate_risk_score
from app.schemas import SensorDataResponse, SensorDataCreate
from app.alert_manager import trigger_triple_channel_ews_alert, trigger_batch_ews_alerts
from app.services.sms_service import resolve_village_alert_recipients

import httpx

router = APIRouter(prefix="/api/sensors", tags=["Sensors"])


async def _safe_fetch_weather(village: Village, client: httpx.AsyncClient = None):
    """
    Safely fetch weather for a single village using a shared HTTP client connection pool.
    """
    try:
        weather = await fetch_live_weather(village.latitude, village.longitude, client=client)
        return village, weather, None
    except Exception as exc:
        return village, {"temperature": 0.0, "humidity": 0.0, "rainfall": 0.0}, exc


@router.post("/sync")
async def sync_sensor_data(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    High-Performance Data Synchronization Endpoint.
    Executes parallel concurrent weather API calls via a shared httpx connection pool,
    pre-fetches all recipient contact mappings in a single batch SQL query, calculates ML risk scores,
    and performs bulk DB inserts.
    """
    villages = db.query(Village).all()
    if not villages:
        return {"message": "No villages found to sync", "villages_updated": 0}

    # Shared HTTP connection pool session across all village requests
    async with httpx.AsyncClient() as client:
        weather_results = await asyncio.gather(
            *[_safe_fetch_weather(v, client=client) for v in villages],
            return_exceptions=True
        )

    # Pre-fetch recipient contacts: SMS targets ASHA worker ONLY, Email targets BOTH ASHA & PHC officers
    recipients_by_village = {}
    for village in villages:
        asha_recipients = resolve_village_alert_recipients(db, village.id, target_role="ASHA")
        all_recipients = resolve_village_alert_recipients(db, village.id)
        recipients_by_village[village.id] = {
            "phones": asha_recipients["phones"],
            "emails": all_recipients["emails"]
        }

    sensor_records = []
    alert_items = []
    alerts_triggered = 0

    for result in weather_results:
        if isinstance(result, Exception):
            continue

        village, weather, error = result

        risk_score = calculate_risk_score(
            weather["temperature"],
            weather["humidity"],
            weather["rainfall"]
        )

        sensor_record = SensorData(
            village_id=village.id,
            temperature=weather["temperature"],
            humidity=weather["humidity"],
            rainfall=weather["rainfall"],
            risk_score=risk_score
        )
        sensor_records.append(sensor_record)

        if risk_score in ["High", "Critical"]:
            alerts_triggered += 1

            recipients = recipients_by_village.get(village.id, {"phones": [], "emails": []})
            recipients_phone = recipients["phones"]
            recipients_email = recipients["emails"]

            metrics = {
                "temperature": weather["temperature"],
                "humidity": weather["humidity"],
                "rainfall": weather["rainfall"]
            }

            alert_items.append({
                "village": village,
                "risk_level": risk_score,
                "disease_outbreak": "Vector-Borne Disease Outbreak Risk",
                "metrics": metrics,
                "recipients_phone": recipients_phone,
                "recipients_email": recipients_email
            })

    if alert_items:
        background_tasks.add_task(trigger_batch_ews_alerts, alert_items=alert_items)

    # Bulk insert all new sensor records in a single database transaction
    if sensor_records:
        db.add_all(sensor_records)
        db.commit()

    return {
        "message": "Sync successful",
        "villages_updated": len(sensor_records),
        "alerts_triggered": alerts_triggered
    }



@router.get("/village/{village_id}/latest", response_model=SensorDataResponse)
def get_latest_sensor_data(village_id: int, db: Session = Depends(get_db)):
    latest_data = (
        db.query(SensorData)
        .filter(SensorData.village_id == village_id)
        .order_by(SensorData.timestamp.desc())
        .first()
    )
    if not latest_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No sensor data found for village_id {village_id}"
        )
    return latest_data


@router.post("/ingest", response_model=SensorDataResponse, status_code=status.HTTP_201_CREATED)
def ingest_sensor_data(
    payload: SensorDataCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Direct Real-Time Ingestion Endpoint for IoT Environmental Hardware Sensors.
    Accepts telemetry (temperature, humidity, rainfall), computes EWS risk score via ML engine,
    persists record to PostgreSQL, and triggers Fast2SMS alerts if risk is High or Critical.
    """
    village = db.query(Village).filter(Village.id == payload.village_id).first()
    if not village:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Location with ID {payload.village_id} not found."
        )

    risk_score = payload.risk_score or calculate_risk_score(
        payload.temperature,
        payload.humidity,
        payload.rainfall
    )

    sensor_record = SensorData(
        village_id=payload.village_id,
        temperature=payload.temperature,
        humidity=payload.humidity,
        rainfall=payload.rainfall,
        risk_score=risk_score
    )
    db.add(sensor_record)
    db.commit()
    db.refresh(sensor_record)

    if risk_score in ["High", "Critical"]:
        asha_recipients = resolve_village_alert_recipients(db, village.id, target_role="ASHA")
        all_recipients = resolve_village_alert_recipients(db, village.id)
        recipients_phone = asha_recipients["phones"]
        recipients_email = all_recipients["emails"]

        metrics = {
            "temperature": payload.temperature,
            "humidity": payload.humidity,
            "rainfall": payload.rainfall
        }

        background_tasks.add_task(
            trigger_triple_channel_ews_alert,
            village=village,
            risk_level=risk_score,
            disease_outbreak="Real-time IoT Sensor Disease Risk Alert",
            metrics=metrics,
            recipients_phone=recipients_phone,
            recipients_email=recipients_email
        )

    return sensor_record

