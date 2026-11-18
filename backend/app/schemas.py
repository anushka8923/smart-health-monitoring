from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, ConfigDict


# --- Village Schemas ---
class VillageBase(BaseModel):
    name: str
    latitude: float
    longitude: float
    state: Optional[str] = "N/A"
    district: Optional[str] = "N/A"
    contact_number: Optional[str] = None
    asha_worker_name: Optional[str] = None
    asha_worker_phone: Optional[str] = None
    asha_worker_email: Optional[str] = None
    phc_officer_name: Optional[str] = None
    phc_officer_phone: Optional[str] = None
    phc_officer_email: Optional[str] = None


class VillageCreate(VillageBase):
    pass


class VillageOnboard(BaseModel):
    name: str
    latitude: float
    longitude: float
    contact_number: Optional[str] = None
    state: Optional[str] = "N/A"
    district: Optional[str] = "N/A"
    asha_worker_name: Optional[str] = None
    asha_worker_phone: Optional[str] = None
    asha_worker_email: Optional[str] = None
    phc_officer_name: Optional[str] = None
    phc_officer_phone: Optional[str] = None
    phc_officer_email: Optional[str] = None


class VillageResponse(VillageBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class LiveMapVillage(BaseModel):
    id: int
    name: str
    state: Optional[str] = "N/A"
    district: Optional[str] = "N/A"
    lat: float
    lng: float
    risk_score: str
    temperature: Optional[float] = 0.0
    humidity: Optional[float] = 0.0
    rainfall: Optional[float] = 0.0
    asha_worker_name: Optional[str] = None
    asha_worker_phone: Optional[str] = None
    phc_officer_name: Optional[str] = None
    phc_officer_phone: Optional[str] = None



# --- User Schemas ---
class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str  # 'Admin', 'PHC', or 'ASHA'
    phone_number: Optional[str] = None
    assigned_village_id: Optional[int] = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


# --- Auth Schemas ---
class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "ASHA"  # 'Admin', 'PHC', or 'ASHA'
    phone_number: Optional[str] = None
    assigned_village_id: Optional[int] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


class GoogleAuthRequest(BaseModel):
    token: str


class AuthUserPayload(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    assigned_village_id: Optional[int] = None
    phone_number: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    status: str
    message: str
    user: Optional[AuthUserPayload] = None


# --- SensorData Schemas ---
class SensorDataBase(BaseModel):
    village_id: int
    temperature: float
    humidity: float
    rainfall: float
    risk_score: Optional[str] = None


class SensorDataCreate(SensorDataBase):
    timestamp: Optional[datetime] = None


class SensorDataResponse(SensorDataBase):
    id: int
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


# --- EWS Alert Schema ---
class EWSAlertRequest(BaseModel):
    village_id: Optional[int] = None
    village_name: Optional[str] = "Unknown Village"
    risk_level: str = "Critical"
    disease_outbreak: Optional[str] = "Dengue/Malaria Outbreak Warning"
    target_role: Optional[str] = "PHC"  # 'PHC' or 'ASHA'
    temperature: Optional[float] = 32.5
    humidity: Optional[float] = 85.0
    rainfall: Optional[float] = 120.0
    phone_numbers: Optional[List[str]] = []
    email_addresses: Optional[List[EmailStr]] = []


# --- PHC Jurisdiction Schemas ---
class DispatchTeamRequest(BaseModel):
    village_id: int
    custom_message: Optional[str] = None
class JurisdictionStatusItem(BaseModel):
    village_id: int
    village_name: str
    state: Optional[str] = "N/A"
    district: Optional[str] = "N/A"
    latitude: float
    longitude: float
    asha_worker_name: Optional[str] = None
    asha_worker_phone: Optional[str] = None
    phc_officer_name: Optional[str] = None
    phc_officer_phone: Optional[str] = None
    last_updated: Optional[datetime] = None
    risk_score: str = "Pending"
    temperature: float = 0.0
    humidity: float = 0.0
    rainfall: float = 0.0

    model_config = ConfigDict(from_attributes=True)


# --- ASHA Multi-Place Jurisdiction Schemas ---
class AshaAssignedPlaceItem(BaseModel):
    village_id: int
    village_name: str
    state: Optional[str] = "N/A"
    district: Optional[str] = "N/A"
    latitude: float
    longitude: float
    contact_number: Optional[str] = None
    asha_worker_name: Optional[str] = None
    asha_worker_phone: Optional[str] = None
    phc_officer_name: Optional[str] = None
    phc_officer_phone: Optional[str] = None
    last_updated: Optional[datetime] = None
    risk_score: str = "Normal"
    temperature: float = 0.0
    humidity: float = 0.0
    rainfall: float = 0.0
    historical_records: List[SensorDataResponse] = []

    model_config = ConfigDict(from_attributes=True)

