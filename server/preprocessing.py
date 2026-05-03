from typing import Dict, List, Optional
import os
import joblib
import numpy as np
import pandas as pd

# If you saved scalers/encoders during training, put them next to model.pkl
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'scaler.pkl')

def _load_scaler():
    if os.path.exists(SCALER_PATH):
        try:
            return joblib.load(SCALER_PATH)
        except Exception:
            return None
    return None


# Feature order expected by the model — keep in sync with training pipeline
FEATURE_ORDER = [
    'chg_pct', 'grade_no', 'zscore_vol', 'volatility', 'rn', 'price_spike', 'lag_smi', 'lag_rsi'
]


def _parse_vol(v):
    v = str(v).strip()
    if v.endswith('M'):
        return float(v[:-1]) * 1_000_000
    if v.endswith('K'):
        return float(v[:-1]) * 1_000
    if v.endswith('B'):
        return float(v[:-1]) * 1_000_000_000
    try:
        return float(v.replace(',', ''))
    except Exception:
        return np.nan


def preprocess_from_df(df: pd.DataFrame) -> List[float]:
    """Run feature engineering on an OHLCV dataframe and return feature vector for latest row.

    Expects columns: Date, Open, High, Low, Close, Volume (or Vol.)
    """
    df = df.copy()
    # normalize column names
    if 'Vol.' in df.columns and 'Volume' not in df.columns:
        df['Volume'] = df['Vol.'].apply(_parse_vol)

    df['Date'] = pd.to_datetime(df['Date'], dayfirst=True, errors='coerce')
    df = df.sort_values('Date').reset_index(drop=True)

    for col in ['Close', 'Open', 'High', 'Low']:
        if col in df.columns:
            df[col] = df[col].astype(str).str.replace(',', '').astype(float)

    # change percent
    if 'Change %' in df.columns:
        df['chg_pct'] = df['Change %'].astype(str).str.replace('%', '').astype(float)
    elif 'Change_%' in df.columns:
        df['chg_pct'] = df['Change_%']
    else:
        df['chg_pct'] = df['Close'].pct_change() * 100

    df['next_close'] = df['Close'].shift(-1)

    # RSI
    delta = df['Close'].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=13, min_periods=14).mean()
    avg_loss = loss.ewm(com=13, min_periods=14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df['rsi'] = 100 - (100 / (1 + rs))

    df['prev_close'] = df['Close'].shift(1)
    df['TR'] = np.maximum(
        df['High'] - df['Low'],
        np.maximum(
            (df['High'] - df['prev_close']).abs(),
            (df['Low'] - df['prev_close']).abs()
        )
    )
    df['ATR'] = df['TR'].ewm(span=14, min_periods=14).mean()

    # simple trend and momentum
    df['trend'] = df['Close'].rolling(10).mean() - df['Close'].rolling(30).mean()
    df['momentum'] = df['Close'] - df['Close'].shift(5)

    # grade bins
    grade_bins = [-np.inf, -3.0, -1.5, -0.5, 0.5, 1.5, 3.0, np.inf]
    grade_labels = [0, 1, 2, 3, 4, 5, 6]
    df['grade_no'] = pd.cut(df['chg_pct'], bins=grade_bins, labels=grade_labels).astype(float).fillna(3)

    # volatility
    df['log_return'] = np.log(df['Close'] / df['Close'].shift(1))
    df['volatility'] = df['log_return'].rolling(20).std() * np.sqrt(252)

    vol_roll_mean = df['Volume'].rolling(20, min_periods=1).mean()
    vol_roll_std = df['Volume'].rolling(20, min_periods=1).std().replace(0, np.nan)
    df['zscore_vol'] = (df['Volume'] - vol_roll_mean) / vol_roll_std

    # SMI (approx)
    k = 14
    lowest_low = df['Low'].rolling(k).min()
    highest_high = df['High'].rolling(k).max()
    mid = (highest_high + lowest_low) / 2
    diff = df['Close'] - mid
    hl_diff = (highest_high - lowest_low) / 2
    diff_smoothed = diff.ewm(span=3, min_periods=3).mean().ewm(span=3, min_periods=3).mean()
    hl_smoothed = hl_diff.ewm(span=3, min_periods=3).mean().ewm(span=3, min_periods=3).mean()
    df['smi'] = 100 * diff_smoothed / hl_smoothed.replace(0, np.nan)

    chg_roll_mean = df['chg_pct'].rolling(20, min_periods=1).mean()
    chg_roll_std = df['chg_pct'].rolling(20, min_periods=1).std().replace(0, np.nan)
    upper = chg_roll_mean + 2 * chg_roll_std
    lower = chg_roll_mean - 2 * chg_roll_std
    df['price_spike'] = ((df['chg_pct'] > upper) | (df['chg_pct'] < lower)).astype(int)

    # normalized close
    close_roll_min = df['Close'].rolling(20).min()
    close_roll_max = df['Close'].rolling(20).max()
    df['zscore_norm_close'] = (df['Close'] - close_roll_min) / (close_roll_max - close_roll_min).replace(0, np.nan)

    # RVI (approx)
    delta = df['Close'].diff()
    up = delta.clip(lower=0)
    down = (-delta).clip(lower=0)
    std_up = up.rolling(14).std()
    std_down = down.rolling(14).std()
    df['RVI'] = 100 * std_up / (std_up + std_down).replace(0, np.nan)
    df['RVI_signal'] = np.where(df['RVI'] > 50, 1, -1)

    mid_point = (df['High'] + df['Low']) / 2
    df['Distance'] = mid_point - mid_point.shift(1)
    vol_scale = df['Volume'].rolling(14).mean()
    df['Box_ratio'] = (df['Volume'] / vol_scale) / (df['High'] - df['Low']).replace(0, np.nan)
    df['EMV'] = df['Distance'] / df['Box_ratio'].replace(0, np.nan)
    df['EMV_smooth'] = df['EMV'].rolling(14).mean()
    df['RN'] = df['RVI'] / df['EMV_smooth'].replace(0, np.nan)

    df = df.sort_values('Date').reset_index(drop=True).dropna()
    if df.shape[0] == 0:
        raise ValueError('No valid rows after preprocessing')

    last = df.iloc[-1]

    # construct feature vector in FEATURE_ORDER
    vec = []
    mapping = {
        'chg_pct': last.get('chg_pct', 0.0),
        'grade_no': last.get('grade_no', 3.0),
        'zscore_vol': last.get('zscore_vol', 0.0),
        'volatility': last.get('volatility', 0.0),
        'rn': last.get('RN', 0.0),
        'price_spike': last.get('price_spike', 0),
        'lag_smi': df['smi'].shift(1).iloc[-1] if df.shape[0] > 1 else 0.0,
        'lag_rsi': df['rsi'].shift(1).iloc[-1] if df.shape[0] > 1 else 0.0,
    }
    for k in FEATURE_ORDER:
        vec.append(float(mapping.get(k, 0.0)))

    scaler = _load_scaler()
    if scaler is not None:
        try:
            out = scaler.transform([vec])[0]
            return out.tolist()
        except Exception:
            pass

    return vec


def preprocess_input(features: Dict[str, float], feature_list: Optional[List[float]] = None):
    """Primary entrypoint used by the API.

    - If client supplies `feature_list`, it is used directly.
    - If client supplies an OHLCV payload (list of rows or CSV path), run full pandas preprocessing.
    - Otherwise map keys according to FEATURE_ORDER.
    """
    if feature_list:
        return list(feature_list)

    # detect OHLCV payload (list of dicts)
    if isinstance(features, dict) and any(k.lower() in features for k in ('open', 'high', 'low', 'close')):
        # assume this dict already contains scalar features, map directly
        return [float(features.get(k, 0.0)) for k in FEATURE_ORDER]

    # if client passed full OHLCV as list under key 'ohlcv'
    if isinstance(features, dict) and 'ohlcv' in features:
        df = pd.DataFrame(features['ohlcv'])
        return preprocess_from_df(df)

    # fallback: try to map by key
    vec = []
    for k in FEATURE_ORDER:
        v = features.get(k)
        vec.append(float(v) if v is not None else 0.0)

    scaler = _load_scaler()
    if scaler is not None:
        try:
            arr = scaler.transform([vec])[0]
            return arr.tolist()
        except Exception:
            pass

    return vec
