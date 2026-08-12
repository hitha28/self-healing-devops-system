const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;

// Keep leaked memory here so it isn't garbage collected
let memoryLeakStore = [];

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Target app is running' });
});

// Normal health check endpoint - used by the metrics collector
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// --- Chaos endpoints: simulate different failure types ---

// 1. Crash: kills the process, simulating a container crash
app.get('/chaos/crash', (req, res) => {
  res.json({ message: 'Crashing in 1 second...' });
  setTimeout(() => process.exit(1), 1000);
});

// 2. Memory leak: keeps allocating memory and never releases it
app.get('/chaos/memory-leak', (req, res) => {
  const chunk = new Array(1e7).fill('x'); // ~10 million chars
  memoryLeakStore.push(chunk);
  res.json({
    message: 'Allocated a memory chunk',
    chunksHeld: memoryLeakStore.length
  });
});

// 3. Latency spike: artificially delays the response
app.get('/chaos/latency-spike', (req, res) => {
  const delayMs = 5000; // 5 second delay
  setTimeout(() => {
    res.json({ message: `Responded after ${delayMs}ms delay` });
  }, delayMs);
});

app.listen(PORT, () => {
  console.log(`Target app listening on port ${PORT}`);
});