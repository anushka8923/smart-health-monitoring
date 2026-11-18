import os
import logging
from typing import List, Union, Optional, Dict, Any
from app.services.sms_service import send_fast2sms_sms
from app.services.email_service import send_email_smtp, send_email_batch, build_ews_alert_email_template


def trigger_batch_ews_alerts(alert_items: List[Dict[str, Any]]) -> bool:
    """
    Batched multi-channel EWS alert dispatcher.
    - Dispatches SMS messages for each village.
    - Collects all HTML/text email templates across all triggered villages and sends them over a
      SINGLE reused SMTP connection via send_email_batch, eliminating sequential connection overhead.
    """
    if not alert_items:
        return True

    logger.info(f"[EWS BATCH TRIGGER] Processing {len(alert_items)} alert item(s) in unified batch dispatcher...")

    email_messages_batch = []

    for item in alert_items:
        village = item.get("village")
        risk_level = item.get("risk_level", "Medium")
        disease_outbreak = item.get("disease_outbreak", "Vector-Borne Outbreak Risk")
        metrics = item.get("metrics", {})
        recipients_phone = item.get("recipients_phone", [])
        recipients_email = item.get("recipients_email", [])
        village_name = item.get("village_name")

        if hasattr(village, "name"):
            v_name = village.name
            v_district = getattr(village, "district", "N/A") or "N/A"
            v_state = getattr(village, "state", "N/A") or "N/A"
        else:
            v_name = str(village) if village else (village_name or "Unknown Location")
            v_district = "N/A"
            v_state = "N/A"

        # 1. SMS Dispatch
        if recipients_phone:
            alert_msg_sms = (
                f"🚨 EWS {risk_level.upper()} RISK ALERT 🚨\n"
                f"Location: {v_name}, {v_district}, {v_state}\n"
                f"Suspected Outbreak: {disease_outbreak}\n"
                f"Triggers: Temp: {metrics.get('temperature')}°C | Hum: {metrics.get('humidity')}% | Rain: {metrics.get('rainfall')}mm\n"
                f"Action Required: Please be aware and initiate preventive health protocols immediately. Dispatch PHC response teams if necessary."
            )
            logger.info(f"[EWS BATCH SMS] Sending Fast2SMS SMS to {len(recipients_phone)} contacts for {v_name}...")
            send_fast2sms_sms(recipients_phone, alert_msg_sms)

        # 2. Email Preparation
        if recipients_email:
            email_data = build_ews_alert_email_template(
                village_name=v_name,
                district=v_district,
                state=v_state,
                risk_level=risk_level,
                disease_outbreak=disease_outbreak,
                metrics=metrics
            )
            email_messages_batch.append({
                "to_emails": recipients_email,
                "subject": email_data["subject"],
                "text_content": email_data["text_content"],
                "html_content": email_data["html_content"]
            })

    # Dispatch all collected email messages in ONE reused SMTP connection
    if email_messages_batch:
        logger.info(f"[EWS BATCH EMAIL] Sending {len(email_messages_batch)} email message(s) over single reused SMTP connection...")
        send_email_batch(email_messages_batch)

    logger.info(f"[EWS BATCH COMPLETE] All {len(alert_items)} batch alert item(s) processed successfully.")
    return True

logger = logging.getLogger("ews_alert_manager")
logging.basicConfig(level=logging.INFO)


# ==============================================================================
# UNIFIED MULTI-CHANNEL DISPATCHER
# ==============================================================================
def trigger_triple_channel_ews_alert(
    village: Any = None,
    risk_level: str = "Medium",
    disease_outbreak: str = "Unknown Outbreak",
    metrics: dict = {},
    recipients_phone: list = [],
    recipients_email: list = [],
    village_name: Optional[str] = None
):
    """
    Unified multi-channel EWS alert dispatcher.
    - Sends short plain-text SMS messages to registered phone numbers via Fast2SMS.
    - Sends rich HTML + plain-text fallback emails to registered PHC & ASHA email addresses via SMTP.
    """
    if hasattr(village, "name"):
        v_name = village.name
        v_district = getattr(village, "district", "N/A") or "N/A"
        v_state = getattr(village, "state", "N/A") or "N/A"
    else:
        v_name = str(village) if village else (village_name or "Unknown Location")
        v_district = "N/A"
        v_state = "N/A"

    logger.info(f"[EWS TRIGGER] Executing Multi-Channel Alerts for Location: {v_name} (Risk: {risk_level})")

    # 1. SMS CHANNEL ALERT MESSAGE (Plain text, optimized for SMS character limits)
    alert_msg_sms = (
        f"🚨 EWS {risk_level.upper()} RISK ALERT 🚨\n"
        f"Location: {v_name}, {v_district}, {v_state}\n"
        f"Suspected Outbreak: {disease_outbreak}\n"
        f"Triggers: Temp: {metrics.get('temperature')}°C | Hum: {metrics.get('humidity')}% | Rain: {metrics.get('rainfall')}mm\n"
        f"Action Required: Please be aware and initiate preventive health protocols immediately. Dispatch PHC response teams if necessary."
    )

    # Dispatch SMS channel
    if recipients_phone:
        logger.info(f"[EWS DISPATCH] Sending Fast2SMS SMS to {len(recipients_phone)} contacts...")
        send_fast2sms_sms(recipients_phone, alert_msg_sms)

    # 2. EMAIL CHANNEL ALERT MESSAGE (Rich HTML + plain text fallback template)
    if recipients_email:
        logger.info(f"[EWS DISPATCH] Sending Email alert to {len(recipients_email)} addresses...")
        email_data = build_ews_alert_email_template(
            village_name=v_name,
            district=v_district,
            state=v_state,
            risk_level=risk_level,
            disease_outbreak=disease_outbreak,
            metrics=metrics
        )
        send_email_smtp(
            to_emails=recipients_email,
            subject=email_data["subject"],
            text_content=email_data["text_content"],
            html_content=email_data["html_content"]
        )

    logger.info(f"[EWS COMPLETE] All background alert notifications processed for Location: {v_name}.")