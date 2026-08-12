import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib
import mysql.connector
import os

def load_metrics():
    conn = mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", "rootpass"),
        database=os.getenv("DB_NAME", "self_healing_db"),
    )
    query = "SELECT cpu_percent, memory_percent, response_time_ms, error_rate FROM metrics"
    df = pd.read_sql(query, conn)
    conn.close()
    return df

def train():
    df = load_metrics()
    if len(df) < 20:
        raise ValueError(
            f"Only {len(df)} rows found - collect more 'normal' metrics before training. "
            "Let the metrics-collector run for a while against the healthy app first."
        )

    features = ["cpu_percent", "memory_percent", "response_time_ms", "error_rate"]
    X = df[features]

    # contamination = expected proportion of anomalies in training data.
    # Since we're training mostly on healthy data, keep this low.
    model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
    model.fit(X)

    joblib.dump(model, "model.pkl")
    print(f"Trained on {len(df)} rows. Model saved to model.pkl")

if __name__ == "__main__":
    train()