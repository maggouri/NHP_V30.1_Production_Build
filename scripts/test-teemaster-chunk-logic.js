/**
 * Simulates TeeMaster batch chunking for large libraries (e.g. 93 designs).
 * Run: node scripts/test-teemaster-chunk-logic.js
 */

const CHUNK_BY_MODE = { ultra: 3, lite: 5, balanced: 15, performance: 20 };
const CHUNK_QUEUE_TIMEOUT_MS = 120000;
const CHUNK_PROCESS_TIMEOUT_MS = 300000;
const TIMEOUT_MIN_MS = 180000;
const TIMEOUT_MAX_MS = 3600000;

function getChunkSize(mode = 'balanced') {
  return CHUNK_BY_MODE[mode] ?? CHUNK_BY_MODE.balanced;
}

function buildChunks(total, chunkSize) {
  const size = Math.max(1, chunkSize);
  const chunks = [];
  for (let offset = 0; offset < total; offset += size) {
    chunks.push({ offset, size: Math.min(size, total - offset) });
  }
  return chunks;
}

function resolveChunkTimeouts(itemCount) {
  const n = Math.max(1, Number(itemCount) || 1);
  const clamp = (perItem, minMs) => Math.min(TIMEOUT_MAX_MS, Math.max(minMs, n * perItem));
  return {
    uploadTimeoutMs: Math.max(CHUNK_QUEUE_TIMEOUT_MS, clamp(4500, CHUNK_QUEUE_TIMEOUT_MS)),
    processIdleTimeoutMs: Math.max(CHUNK_PROCESS_TIMEOUT_MS, clamp(15000, CHUNK_PROCESS_TIMEOUT_MS))
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const total = 93;
const chunkSize = getChunkSize('balanced');
const chunks = buildChunks(total, chunkSize);

assert(chunks.length === 7, `expected 7 chunks, got ${chunks.length}`);
assert(chunks.reduce((sum, c) => sum + c.size, 0) === total, 'chunk sizes must sum to total');
assert(chunks[0].size === 15, 'first chunk should be 15');
assert(chunks[6].size === 3, 'last chunk should be 3 (15*6+3=93)');

const timeouts = resolveChunkTimeouts(chunkSize);
assert(timeouts.uploadTimeoutMs >= CHUNK_QUEUE_TIMEOUT_MS, 'chunk upload timeout must use chunk floor');
assert(timeouts.processIdleTimeoutMs >= CHUNK_PROCESS_TIMEOUT_MS, 'chunk process timeout must use chunk floor');
assert(timeouts.processIdleTimeoutMs >= TIMEOUT_MIN_MS, 'chunk process timeout must exceed legacy 3m cap');

const single = buildChunks(3, chunkSize);
assert(single.length === 1 && single[0].size === 3, 'small batch stays single chunk');

let simulatedSaved = 0;
for (const chunk of chunks) {
  simulatedSaved += chunk.size;
}
assert(simulatedSaved === total, 'all chunks must cover full batch');

console.log('✅ TeeMaster chunk logic OK');
console.log(`   ${total} designs @ chunk=${chunkSize} → ${chunks.length} rounds`);
console.log(`   Chunk timeouts @ ${chunkSize} items: upload=${timeouts.uploadTimeoutMs}ms process=${timeouts.processIdleTimeoutMs}ms`);
console.log(`   Progress example: TeeMaster 23/${total} — السحر الشامل... (mid-batch, not final)`);
