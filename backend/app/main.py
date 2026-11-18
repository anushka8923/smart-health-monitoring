from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import database, models
from app.routers import sensors, villages, alerts, phc, auth, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=database.engine)
    yield  # This keeps the server running


app = FastAPI(
    title="Smart Health EWS Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(sensors.router)
app.include_router(villages.router)
app.include_router(alerts.router)
app.include_router(phc.router)
app.include_router(admin.router)




@app.get("/")
def read_root():
    return {"status": "Smart Health EWS Backend is Online"}

