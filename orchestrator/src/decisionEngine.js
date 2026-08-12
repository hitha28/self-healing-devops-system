// Compares metrics against typical healthy baselines (not fixed absolutes)
// to pick a more accurate failure_type when the ML model flags an anomaly.

const BASELINE = {
  memory_percent: 5,      // typical healthy memory % for this app
  response_time_ms: 50,   // typical healthy response time
  error_rate: 0
};

function decideRecoveryAction(metrics) {
  const memoryRatio = metrics.memory_percent / BASELINE.memory_percent;
  const latencyRatio = metrics.response_time_ms / BASELINE.response_time_ms;

  if (metrics.error_rate >= 100) {
    return { failureType: 'crash', actionType: 'restart', jenkinsJob: 'restart-container' };
  }
  if (memoryRatio >= latencyRatio && memoryRatio > 1.5) {
    return { failureType: 'memory_leak', actionType: 'restart', jenkinsJob: 'restart-container' };
  }
  if (latencyRatio > 1.5) {
    return { failureType: 'latency_spike', actionType: 'scale_up', jenkinsJob: 'scale-service' };
  }
  return { failureType: 'unknown', actionType: 'restart', jenkinsJob: 'restart-container' };
}

module.exports = { decideRecoveryAction };