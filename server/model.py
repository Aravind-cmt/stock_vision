import os
from functools import lru_cache
import joblib

MODEL_PATH_ENV = "MODEL_PATH"
DEFAULT_MODEL = os.path.join(os.path.dirname(__file__), "model.pkl")


class ModelService:
    _model = None

    @classmethod
    def load(cls, path: str = None):
        if cls._model is not None:
            return cls._model
        p = path or os.getenv(MODEL_PATH_ENV) or DEFAULT_MODEL
        if not os.path.exists(p):
            raise FileNotFoundError(f"Model file not found at {p}. Place your trained .pkl there.")
        cls._model = joblib.load(p)
        return cls._model

    @classmethod
    def get(cls):
        if cls._model is None:
            return cls.load()
        return cls._model

    @classmethod
    def info(cls):
        if cls._model is None:
            return {"loaded": False}
        return {"loaded": True, "type": type(cls._model).__name__}
