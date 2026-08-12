// Very simple rule-of-thumb mapping. Refine this once you see real anomaly patterns.
function decideRecoveryAction(metrics) {
  if (metrics.memory_percent > 80) {
    return { failureType: 'memory_leak', actionType: 'restart', jenkinsJob: 'restart-container' };
  }
  if (metrics.response_time_ms > 2000) {
    return { failureType: 'latency_spike', actionType: 'scale_up', jenkinsJob: 'scale-service' };
  }
  if (metrics.error_rate >= 100) {
    return { failureType: 'crash', actionType: 'restart', jenkinsJob: 'restart-container' };
  }
  return { failureType: 'unknown', actionType: 'restart', jenkinsJob: 'restart-container' };
}

module.exports = { decideRecoveryAction };