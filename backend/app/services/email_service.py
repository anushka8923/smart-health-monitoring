import os
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from typing import List, Union, Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("email_service")
logging.basicConfig(level=logging.INFO)

# NOTE: Consumer Gmail SMTP (smtp.gmail.com) has volume-based rate limits and incoming anti-spam heuristic filters.
# Sending more than 10-15 emails in a 5-minute window from a personal Gmail account can cause delivery deferrals or spam classification.
# For high-volume production alerts, migrate to a transactional email provider (e.g. Resend, SendGrid, Postmark) with custom domain SPF/DKIM.

import time
from datetime import datetime


def send_email_batch(messages: List[Dict[str, Any]]) -> bool:
    """
    Sends a batch of email messages over a SINGLE, REUSED SMTP connection.
    Eliminates socket setup and TLS authentication overhead per message,
    dramatically reducing execution duration for multi-village alert syncs.
    """
    logger.info(f"[EMAIL DEBUG] Starting batch send of {len(messages) if messages else 0} message(s) at {datetime.utcnow()}")
    if not messages:
        return True

    if len(messages) > 5:
        logger.warning(
            f"[EmailService WARNING] Sending {len(messages)} alert emails in a single batch. "
            f"Gmail consumer SMTP has volume-based rate limits and may defer delivery."
        )

    smtp_host = os.getenv("SMTP_SERVER") or os.getenv("SMTP_HOST") or "smtp.gmail.com"
    try:
        smtp_port = int(os.getenv("SMTP_PORT", 587))
    except (ValueError, TypeError):
        smtp_port = 587

    sender_email = os.getenv("SMTP_EMAIL") or os.getenv("SMTP_SENDER_EMAIL")
    sender_pass = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_APP_PASSWORD")

    if not sender_email or not sender_pass:
        logger.warning(
            f"[EmailService SIMULATION] SMTP credentials missing in .env. "
            f"Simulating batch delivery of {len(messages)} email(s)."
        )
        return True

    success_count = 0
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.starttls()
            server.login(sender_email, sender_pass)

            for idx, msg_item in enumerate(messages):
                to_emails = msg_item.get("to_emails")
                subject = msg_item.get("subject", "Smart Health EWS Alert")
                text_content = msg_item.get("text_content", "")
                html_content = msg_item.get("html_content")

                if isinstance(to_emails, str):
                    recipients = [to_emails.strip()]
                else:
                    recipients = [email.strip() for email in to_emails if email and email.strip()]

                sender_email_clean = (sender_email or "").strip().lower()
                recipients = [
                    e for e in recipients
                    if e and e.lower() != sender_email_clean and not e.lower().endswith("@noemail.local")
                ]

                if not recipients:
                    continue

                msg = MIMEMultipart("alternative")
                msg["From"] = formataddr(("Smart Health EWS", sender_email))
                msg["To"] = ", ".join(recipients)
                msg["Subject"] = subject

                part1 = MIMEText(text_content, "plain", "utf-8")
                msg.attach(part1)

                if html_content:
                    part2 = MIMEText(html_content, "html", "utf-8")
                    msg.attach(part2)

                server.sendmail(sender_email, recipients, msg.as_string())
                success_count += 1
                logger.info(f"[EmailService Batch] ({idx + 1}/{len(messages)}) Sent email to {recipients}: '{subject}'")

                # Inter-message delay (1.0s) within the same connection to prevent Gmail burst throttling
                if idx < len(messages) - 1:
                    time.sleep(1.0)

        logger.info(f"[EmailService Batch COMPLETE] Sent {success_count}/{len(messages)} emails over single connection.")
        logger.info(f"[EMAIL DEBUG] Finished batch send with success={success_count > 0} at {datetime.utcnow()}")
        return success_count > 0
    except Exception as exc:
        logger.error(f"[EmailService ERROR] Exception during batch email dispatch: {type(exc).__name__}: {exc}", exc_info=True)
        return False


def send_email_smtp(
    to_emails: Union[List[str], str],
    subject: str,
    text_content: str,
    html_content: Optional[str] = None
) -> bool:
    """
    Sends a single email via SMTP. Delegates to send_email_batch for unified connection handling.
    """
    return send_email_batch([
        {
            "to_emails": to_emails,
            "subject": subject,
            "text_content": text_content,
            "html_content": html_content
        }
    ])


