import httpx
from typing import Dict, Any


async def fetch_live_weather(lat: float, lon: float) -> Dict[str, Any]:
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,precipitation"
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            current = data.get("current", {})
            return {
                "temperature": float(current.get("temperature_2m", 0.0)),
                "humidity": float(current.get("relative_humidity_2m", 0.0)),
                "rainfall": float(current.get("precipitation", 0.0)),
            }
        except httpx.HTTPError as exc:
            print(f"HTTP error occurred while fetching weather data: {exc}")
            return {
                "temperature": 0.0,
                "humidity": 0.0,
                "rainfall": 0.0,
            }
        except Exception as exc:
            print(f"Unexpected error while fetching weather data: {exc}")
            return {
                "temperature": 0.0,
                "humidity": 0.0,
                "rainfall": 0.0,
            }
