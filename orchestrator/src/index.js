const express = require('express');
const pool = require('./db');
const { triggerJenkinsJob } = require('./jenkins');
const { decideRecoveryAction } = require('./decisionEngine');

const app = express();
const PORT = process.env.PORT || 3000;
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
const CHECK_INTERVAL_MS = 10000;

app.use(express.json());

// --- Dashboard API endpoints ---

app.get('/api/incidents', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT * FROM incidents ORDER BY opened_at DESC LIMIT 50`
  );
  res.json(rows);
});

app.get('/api/metrics/recent', async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT * FROM metrics ORDER BY recorded_at DESC LIMIT 50`
  );
  res.json(rows);
});

// --- Core detection + recovery loop ---

async function getLatestMetric() {
  const [rows] = await pool.execute(
    `SELECT * FROM metrics ORDER BY recorded_at DESC LIMIT 1`
  );
  return rows[0];
}

async function checkForAnomaly() {
  const metric = await getLatestMetric();
  if (!metric) return;

  let prediction;
  try {
    const res = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpu_percent: metric.cpu_percent,
        memory_percent: metric.memory_percent,
        response_time_ms: metric.response_time_ms,
        error_rate: metric.error_rate
      })
    });
    prediction = await res.json();
  } catch (err) {
    console.error('ML service unreachable:', err.message);
    return;
  }

  if (!prediction.is_anomaly) {
    console.log(`Metric ${metric.id}: normal (score ${prediction.anomaly_score?.toFixed(4)})`);
    return;
  }

  console.log(`ANOMALY detected on metric ${metric.id} (score ${prediction.anomaly_score?.toFixed(4)})`);

  const [predictionResult] = await pool.execute(
    `INSERT INTO predictions (metric_id, is_anomaly, anomaly_score) VALUES (?, ?, ?)`,
    [metric.id, true, prediction.anomaly_score]
  );
  const predictionId = predictionResult.insertId;

  const { failureType, actionType, jenkinsJob } = decideRecoveryAction(metric);

  const [incidentResult] = await pool.execute(
    `INSERT INTO incidents (container_name, failure_type, prediction_id, status) VALUES (?, ?, ?, 'detected')`,
    [metric.container_name, failureType, predictionId]
  );
  const incidentId = incidentResult.insertId;

  try {
    const jenkinsResult = await triggerJenkinsJob(jenkinsJob, { container: metric.container_name });

    await pool.execute(
      `INSERT INTO recovery_actions (incident_id, action_type, jenkins_job, outcome) VALUES (?, ?, ?, ?)`,
      [incidentId, actionType, jenkinsJob, jenkinsResult.triggered ? 'pending' : 'failure']
    );

    await pool.execute(
      `UPDATE incidents SET status = 'remediating' WHERE id = ?`,
      [incidentId]
    );

    console.log(`Triggered "${jenkinsJob}" for incident ${incidentId}`);
  } catch (err) {
    console.error('Recovery trigger failed:', err.message);
    await pool.execute(
      `UPDATE incidents SET status = 'failed' WHERE id = ?`,
      [incidentId]
    );
  }
}

app.listen(PORT, () => {
  console.log(`Orchestrator API listening on port ${PORT}`);
  setInterval(checkForAnomaly, CHECK_INTERVAL_MS);
});