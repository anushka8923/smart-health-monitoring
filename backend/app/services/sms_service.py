import os
import logging
from typing import List, Union, Dict, Any
import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("sms_service")
logging.basicConfig(level=logging.INFO)

FAST2SMS_URL = "https://www.fast2sms.com/dev/bulkV2"


def clean_fast2sms_phone_number(phone: str) -> str:
    """
    Cleans and extracts standard 10-digit Indian phone numbers required by Fast2SMS.
    Strips '+91', leading '0', spaces, and non-digit characters.
    """
    cleaned = "".join(filter(str.isdigit, phone.strip()))
    if cleaned.startswith("91") and len(cleaned) == 12:
        cleaned = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        cleaned = cleaned[1:]
    return cleaned


def resolve_village_alert_recipients(
    db: Any,
    village_id: int,
    target_role: Optional[str] = None
) -> Dict[str, List[str]]:
    """
    Dynamically queries the database for assigned ASHA and/or PHC worker phone numbers 
    and emails for a given village_id to target in EWS alerts.
    
    :param target_role: Optional role filter ('ASHA' or 'PHC'). If specified, returns only contacts 
                        matching that specific role for the village.
    """
    from app.models import Village, User

    village = db.query(Village).filter(Village.id == village_id).first()
    assigned_users_query = db.query(User).filter(User.assigned_villages.any(Village.id == village_id))

    target_role_upper = target_role.strip().upper() if target_role else None

    if target_role_upper:
        assigned_users = assigned_users_query.filter(User.role.ilike(target_role_upper)).all()
    else:
        assigned_users = assigned_users_query.all()

    phones = []
    emails = []

    # Collect from assigned User database records
    for user in assigned_users:
        if user.phone_number and user.phone_number not in phones:
            phones.append(user.phone_number)
        if user.email and user.email not in emails:
            emails.append(user.email)

    # Collect from Village model fallback columns based on role specification
    if village:
        if target_role_upper == "ASHA":
            if village.asha_worker_phone and village.asha_worker_phone not in phones:
                phones.append(village.asha_worker_phone)
            if village.asha_worker_email and village.asha_worker_email not in emails:
                emails.append(village.asha_worker_email)
        elif target_role_upper == "PHC":
            if village.phc_officer_phone and village.phc_officer_phone not in phones:
                phones.append(village.phc_officer_phone)
            if village.phc_officer_email and village.phc_officer_email not in emails:
                emails.append(village.phc_officer_email)
        else:
            if village.asha_worker_phone and village.asha_worker_phone not in phones:
                phones.append(village.asha_worker_phone)
            if village.phc_officer_phone and village.phc_officer_phone not in phones:
                phones.append(village.phc_officer_phone)
            if village.contact_number and village.contact_number not in phones:
                phones.append(village.contact_number)
            if village.asha_worker_email and village.asha_worker_email not in emails:
                emails.append(village.asha_worker_email)
            if village.phc_officer_email and village.phc_officer_email not in emails:
                emails.append(village.phc_officer_email)

    sender_email = (os.getenv("SMTP_EMAIL") or os.getenv("SMTP_SENDER_EMAIL") or "").strip().lower()
    emails = [
        e for e in emails 
        if e and e.strip() 
        and e.strip().lower() != sender_email 
        and not e.strip().lower().endswith("@noemail.local")
    ]

    return {
        "phones": phones,
        "emails": emails
    }


def send_fast2sms_sms(
    to_phones: Union[List[str], str],
    message_body: str
) -> Dict[str, Any]:
    """
    Sends SMS messages via Fast2SMS Bulk SMS V2 API endpoint.
    
    URL: https://www.fast2sms.com/dev/bulkV2
    Headers: {"authorization": FAST2SMS_API_KEY, "Content-Type": "application/json"}
    Payload: {"route": "q", "message": message_body, "language": "english", "numbers": numbers_comma_separated}
    """
    api_key = os.getenv("FAST2SMS_API_KEY")

    if isinstance(to_phones, str):
        to_phones = [to_phones]

    cleaned_numbers = [
        clean_fast2sms_phone_number(num) for num in to_phones if num.strip()
    ]
    valid_numbers = [num for num in cleaned_numbers if len(num) == 10]

    if not valid_numbers:
        logger.warning("[Fast2SMS] No valid 10-digit phone numbers provided.")
        return {"status": "skipped", "reason": "No valid 10-digit recipient phone numbers"}

    numbers_str = ",".join(valid_numbers)

    if not api_key or api_key == "your_fast2sms_api_key":
        logger.warning(
            f"[Fast2SMS SIMULATION] FAST2SMS_API_KEY missing or placeholder. Simulated SMS to {numbers_str}: '{message_body}'"
        )
        return {
            "status": "simulated",
            "recipients": numbers_str,
            "message": message_body
        }

    headers = {
        "authorization": api_key,
        "Content-Type": "application/json"
    }

    payload = {
        "route": "q",
        "message": message_body,
        "language": "english",
        "flash": 0,
        "numbers": numbers_str
    }

    try:
        response = requests.post(FAST2SMS_URL, json=payload, headers=headers, timeout=10)
        data = response.json()

        if response.status_code == 200 and data.get("return") is True:
            logger.info(f"[Fast2SMS] SMS sent successfully to {numbers_str}. Response: {data}")
            return {
                "status": "completed",
                "recipients": numbers_str,
                "fast2sms_response": data
            }
        else:
            logger.error(f"[Fast2SMS] Failed to send SMS to {numbers_str}. Response: {data}")
            return {
                "status": "failed",
                "recipients": numbers_str,
                "error": data.get("message", "Fast2SMS API returned failure response"),
                "fast2sms_response": data
            }
    except requests.RequestException as e:
        logger.error(f"[Fast2SMS] HTTP Exception while contacting Fast2SMS API: {e}")
        return {"status": "failed", "error": str(e)}
