import { useEffect, useState } from 'react';

const ORCHESTRATOR_URL = import.meta.env.VITE_ORCHESTRATOR_URL || 'http://localhost:3000';

function StatusBadge({ status }) {
  const colors = {
    detected: '#f59e0b',
    remediating: '#3b82f6',
    resolved: '#22c55e',
    failed: '#ef4444'
  };
  return (
    <span style={{
      background: colors[status] || '#999',
      color: 'white',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px'
    }}>
      {status}
    </span>
  );
}

export default function App() {
  const [metrics, setMetrics] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [error, setError] = useState(null);

  async function loadData() {
    try {
      const [metricsRes, incidentsRes] = await Promise.all([
        fetch(`${ORCHESTRATOR_URL}/api/metrics/recent`),
        fetch(`${ORCHESTRATOR_URL}/api/incidents`)
      ]);
      setMetrics(await metricsRes.json());
      setIncidents(await incidentsRes.json());
      setError(null);
    } catch (err) {
      setError('Could not reach orchestrator API: ' + err.message);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const latest = metrics[0];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <h1>Self-Healing System Dashboard</h1>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <section style={{ marginBottom: '32px' }}>
        <h2>Current Health</h2>
        {latest ? (
          <div style={{ display: 'flex', gap: '16px' }}>
            <div><strong>CPU:</strong> {latest.cpu_percent}%</div>
            <div><strong>Memory:</strong> {latest.memory_percent}%</div>
            <div><strong>Response Time:</strong> {latest.response_time_ms}ms</div>
            <div><strong>Error Rate:</strong> {latest.error_rate}%</div>
          </div>
        ) : (
          <p>No metrics yet - is the metrics-collector running?</p>
        )}
      </section>

      <section style={{ marginBottom: '32px' }}>
        <h2>Incidents</h2>
        {incidents.length === 0 ? (
          <p>No incidents recorded.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                <th>ID</th>
                <th>Container</th>
                <th>Failure Type</th>
                <th>Status</th>
                <th>Opened At</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map(inc => (
                <tr key={inc.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td>{inc.id}</td>
                  <td>{inc.container_name}</td>
                  <td>{inc.failure_type}</td>
                  <td><StatusBadge status={inc.status} /></td>
                  <td>{new Date(inc.opened_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h2>Recent Metrics History</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th>Time</th>
              <th>CPU %</th>
              <th>Mem %</th>
              <th>Resp (ms)</th>
              <th>Err %</th>
            </tr>
          </thead>
          <tbody>
            {metrics.slice(0, 15).map(m => (
              <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                <td>{new Date(m.recorded_at).toLocaleTimeString()}</td>
                <td>{m.cpu_percent}</td>
                <td>{m.memory_percent}</td>
                <td>{m.response_time_ms}</td>
                <td>{m.error_rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}