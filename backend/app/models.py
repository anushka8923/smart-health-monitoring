from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.database import Base


user_villages = Table(
    "user_villages",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("village_id", Integer, ForeignKey("villages.id"), primary_key=True),
)


class Village(Base):
    __tablename__ = "villages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    state = Column(String, nullable=True, default="N/A")
    district = Column(String, nullable=True, default="N/A")
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    contact_number = Column(String, nullable=True)
    asha_worker_name = Column(String, nullable=True)
    asha_worker_phone = Column(String, nullable=True)
    asha_worker_email = Column(String, nullable=True)
    phc_officer_name = Column(String, nullable=True)
    phc_officer_phone = Column(String, nullable=True)
    phc_officer_email = Column(String, nullable=True)

    users = relationship("User", back_populates="assigned_village")
    sensor_data = relationship("SensorData", back_populates="village")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # 'Admin', 'PHC', or 'ASHA'
    phone_number = Column(String, nullable=True)
    assigned_village_id = Column(Integer, ForeignKey("villages.id"), nullable=True)
    reset_otp = Column(String, nullable=True)
    otp_expiry = Column(DateTime, nullable=True)

    assigned_village = relationship("Village", back_populates="users")
    assigned_villages = relationship("Village", secondary=user_villages, backref="assigned_users")


class SensorData(Base):
    __tablename__ = "sensor_data"

    id = Column(Integer, primary_key=True, index=True)
    village_id = Column(Integer, ForeignKey("villages.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    temperature = Column(Float, nullable=False)
    humidity = Column(Float, nullable=False)
    rainfall = Column(Float, nullable=False)
    risk_score = Column(String, nullable=True)

    village = relationship("Village", back_populates="sensor_data")
