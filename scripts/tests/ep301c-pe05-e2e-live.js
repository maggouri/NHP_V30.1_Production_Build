/**
 * PE-05 live E2E API journey against Creaty server :3020
 * Run: node scripts/tests/ep301c-pe05-e2e-live.js
 */
'use strict';

const BASE = 'http://127.0.0.1:3020';
const AUTH = {
  userId: 'user_a',
  token: 'tok_test',
  headers: {
    'content-type': 'application/json',
    'x-creaty-token': 'tok_test',
  },
};

const results = [];

function log(step, status, detail) {
  results.push({ step, status, detail });
  console.log(`\n=== ${step} ===`);
  console.log(`STATUS: ${status}`);
  if (detail) console.log(JSON.stringify(detail, null, 2));
}

async function request(method, path, { body, query } = {}) {
  let url = `${BASE}${path}`;
  if (query) {
    const qs = new URLSearchParams(query).toString();
    if (qs) url += `?${qs}`;
  }
  const res = await fetch(url, {
    method,
    headers: AUTH.headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  // Step 0: Health / ping
  const pingRes = await fetch(`${BASE}/ping`);
  const ping = await pingRes.json();
  log('Health/Ping', pingRes.status === 200 && ping.mailboxLifecycleApiVersion >= 1 ? 'PASS' : 'FAIL', {
    httpStatus: pingRes.status,
    mailboxLifecycleApiVersion: ping.mailboxLifecycleApiVersion,
    service: ping.service,
    port: ping.port,
  });

  const mblPing = await fetch(`${BASE}/api/mailbox-lifecycle/ping`);
  const mblPingData = await mblPing.json();
  log('Mailbox Lifecycle Ping', mblPing.status === 200 ? 'PASS' : 'FAIL', {
    httpStatus: mblPing.status,
    version: mblPingData.version,
    steps: mblPingData.steps,
  });

  // Step 1: Login (auth via headers — domains list proves auth)
  const domains = await request('GET', '/api/mailbox-lifecycle/domains', {
    query: { userId: AUTH.userId },
  });
  log('Login/Auth', domains.status === 200 ? 'PASS' : 'FAIL', {
    httpStatus: domains.status,
    domainCount: domains.data?.domains?.length,
    sampleDomain: domains.data?.domains?.[0]?.name,
    code: domains.data?.code,
  });

  // Step 2: Choose Domain + create workflow
  const created = await request('POST', '/api/mailbox-lifecycle/workflows', {
    body: { userId: AUTH.userId, domain: 'emailcore.app' },
  });
  const workflowId = created.data?.workflow?.id;
  log('Choose Domain + Workflow', created.status === 201 && workflowId ? 'PASS' : 'FAIL', {
    httpStatus: created.status,
    workflowId,
    step: created.data?.workflow?.step,
    domain: created.data?.workflow?.domain?.name,
  });

  if (!workflowId) {
    console.log('\n--- E2E aborted: no workflow id ---');
    process.exit(1);
  }

  // Step 3: Create Mailbox (generate) — may fail without live EmailCore
  const generate = await request('POST', `/api/mailbox-lifecycle/workflows/${workflowId}/mailbox/generate`, {
    body: { userId: AUTH.userId, count: 1, apiBase: 'https://emailcore.app' },
  });
  const generateOk = generate.status === 200 && generate.data?.workflow?.mailbox?.address;
  log('Create Mailbox (generate)', generateOk ? 'PASS' : 'PARTIAL/FAIL', {
    httpStatus: generate.status,
    code: generate.data?.code,
    message: generate.data?.message,
    mailboxAddress: generate.data?.workflow?.mailbox?.address,
    sessionId: generate.data?.workflow?.mailbox?.sessionId,
    step: generate.data?.workflow?.step,
  });

  if (!generateOk) {
    // Document remaining steps as blocked
    for (const blocked of ['Validate', 'Connection Settings', 'Ready']) {
      log(blocked, 'BLOCKED', { reason: 'mailbox create failed — needs live EmailCore credentials' });
    }
    return;
  }

  // Step 4: Validate
  const validate = await request('POST', `/api/mailbox-lifecycle/workflows/${workflowId}/validate`, {
    body: { userId: AUTH.userId, apiBase: 'https://emailcore.app' },
  });
  const validateOk = validate.status === 200 && validate.data?.validation?.ok;
  log('Validate', validateOk ? 'PASS' : 'PARTIAL/FAIL', {
    httpStatus: validate.status,
    code: validate.data?.code,
    validationOk: validate.data?.validation?.ok,
    step: validate.data?.workflow?.step,
  });

  // Step 5: Mailbox Created (implicit in validate success)
  log('Mailbox Created', validateOk ? 'PASS' : 'FAIL', {
    address: validate.data?.workflow?.mailbox?.address,
    sessionId: validate.data?.workflow?.mailbox?.sessionId,
    domain: validate.data?.workflow?.domain?.name,
  });

  if (!validateOk) {
    for (const blocked of ['Connection Settings', 'Ready']) {
      log(blocked, 'BLOCKED', { reason: 'validation failed' });
    }
    return;
  }

  // Step 6: Connection settings
  const conn = await request('GET', `/api/mailbox-lifecycle/workflows/${workflowId}/connection`, {
    query: { userId: AUTH.userId, apiBase: 'https://emailcore.app' },
  });
  log('Connection Settings (read)', conn.status === 200 ? 'PASS' : 'FAIL', {
    httpStatus: conn.status,
    userId: conn.data?.connection?.userId,
    sessionId: conn.data?.connection?.sessionId,
    mailboxAddress: conn.data?.connection?.mailboxAddress,
  });

  const connVerify = await request('POST', `/api/mailbox-lifecycle/workflows/${workflowId}/connection/verify`, {
    body: { userId: AUTH.userId, apiBase: 'https://emailcore.app' },
  });
  const connOk = connVerify.status === 200 && connVerify.data?.connection?.verified;
  log('Connection Verify', connOk ? 'PASS' : 'PARTIAL/FAIL', {
    httpStatus: connVerify.status,
    code: connVerify.data?.code,
    verified: connVerify.data?.connection?.verified,
  });

  if (!connOk) {
    log('Ready', 'BLOCKED', { reason: 'connection verify failed' });
    return;
  }

  // Step 7: Ready
  const ready = await request('POST', `/api/mailbox-lifecycle/workflows/${workflowId}/ready`, {
    body: { userId: AUTH.userId },
  });
  const readyOk = ready.status === 200 && ready.data?.workflow?.ready === true;
  log('Ready', readyOk ? 'PASS' : 'FAIL', {
    httpStatus: ready.status,
    step: ready.data?.workflow?.step,
    status: ready.data?.workflow?.status,
    ready: ready.data?.workflow?.ready,
  });

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status.includes('FAIL') || r.status === 'BLOCKED').length;
  console.log(`\n=== SUMMARY: ${passCount} PASS, ${failCount} FAIL/BLOCKED/PARTIAL ===`);
}

main().catch((err) => {
  console.error('E2E script error:', err);
  process.exit(1);
});
