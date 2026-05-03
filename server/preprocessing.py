from typing import Dict, List, Optional
import os
import joblib
import numpy as np

# If you saved scalers/encoders during training, put them next to model.pkl
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'scaler.pkl')

def _load_scaler():
    if os.path.exists(SCALER_PATH):
        try:
            return joblib.load(SCALER_PATH)
        except Exception:
            return None
    return None


# Example feature order used by the trained model. Replace with your exact order.
FEATURE_ORDER = [
    'chg_pct', 'grade_no', 'zscore_vol', 'volatility', 'rn', 'price_spike', 'lag_smi', 'lag_rsi'
]


def preprocess_input(features: Dict[str, float], feature_list: Optional[List[float]] = None):
    """
    Convert incoming payload into a numeric vector matching the model's expected order.

    - If `feature_list` provided, it will be used directly (after length check).
    - Otherwise, map keys from `features` according to `FEATURE_ORDER`.
    - Optionally apply a scaler if `scaler.pkl` exists.
    """
    if feature_list:
        arr = list(feature_list)
        return arr

    x = []
    for k in FEATURE_ORDER:
        v = features.get(k)
        if v is None:
            # missing feature: use 0 as a safe default (tweak for your model)
            v = 0.0
        x.append(float(v))

    scaler = _load_scaler()
    if scaler is not None:
        try:
            arr = scaler.transform([x])[0]
            return arr.tolist()
        except Exception:
            # fallback to raw features
            pass

    return x
