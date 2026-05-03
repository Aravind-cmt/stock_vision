"""Example client: load CSV, call /upload-csv and /predict endpoints.

Requires: requests, pandas
"""
import requests
import pandas as pd
import os

BACKEND = os.environ.get('BACKEND', 'http://localhost:8000')

def call_upload(csv_path, predict=False):
    url = f"{BACKEND}/upload-csv"
    params = {'predict': 'true'} if predict else {}
    with open(csv_path, 'rb') as f:
        files = {'file': (os.path.basename(csv_path), f, 'text/csv')}
        r = requests.post(url, files=files, params=params, timeout=30)
    r.raise_for_status()
    return r.json()

def call_predict(features_dict):
    url = f"{BACKEND}/predict"
    r = requests.post(url, json={'features': features_dict}, timeout=10)
    r.raise_for_status()
    return r.json()


if __name__ == '__main__':
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument('--csv', help='Path to OHLCV CSV to upload')
    p.add_argument('--predict', action='store_true')
    args = p.parse_args()

    if args.csv:
        print('Uploading CSV...')
        out = call_upload(args.csv, predict=args.predict)
        print(out)
    else:
        # small example: predict from scalar features
        feat = {'chg_pct': 0.5, 'grade_no': 3, 'zscore_vol': 0.0, 'volatility': 0.01, 'rn': 0.0, 'price_spike': 0, 'lag_smi': 0, 'lag_rsi': 50, 'today_close': 18200}
        print('Calling /predict...')
        print(call_predict(feat))
