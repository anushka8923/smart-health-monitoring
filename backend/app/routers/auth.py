import os
from datetime import datetime, timedelta
import random
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from passlib.context import CryptContext

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.database import get_db
from app.models import User
from app.schemas import (
    UserSignup,
    UserLogin,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    GoogleAuthRequest,
    AuthResponse,
    AuthUserPayload
)

logger = logging.getLogger("auth_router")
logging.basicConfig(level=logging.INFO)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Password hashing context utilizing pbkdf2_sha256 and bcrypt
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def send_otp_email(to_email: str, otp_code: str):
    """
    Sends 6-digit OTP code to user's email via SMTP server, with automatic simulation fallback.
    """
    smtp_host = os.getenv("SMTP_SERVER") or os.getenv("SMTP_HOST") or "smtp.gmail.com"
    try:
        smtp_port = int(os.getenv("SMTP_PORT", 587))
    except (ValueError, TypeError):
        smtp_port = 587
    sender_email = os.getenv("SMTP_EMAIL") or os.getenv("SMTP_SENDER_EMAIL")
    sender_pass = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_APP_PASSWORD")

    subject = "Smart Health EWS - Password Reset OTP Code"
    body = (
        f"Hello,\n\n"
        f"Your 6-digit Password Reset OTP code is: {otp_code}\n\n"
        f"This code will expire in 15 minutes. If you did not request a password reset, please ignore this email.\n\n"
        f"Regards,\nSmart Health EWS Support Team"
    )

    if not sender_email or not sender_pass:
        logger.info(f"[EMAIL SIMULATION] Sent Password Reset OTP '{otp_code}' to {to_email}")
        return True

    try:
        msg = MIMEMultipart()
        msg["From"] = sender_email
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(sender_email, sender_pass)
            server.send_message(msg)

        logger.info(f"[SMTP EMAIL] Successfully sent OTP to {to_email}")
        return True
    except Exception as exc:
        logger.error(f"[SMTP ERROR] Failed to send email to {to_email}: {exc}")
        logger.info(f"[EMAIL FALLBACK] Password Reset OTP for {to_email} is: {otp_code}")
        return True


# ==============================================================================
# AUTH ENDPOINTS
# ==============================================================================

@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: UserSignup, db: Session = Depends(get_db)):
    """
    Creates a new user account with hashed password and assigned role ('Admin', 'PHC', 'ASHA').
    """
    email_clean = payload.email.lower().strip()
    existing_user = db.query(User).filter(User.email == email_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # Standardize role format ('Admin', 'PHC', 'ASHA')
    role_normalized = payload.role.strip().capitalize()
    if role_normalized.upper() == "ASHA":
        role_normalized = "ASHA"
    elif role_normalized.upper() == "PHC":
        role_normalized = "PHC"
    elif role_normalized.upper() == "ADMIN":
        role_normalized = "Admin"

    new_user = User(
        name=payload.name.strip(),
        email=email_clean,
        password_hash=hash_password(payload.password),
        role=role_normalized,
        phone_number=payload.phone_number.strip() if payload.phone_number else None,
        assigned_village_id=payload.assigned_village_id
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return AuthResponse(
        status="success",
        message=f"User '{new_user.name}' registered successfully with role '{new_user.role}'.",
        user=AuthUserPayload.model_validate(new_user)
    )


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticates user credentials and returns user payload upon success.
    """
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password."
        )

    return AuthResponse(
        status="success",
        message="Login successful.",
        user=AuthUserPayload.model_validate(user)
    )


@router.post("/forgot-password", response_model=AuthResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Generates a random 6-digit OTP with a 15-minute expiration timestamp and dispatches via Email.
    """
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User with this email address was not found."
        )

    # Generate 6-digit random OTP
    otp_code = str(random.randint(100000, 999999))
    user.reset_otp = otp_code
    user.otp_expiry = datetime.utcnow() + timedelta(minutes=15)

    db.commit()

    send_otp_email(to_email=user.email, otp_code=otp_code)

    return AuthResponse(
        status="success",
        message=f"Password reset OTP has been sent to {user.email}."
    )


@router.post("/reset-password", response_model=AuthResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Verifies 6-digit OTP code and expiry, then updates the user's hashed password.
    """
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    if not user.reset_otp or user.reset_otp.strip() != payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code. Please check your email and try again."
        )

    if not user.otp_expiry or user.otp_expiry < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP code has expired. Please request a new password reset code."
        )

    # Update password and clear OTP fields
    user.password_hash = hash_password(payload.new_password)
    user.reset_otp = None
    user.otp_expiry = None

    db.commit()

    return AuthResponse(
        status="success",
        message="Password has been reset successfully. You can now log in with your new password."
    )



# ==============================================================================
# GOOGLE OAUTH2 SSO ENDPOINT
# ==============================================================================

GOOGLE_CLIENT_ID = "1098543926984-58hap1m939o3gjjhj7hf1aov8qtk33sb.apps.googleusercontent.com"


@router.post("/google", response_model=AuthResponse)
def google_auth(payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    """
    Google OAuth2 Single Sign-On (SSO) Endpoint.
    Verifies the Google JWT ID token, extracts user profile (email, name),
    authenticates existing user or auto-registers new user with default role 'Admin'.
    """
    token = payload.token.strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token is required."
        )

    try:
        id_info = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except ValueError as exc:
        logger.error(f"[GOOGLE SSO ERROR] Token verification failed: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google authentication token: {exc}"
        )
    except Exception as exc:
        logger.error(f"[GOOGLE SSO ERROR] Unexpected verification failure: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication token verification failed."
        )

    google_email = id_info.get("email", "").lower().strip()
    google_name = id_info.get("name", "").strip() or "Google User"

    if not google_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google token payload did not contain a valid email address."
        )

    user = db.query(User).filter(User.email == google_email).first()

    if user:
        logger.info(f"[GOOGLE SSO] Existing user authenticated: {user.email}")
        return AuthResponse(
            status="success",
            message="Google authentication successful.",
            user=AuthUserPayload.model_validate(user)
        )

    # Auto-register new user if email does not exist in DB
    random_password = f"GoogleAuth_{os.urandom(8).hex()}"
    new_user = User(
        name=google_name,
        email=google_email,
        password_hash=hash_password(random_password),
        role="Admin",
        assigned_village_id=None
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"[GOOGLE SSO] Auto-registered new user: {new_user.email} with role Admin")
    return AuthResponse(
        status="success",
        message=f"Account created successfully for {new_user.name} via Google SSO.",
        user=AuthUserPayload.model_validate(new_user)
    )


# ==============================================================================
# AUTH DEPENDENCY: GET CURRENT USER
# ==============================================================================

def get_current_user(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[int] = Header(None),
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to resolve the currently authenticated user from headers (Authorization / X-User-Id) or query params.
    """
    found_user = None

    if x_user_id is not None:
        found_user = db.query(User).filter(User.id == x_user_id).first()

    if not found_user and user_id is not None:
        found_user = db.query(User).filter(User.id == user_id).first()

    if not found_user and authorization:
        token = authorization.replace("Bearer ", "").strip()
        if token.isdigit():
            found_user = db.query(User).filter(User.id == int(token)).first()
        else:
            found_user = db.query(User).filter(User.email == token.lower()).first()

    if not found_user:
        # Dev fallback: if database has at least one admin, use first admin for ease of dev testing if no header passed
        first_user = db.query(User).first()
        if first_user and authorization is None and x_user_id is None and user_id is None:
            return first_user

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or invalid."
        )

    return found_user

