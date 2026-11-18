import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# Production PostgreSQL connection URL format
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:YOUR_PASSWORD@localhost:5432/smart_health_db"
)

# Robust production-level connection engine configured for real-time IoT sensor data ingestion
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=20,          # Maintains a baseline of active database connections
    max_overflow=10,       # Handles spike loads with additional burst connections
    pool_pre_ping=True,    # Validates connection vitality before executing queries
    pool_recycle=1800,     # Prevents stale server-dropped connection issues (30 mins)
    pool_timeout=30        # Max wait time for pool slot acquisition
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


