from fastapi import FastAPI, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Dict, List, Optional
from server.model import ModelService
from server.preprocessing import preprocess_input, preprocess_from_df
import pandas as pd

app = FastAPI(title="Stock Prediction API", version="1.0")

# simple request/response shapes
class FeaturesRequest(BaseModel):
    features: Dict[str, float]
    # optionally pass a list if your client prefers positional features
    feature_list: Optional[List[float]] = None

class PredictionResponse(BaseModel):
    next_price: float
    diff: float
    diff_pct: float
    next_date: Optional[str] = None
    meta: Optional[Dict] = None


@app.on_event("startup")
def startup_event():
    # load model on startup (cached inside ModelService)
    ModelService.load()


@app.post("/predict", response_model=PredictionResponse)
def predict(req: FeaturesRequest):
    try:
        # Preprocess into model-ready vector
        x = preprocess_input(req.features, req.feature_list)
        model = ModelService.get()
        # model must implement predict and optionally predict_proba
        y = model.predict([x])[0]

        # The model may return a direct price or a normalized value; here
        # we assume it returns the next-day price. If your model returns
        # a normalized target, move inverse-scaling into preprocess or ModelService.
        next_price = float(y)

        # best-effort: try to include a diff if client sent current price
        now_price = req.features.get('today_close') or (req.feature_list and None)
        diff = float(next_price - now_price) if now_price is not None else 0.0
        diff_pct = float((diff / now_price) * 100) if now_price not in (None, 0) else 0.0

        return PredictionResponse(next_price=next_price, diff=diff, diff_pct=diff_pct, meta={"model": ModelService.info()})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...), predict: bool = False):
    """Accept a CSV of OHLCV rows, run preprocessing, and optionally return prediction.

    - `predict` (query param): if true, run model.predict on the generated vector.
    """
    try:
        content = await file.read()
        # read into pandas
        df = pd.read_csv(pd.io.common.BytesIO(content))
        vec = preprocess_from_df(df)
        result = {"features": vec}
        if predict:
            model = ModelService.get()
            y = model.predict([vec])[0]
            result['prediction'] = float(y)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