def build_ews_alert_email_template(
    village_name: str,
    district: str = "N/A",
    state: str = "N/A",
    risk_level: str = "High",
    disease_outbreak: str = "Vector-Borne Outbreak Risk",
    metrics: Optional[Dict[str, Any]] = None
) -> Dict[str, str]:
    """
    Generates rich, beautifully-styled HTML and matching plain-text email templates for EWS Risk Alerts.
    Uses inline CSS for universal email client compatibility.
    """
    metrics = metrics or {}
    temp = metrics.get("temperature", "N/A")
    hum = metrics.get("humidity", "N/A")
    rain = metrics.get("rainfall", "N/A")

    risk_clean = (risk_level or "High").strip().capitalize()

    if risk_clean.lower() == "critical":
        badge_bg = "#dc2626"  # Red
        badge_text = "Critical Risk"
        header_banner_bg = "#991b1b"
    elif risk_clean.lower() == "high":
        badge_bg = "#ea580c"  # Orange
        badge_text = "High Risk"
        header_banner_bg = "#c2410c"
    elif risk_clean.lower() == "medium":
        badge_bg = "#d97706"  # Amber/Yellow
        badge_text = "Medium Risk"
        header_banner_bg = "#b45309"
    else:
        badge_bg = "#2563eb"  # Blue
        badge_text = f"{risk_clean} Risk"
        header_banner_bg = "#1d4ed8"

    # Anti-Spam Compliant Subject Line (1 emoji max, normal case, no ALL-CAPS words, no trailing exclamations)
    subject = f"⚠️ Health Alert: {risk_clean} risk detected in {village_name}"

    plain_text = (
        f"Smart Health Early Warning System (EWS) Alert\n"
        f"--------------------------------------------------\n"
        f"Risk Level: {badge_text}\n"
        f"Location: {village_name}, {district}, {state}\n"
        f"Suspected Outbreak: {disease_outbreak}\n\n"
        f"Environmental Metrics:\n"
        f" - Temperature: {temp}°C\n"
        f" - Relative Humidity: {hum}%\n"
        f" - Precipitation/Rainfall: {rain} mm\n\n"
        f"Required Action Protocol:\n"
        f"1. ASHA Workers: Initiate immediate door-to-door symptom screening in {village_name}.\n"
        f"2. PHC Officers: Alert medical response units, prepare fever clinics, and verify stock of diagnostic kits & medicines.\n"
        f"3. Sanitation Teams: Inspect vector breeding hotspots and coordinate larvicidal / fogging operations.\n\n"
        f"--------------------------------------------------\n"
        f"This is an automated health alert from the Smart Health Early Warning System for your assigned village. "
        f"Contact your administrator if you believe you received this in error.\n"
    )

    html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 20px 0;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); max-width: 600px; width: 100%;">
                    
                    <!-- HEADER BANNER -->
                    <tr>
                        <td style="background-color: {header_banner_bg}; padding: 24px 30px; text-align: center;">
                            <span style="background-color: #ffffff; color: {badge_bg}; font-size: 12px; font-weight: 800; letter-spacing: 1px; padding: 6px 14px; border-radius: 50px; text-transform: uppercase; display: inline-block; margin-bottom: 10px;">
                                {badge_text}
                            </span>
                            <h1 style="color: #ffffff; margin: 8px 0 0 0; font-size: 22px; font-weight: 700; line-height: 1.3;">
                                Smart Health Early Warning System
                            </h1>
                            <p style="color: #fef2f2; margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">
                                Automated Outbreak Risk Notification
                            </p>
                        </td>
                    </tr>

                    <!-- MAIN CONTENT BODY -->
                    <tr>
                        <td style="padding: 30px;">
                            
                            <!-- LOCATION CARD -->
                            <div style="background-color: #f8fafc; border-left: 4px solid {badge_bg}; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
                                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                                    <tr>
                                        <td>
                                            <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Target Location</div>
                                            <div style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px;">{village_name}</div>
                                            <div style="font-size: 14px; color: #475569; margin-top: 2px;">District: {district} | State: {state}</div>
                                        </td>
                                    </tr>
                                </table>
                            </div>

                            <!-- SUSPECTED OUTBREAK -->
                            <div style="margin-bottom: 24px;">
                                <div style="font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                                    Suspected Outbreak Type
                                </div>
                                <div style="font-size: 16px; font-weight: 600; color: #dc2626; background-color: #fef2f2; padding: 10px 14px; border-radius: 8px; border: 1px solid #fee2e2; display: inline-block;">
                                    ⚠️ {disease_outbreak}
                                </div>
                            </div>

                            <!-- ENVIRONMENTAL METRICS TABLE -->
                            <div style="margin-bottom: 28px;">
                                <div style="font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px;">
                                    Real-Time Environmental Sensor Triggers
                                </div>
                                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                                    <thead>
                                        <tr style="background-color: #f1f5f9;">
                                            <th align="left" style="padding: 10px 14px; font-size: 13px; color: #475569; font-weight: 700; border-bottom: 1px solid #e2e8f0;">Metric Parameter</th>
                                            <th align="right" style="padding: 10px 14px; font-size: 13px; color: #475569; font-weight: 700; border-bottom: 1px solid #e2e8f0;">Recorded Telemetry</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style="padding: 10px 14px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9;">🌡️ Temperature</td>
                                            <td align="right" style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">{temp}°C</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 14px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9;">💧 Relative Humidity</td>
                                            <td align="right" style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">{hum}%</td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 10px 14px; font-size: 14px; color: #1e293b;">🌧️ Precipitation / Rainfall</td>
                                            <td align="right" style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #0f172a;">{rain} mm</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            <!-- ACTION PROTOCOL -->
                            <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
                                <div style="font-size: 15px; font-weight: 700; color: #92400e; margin-bottom: 10px; display: flex; align-items: center;">
                                    📋 Required Action Protocol for PHC & ASHA Teams
                                </div>
                                <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px; line-height: 1.6;">
                                    <li style="margin-bottom: 6px;"><strong>ASHA Workers:</strong> Initiate door-to-door fever and symptom surveillance immediately in {village_name}.</li>
                                    <li style="margin-bottom: 6px;"><strong>PHC Officers:</strong> Mobilize rapid response medical kits, notify regional health officers, and verify diagnostic supply levels.</li>
                                    <li><strong>Sanitation Teams:</strong> Coordinate vector breeding container inspection and fogging/larvicidal treatments.</li>
                                </ul>
                            </div>

                        </td>
                    </tr>

                    <!-- FOOTER -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                            <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                                This is an automated notification from the <strong>Smart Health EWS Platform</strong>.<br>
                                Please do not reply directly to this automated address.
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8; line-height: 1.4;">
                                This is an automated health alert from the Smart Health Early Warning System for your assigned village. Contact your administrator if you believe you received this in error.
                            </p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

    return {
        "subject": subject,
        "text_content": plain_text,
        "html_content": html_content
    }
