from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
import os

app = FastAPI(title="Anomaly Detection Service")

MODEL_PATH = "model.pkl"
model = None

class Metrics(BaseModel):
    cpu_percent: float
    memory_percent: float
    response_time_ms: float
    error_rate: float

@app.on_event("startup")
def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        print("Model loaded")
    else:
        print("WARNING: model.pkl not found. Run train.py first.")

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/predict")
def predict(metrics: Metrics):
    if model is None:
        return {"error": "Model not loaded. Run train.py first."}

    X = pd.DataFrame([metrics.dict()])
    prediction = model.predict(X)[0]      # 1 = normal, -1 = anomaly
    score = model.decision_function(X)[0]  # higher = more normal, lower/negative = more anomalous

    return {
        "is_anomaly": bool(prediction == -1),
        "anomaly_score": float(score)
    }