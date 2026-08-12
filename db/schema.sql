-- Self-Healing DevOps System: MySQL schema
-- Run this once against a fresh database, e.g.:
--   mysql -u root -p self_healing_db < db/schema.sql

CREATE DATABASE IF NOT EXISTS self_healing_db;
USE self_healing_db;

-- Raw time-series health metrics collected from the target container(s)
CREATE TABLE IF NOT EXISTS metrics (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    container_name  VARCHAR(100)    NOT NULL,
    cpu_percent     DECIMAL(5,2)    NOT NULL,
    memory_percent  DECIMAL(5,2)    NOT NULL,
    response_time_ms INT            NOT NULL,
    error_rate      DECIMAL(5,2)    NOT NULL DEFAULT 0.00,
    recorded_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_container_time (container_name, recorded_at)
);

-- ML predictions made against recent metrics windows
CREATE TABLE IF NOT EXISTS predictions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    metric_id       BIGINT          NOT NULL,
    is_anomaly      BOOLEAN         NOT NULL,
    anomaly_score   DECIMAL(6,4)    NOT NULL,
    predicted_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (metric_id) REFERENCES metrics(id) ON DELETE CASCADE
);

-- Incidents opened when an anomaly is confirmed and a recovery is triggered
CREATE TABLE IF NOT EXISTS incidents (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    container_name  VARCHAR(100)    NOT NULL,
    failure_type    VARCHAR(50)     NOT NULL,   -- e.g. crash, memory_leak, latency_spike
    prediction_id   BIGINT,
    status          ENUM('detected','remediating','resolved','failed') NOT NULL DEFAULT 'detected',
    opened_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at     TIMESTAMP       NULL,
    FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE SET NULL
);

-- Recovery actions taken (via Jenkins) for a given incident
CREATE TABLE IF NOT EXISTS recovery_actions (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    incident_id     BIGINT          NOT NULL,
    action_type     VARCHAR(50)     NOT NULL,   -- e.g. restart, scale_up, rollback
    jenkins_job     VARCHAR(100)    NOT NULL,
    jenkins_build_number INT,
    outcome         ENUM('pending','success','failure') NOT NULL DEFAULT 'pending',
    triggered_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMP       NULL,
    FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);
