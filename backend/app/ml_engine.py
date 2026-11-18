import os
import logging
import numpy as np

logger = logging.getLogger("ml_engine")

try:
    import joblib
    HAS_JOBLIB = True
except ImportError:
    HAS_JOBLIB = False

rf_model = None
HAS_ML = False

MODEL_PATH = "random_forest_ews.pkl"

if HAS_JOBLIB:
    try:
        if os.path.exists(MODEL_PATH):
            rf_model = joblib.load(MODEL_PATH)
            HAS_ML = True
            logger.info(f"[ML Engine] Successfully loaded Random Forest model from {MODEL_PATH}")
        else:
            # Fallback path if loaded from nested module
            alt_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "random_forest_ews.pkl")
            if os.path.exists(alt_path):
                rf_model = joblib.load(alt_path)
                HAS_ML = True
                logger.info(f"[ML Engine] Successfully loaded Random Forest model from {alt_path}")
            else:
                logger.warning(f"[ML Engine] Serialized model '{MODEL_PATH}' not found. Using rule-based fallback.")
                HAS_ML = False
    except Exception as exc:
        logger.warning(f"[ML Engine] Failed to load model file: {exc}. Using rule-based fallback.")
        HAS_ML = False
else:
    logger.warning("[ML Engine] joblib package not available. Using rule-based fallback.")

risk_map = {0: "Low", 1: "Medium", 2: "High", 3: "Critical"}


def calculate_risk_score(temperature: float, humidity: float, rainfall: float) -> str:
    """
    Calculate risk score using pre-trained Random Forest model or rule fallback.
    """
    if HAS_ML and rf_model is not None:
        try:
            input_data = np.array([[temperature, humidity, rainfall]])
            prediction = rf_model.predict(input_data)[0]
            return risk_map.get(int(prediction), "Low")
        except Exception as exc:
            logger.error(f"[ML Engine] Model prediction error: {exc}. Falling back to rule logic.")

    # Rule-based fallback
    if temperature > 32.0 and humidity > 75.0 and rainfall > 50.0:
        return "Critical"
    elif temperature > 28.0 and humidity > 60.0:
        return "High"
    elif temperature > 24.0:
        return "Medium"
    return "Low"

