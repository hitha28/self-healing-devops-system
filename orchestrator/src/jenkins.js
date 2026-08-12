async function triggerJenkinsJob(jobName, params = {}) {
  const jenkinsUrl = process.env.JENKINS_URL;
  const user = process.env.JENKINS_USER;
  const token = process.env.JENKINS_TOKEN;

  if (!jenkinsUrl || !user || !token) {
    console.warn('Jenkins credentials not configured - skipping actual trigger (dry run)');
    return { triggered: false, reason: 'missing_credentials' };
  }

  const auth = Buffer.from(`${user}:${token}`).toString('base64');
  const query = new URLSearchParams(params).toString();
  const url = `${jenkinsUrl}/job/${jobName}/buildWithParameters?${query}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}` }
  });

  if (!res.ok) {
    throw new Error(`Jenkins trigger failed: ${res.status} ${res.statusText}`);
  }

  // Jenkins returns a 201 with a Location header pointing to the queued build
  const queueLocation = res.headers.get('Location');
  return { triggered: true, queueLocation };
}

module.exports = { triggerJenkinsJob };