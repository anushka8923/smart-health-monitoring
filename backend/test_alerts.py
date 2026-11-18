# ==============================================================================
# STANDALONE EWS MULTI-CHANNEL NOTIFICATION TEST HARNESS
# ==============================================================================
import os
import sys
from dotenv import load_dotenv

# Load environment variables from .env file in root workspace
load_dotenv()

# Add current workspace to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), ".")))

from app.services.sms_service import send_fast2sms_sms
from app.services.email_service import send_email_smtp
from app.alert_manager import trigger_triple_channel_ews_alert

if __name__ == "__main__":
    print("=" * 70)
    print("      SMART HEALTH EWS - STANDALONE NOTIFICATION TEST HARNESS       ")
    print("=" * 70)

    # Hardcoded test targets
    TEST_PHONE = os.getenv("TEST_ALERT_PHONE", "9876543210")
    TEST_EMAIL = os.getenv("TEST_ALERT_EMAIL", "officer@example.com")

    print("\n--- ENVIRONMENT DIAGNOSTICS ---")
    print(f"FAST2SMS_API_KEY   : {os.getenv('FAST2SMS_API_KEY', 'MISSING')[:8]}...")
    print(f"SMTP_SENDER_EMAIL  : {os.getenv('SMTP_SENDER_EMAIL', 'MISSING')}")

    print("\n--- 1. TESTING FAST2SMS ---")
    sms_res = send_fast2sms_sms(
        to_phones=[TEST_PHONE],
        message_body="[TEST] EWS Critical Dengue Warning for Village Rampur."
    )
    print(f"SMS Result: {sms_res}\n")

    print("--- 2. TESTING GMAIL SMTP EMAIL ---")
    email_res = send_email_smtp(
        to_emails=[TEST_EMAIL],
        subject="[TEST] EWS Alert Notification",
        html_content="<h2>EWS Alert Notification Test</h2><p>Critical Risk Warning in Rampur.</p>",
        text_content="EWS Alert Notification Test - Critical Risk Warning in Rampur."
    )
    print(f"Email Result: {email_res}\n")

    print("--- 3. TESTING UNIFIED DISPATCHER ---")
    trigger_triple_channel_ews_alert(
        village_name="Rampur",
        risk_level="Critical",
        disease_outbreak="Malaria/Dengue Vector Outbreak",
        metrics={"temperature": 34.0, "humidity": 89.0, "rainfall": 135.0},
        recipients_phone=[TEST_PHONE],
        recipients_email=[TEST_EMAIL]
    )

    print("\n" + "=" * 70)
    print("                     DIAGNOSTIC TEST COMPLETE                        ")
    print("=" * 70)

