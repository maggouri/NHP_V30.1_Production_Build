import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getOracleTaskResultData,
  pollOracleGenericTask,
  submitOracleGenericTask
} from './oracleTaskAdapter.mjs';

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    }
  };
}

test('submits ANALYZE_SINGLE_NICHE through EmailCore Oracle admin route', async () => {
  const calls = [];
  const result = await submitOracleGenericTask({
    taskType: 'ANALYZE_SINGLE_NICHE',
    payload: { niche: 'Haaland' },
    baseUrl: 'https://emailcore.test/api/admin/oracle/',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        oracle: {
          ok: true,
          task: { taskId: 'task-1', type: 'ANALYZE_SINGLE_NICHE', status: 'PENDING' }
        }
      }, { status: 202 });
    }
  });

  assert.equal(calls[0].url, 'https://emailcore.test/api/admin/oracle/generic-task');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(JSON.parse(calls[0].options.body).taskType, 'ANALYZE_SINGLE_NICHE');
  assert.deepEqual(JSON.parse(calls[0].options.body).payload, { niche: 'Haaland' });
  assert.equal(result.oracle.task.taskId, 'task-1');
});

test('polls canonical task status and exposes result data', async () => {
  const responses = [
    jsonResponse({ oracle: { ok: true, task: { taskId: 'task-1', status: 'PROCESSING' } } }),
    jsonResponse({
      oracle: {
        ok: true,
        task: {
          taskId: 'task-1',
          status: 'COMPLETED',
          result: {
            data: {
              command: 'ANALYZE_SINGLE_NICHE',
              niche: 'Haaland',
              classification: 'sat',
              summary: { maxPage: 7 }
            }
          }
        }
      }
    })
  ];

  const completed = await pollOracleGenericTask({
    taskId: 'task-1',
    baseUrl: 'https://emailcore.test/api/admin/oracle',
    fetchImpl: async () => responses.shift(),
    wait: async () => {},
    timeoutMs: 1000
  });
  const data = getOracleTaskResultData(completed);

  assert.equal(data.command, 'ANALYZE_SINGLE_NICHE');
  assert.equal(data.classification, 'sat');
  assert.equal(data.summary.maxPage, 7);
});
