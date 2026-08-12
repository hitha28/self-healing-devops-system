const Docker = require('dockerode');
const mysql = require('mysql2/promise');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const TARGET_CONTAINER = process.env.TARGET_CONTAINER || 'shs-target-app';
const POLL_INTERVAL_MS = 5000;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootpass',
  database: process.env.DB_NAME || 'self_healing_db'
};

let pool;

async function initDb() {
  pool = await mysql.createPool(dbConfig);
  console.log('Connected to MySQL');
}

// Calculates CPU % from raw Docker stats (Docker doesn't give this directly)
function calculateCpuPercent(stats) {
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const cpuCount = stats.cpu_stats.online_cpus || 1;
  if (systemDelta > 0 && cpuDelta > 0) {
    return (cpuDelta / systemDelta) * cpuCount * 100;
  }
  return 0;
}

function calculateMemoryPercent(stats) {
  const usage = stats.memory_stats.usage || 0;
  const limit = stats.memory_stats.limit || 1;
  return (usage / limit) * 100;
}

async function measureResponseTime() {
  const start = Date.now();
  try {
    const res = await fetch(`http://${TARGET_CONTAINER}:4000/health`, { signal: AbortSignal.timeout(3000) });
    await res.text();
    return { responseTimeMs: Date.now() - start, errorRate: res.ok ? 0 : 100 };
  } catch (err) {
    return { responseTimeMs: 3000, errorRate: 100 }; // timeout or crash counts as max latency + error
  }
}

async function collectOnce() {
  try {
    const container = docker.getContainer(TARGET_CONTAINER);
    const stats = await container.stats({ stream: false });

    const cpuPercent = calculateCpuPercent(stats);
    const memoryPercent = calculateMemoryPercent(stats);
    const { responseTimeMs, errorRate } = await measureResponseTime();

    await pool.execute(
      `INSERT INTO metrics (container_name, cpu_percent, memory_percent, response_time_ms, error_rate)
       VALUES (?, ?, ?, ?, ?)`,
      [TARGET_CONTAINER, cpuPercent.toFixed(2), memoryPercent.toFixed(2), responseTimeMs, errorRate]
    );

    console.log(`Recorded: cpu=${cpuPercent.toFixed(2)}% mem=${memoryPercent.toFixed(2)}% resp=${responseTimeMs}ms err=${errorRate}%`);
  } catch (err) {
    // Container likely crashed/unreachable - still worth recording as a data point
    console.error('Collection error (container may be down):', err.message);
    await pool.execute(
      `INSERT INTO metrics (container_name, cpu_percent, memory_percent, response_time_ms, error_rate)
       VALUES (?, ?, ?, ?, ?)`,
      [TARGET_CONTAINER, 0, 0, 3000, 100]
    );
  }
}

async function main() {
  await initDb();
  console.log(`Starting metrics collection for "${TARGET_CONTAINER}" every ${POLL_INTERVAL_MS}ms`);
  setInterval(collectOnce, POLL_INTERVAL_MS);
  collectOnce();
}

main();