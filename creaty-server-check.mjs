const baseUrl = String(process.env.CREATY_SERVER_URL || 'http://127.0.0.1:3020').replace(/\/$/, '');
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(`${baseUrl}/ping`, { signal: controller.signal });
  const body = await response.text();
  let payload = body;
  try {
    payload = JSON.parse(body);
  } catch {
    // Keep non-JSON responses visible for diagnostics.
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${body}`);
  console.log(JSON.stringify({ ok: true, baseUrl, payload }, null, 2));
} catch (error) {
  const reason = error?.name === 'AbortError' ? 'request timed out' : error?.message || String(error);
  console.error(`CREATY server check failed at ${baseUrl}: ${reason}`);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}