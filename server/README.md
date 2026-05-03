# Stock Prediction FastAPI Backend

This folder provides a minimal production-ready FastAPI backend to serve a trained XGBoost (or scikit-learn style) model.

Structure
- `app.py` - FastAPI app with `/predict` endpoint
- `model.py` - model loader (no retraining; loads `model.pkl`)
- `preprocessing.py` - map incoming features into model vector; optional `scaler.pkl` support
- `requirements.txt`, `Dockerfile`, `.gitignore`

How to use
1. Place your trained model as `server/model.pkl` (joblib dump of estimator). If you use scalers, add `server/scaler.pkl`.
2. Run locally:

```bash
python -m pip install -r server/requirements.txt
uvicorn server.app:app --reload --port 8000
```

3. Example curl:

```bash
curl -X POST "http://localhost:8000/predict" -H "Content-Type: application/json" -d '{"features": {"chg_pct": 0.5, "grade_no": 3, "today_close": 18200}}'
```

React (axios) example

```js
// POST feature dict via src/utils/apiClient.js helper
import { predict, uploadCsv } from '../src/utils/apiClient';

const payload = { chg_pct: 0.5, grade_no: 3, today_close: 18200 };
const res = await predict(payload);
console.log(res);

// Upload CSV: `inputFile` is an <input type="file" /> File object
// const out = await uploadCsv(inputFile, true);
// console.log(out);
```

Deployment notes
 - Render: point a Python Web Service to the repo root, build command `pip install -r server/requirements.txt`, start command `uvicorn server.app:app --host 0.0.0.0 --port $PORT`.
 - Docker: image built from `server/Dockerfile` exposes `8000`.

Deploy notes (Render)
- Add `MODEL_PATH` environment variable or upload `server/model.pkl` as a secret file and reference in build. Example service settings:
	- Build Command: `pip install -r server/requirements.txt`
	- Start Command: `uvicorn server.app:app --host 0.0.0.0 --port $PORT`

Security
- Keep `model.pkl` out of git. Use Render's file storage or an object store and download during build.

Security & production tips
- Serve behind HTTPS and add simple rate-limiting/auth if public.
- Keep the model file out of source control; upload to secret store or object storage and download during build.
