const DEFAULT_ORACLE_ADMIN_BASE_URL = 'https://emailcore.app/api/admin/oracle';

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_ORACLE_ADMIN_BASE_URL).replace(/\/+$/, '');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonResponse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch (_error) {
    body = null;
  }
  if (!response.ok) {
    const code = body?.oracle?.error?.code || body?.error?.code || `HTTP_${response.status}`;
    const message = body?.oracle?.error?.message || body?.error?.message || 'Oracle task request failed.';
    const error = new Error(message);
    error.code = code;
    error.status = response.status;
    throw error;
  }
  return body;
}

export function getOracleTaskStatus(taskEnvelope) {
  return String(taskEnvelope?.oracle?.task?.status || taskEnvelope?.status || '').trim().toUpperCase();
}

export function getOracleTaskResultData(taskEnvelope) {
  const result = taskEnvelope?.oracle?.task?.result || taskEnvelope?.result || null;
  if (!result) return null;
  if (result.data && typeof result.data === 'object') return result.data;
  if (typeof result === 'object') return result;
  return null;
}

export function getOracleTaskError(taskEnvelope) {
  return taskEnvelope?.oracle?.task?.error || taskEnvelope?.oracle?.error || taskEnvelope?.error || null;
}

export async function submitOracleGenericTask({
  taskType,
  payload,
  baseUrl,
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is unavailable.');
  }
  const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/generic-task`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskType,
      provider: 'oracle',
      payload,
      timeoutMs: 90000
    })
  });
  const body = await readJsonResponse(response);
  const task = body?.oracle?.task;
  if (!task?.taskId) {
    const error = new Error('Oracle did not return a task id.');
    error.code = 'ORACLE_TASK_ID_MISSING';
    throw error;
  }
  return body;
}

export async function getOracleGenericTaskStatus({
  taskId,
  baseUrl,
  fetchImpl = globalThis.fetch
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is unavailable.');
  }
  const response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/generic-task/${encodeURIComponent(taskId)}`, {
    method: 'GET',
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
  });
  return readJsonResponse(response);
}

export async function pollOracleGenericTask({
  taskId,
  baseUrl,
  fetchImpl = globalThis.fetch,
  wait = delay,
  timeoutMs = 90000,
  intervalMs = 1200,
  onState = () => {}
}) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = '';
  while (Date.now() < deadline) {
    const statusEnvelope = await getOracleGenericTaskStatus({ taskId, baseUrl, fetchImpl });
    const status = getOracleTaskStatus(statusEnvelope);
    if (status && status !== lastStatus) {
      lastStatus = status;
      onState(status.toLowerCase(), statusEnvelope);
    }
    if (status === 'COMPLETED') return statusEnvelope;
    if (status === 'FAILED' || status === 'CANCELLED') {
      const error = new Error('Oracle task failed.');
      error.code = 'ORACLE_TASK_FAILED';
      error.task = statusEnvelope;
      throw error;
    }
    await wait(intervalMs);
  }
  const error = new Error('Oracle task polling timed out.');
  error.code = 'ORACLE_TASK_TIMEOUT';
  throw error;
}
