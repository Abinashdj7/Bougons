/**
 * MongoDB Replica Set Failover Test
 *
 * Uses directConnection to localhost:27017/27018/27019 — no /etc/hosts
 * changes required.
 *
 * Prerequisites:
 *   docker compose -f docker-compose.replset.yml up -d
 *   cd scripts && npm install && node test-replica-failover.js
 */

'use strict';

const { MongoClient } = require('mongodb');
const { spawnSync }   = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────
const NODES = [
  { label: 'mongo1', container: 'mongo1', port: 27017 },
  { label: 'mongo2', container: 'mongo2', port: 27018 },
  { label: 'mongo3', container: 'mongo3', port: 27019 },
];

const DB_NAME    = 'failover_test';
const COLLECTION = 'documents';
const DOC_COUNT  = 100;
const POLL_MS    = 500;
const TIMEOUT_MS = 30000;

// ── Helpers ───────────────────────────────────────────────────────────────────
const sep  = () => console.log('='.repeat(72));

const docker = (args) => {
  const r = spawnSync('docker', args, { encoding: 'utf8' });
  if (r.error) throw new Error(`docker ${args[0]}: ${r.error.message}`);
  return (r.stdout || '').trim();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Open a direct connection to a single node (bypasses replica-set routing)
const openDirect = (port, timeoutMs = 5000) =>
  MongoClient.connect(
    `mongodb://localhost:${port}/?directConnection=true&serverSelectionTimeoutMS=${timeoutMs}`
  );

// Returns the node object if this port is currently the PRIMARY, else null
const getPrimaryNode = async (node) => {
  let client;
  try {
    client = await openDirect(node.port, 3000);
    const hello = await client.db('admin').command({ hello: 1 });
    return hello.isWritablePrimary ? node : null;
  } catch {
    return null;
  } finally {
    if (client) await client.close().catch(() => {});
  }
};

// Scans all nodes and returns the first one that is PRIMARY
const findPrimary = async () => {
  for (const node of NODES) {
    const primary = await getPrimaryNode(node);
    if (primary) return primary;
  }
  return null;
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  sep();
  console.log('  MongoDB Replica Set Failover Test');
  sep();
  console.log();

  const results = {};

  // ── Step 1: Replica set status ─────────────────────────────────────────────
  console.log('[1/5] Replica set status');

  let initialPrimary = null;
  const initialSecondaries = [];

  for (const node of NODES) {
    let client;
    try {
      client = await openDirect(node.port, 5000);
      const hello = await client.db('admin').command({ hello: 1 });
      if (hello.isWritablePrimary) {
        initialPrimary = node;
        console.log(`  PRIMARY      ${node.label} (localhost:${node.port})`);
      } else if (hello.secondary) {
        initialSecondaries.push(node);
        console.log(`  SECONDARY    ${node.label} (localhost:${node.port})`);
      } else {
        console.log(`  UNKNOWN      ${node.label} (localhost:${node.port}) — state: ${hello.msg || '?'}`);
      }
    } catch (err) {
      console.log(`  UNREACHABLE  ${node.label} (localhost:${node.port}) — ${err.message}`);
    } finally {
      if (client) await client.close().catch(() => {});
    }
  }

  console.log();

  if (!initialPrimary) {
    throw new Error(
      'No PRIMARY found.\n' +
      '  Is the replica set up?  docker compose -f docker-compose.replset.yml up -d\n' +
      '  Allow ~30s for election after first start.'
    );
  }

  results.initialPrimary     = `${initialPrimary.label} (localhost:${initialPrimary.port})`;
  results.initialSecondaries = initialSecondaries.map((s) => `${s.label}:${s.port}`).join(', ');

  // ── Step 2: Write documents ────────────────────────────────────────────────
  console.log(`[2/5] Writing ${DOC_COUNT} documents (writeConcern: majority)`);

  const writeClient = await openDirect(initialPrimary.port);
  const col = writeClient.db(DB_NAME).collection(COLLECTION);
  await col.deleteMany({});

  const docs = Array.from({ length: DOC_COUNT }, (_, i) => ({
    index: i, value: `doc-${i}`, createdAt: new Date(),
  }));

  const writeStart = Date.now();
  await col.insertMany(docs, { writeConcern: { w: 'majority' } });
  const writeMs = Date.now() - writeStart;
  await writeClient.close();

  console.log(`  Inserted  : ${DOC_COUNT} documents`);
  console.log(`  Write time: ${writeMs} ms`);
  console.log(`  w:majority — data confirmed on ≥2 nodes before ack`);
  console.log();

  results.docsWritten = DOC_COUNT;
  results.writeTimeMs = writeMs;

  // ── Step 3: Pre-failover read ──────────────────────────────────────────────
  console.log('[3/5] Pre-failover read check');
  const readClient1 = await openDirect(initialPrimary.port);
  const beforeCount = await readClient1.db(DB_NAME).collection(COLLECTION).countDocuments();
  await readClient1.close();
  console.log(`  Documents readable before failover: ${beforeCount}`);
  console.log();

  results.docsBeforeFailover = beforeCount;

  // ── Step 4: Stop the primary ───────────────────────────────────────────────
  console.log(`[4/5] Stopping primary: ${initialPrimary.label} (localhost:${initialPrimary.port})`);
  docker(['stop', initialPrimary.container]);
  const stopTime = Date.now();
  console.log(`  ${initialPrimary.container} stopped at t=0`);
  console.log();

  results.containerStopped = initialPrimary.container;

  // ── Step 5: Wait for election ──────────────────────────────────────────────
  console.log('[5/5] Waiting for election...');
  console.log();

  let newPrimary = null;
  let polls = 0;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    polls++;
    await sleep(POLL_MS);
    const elapsed = Date.now() - stopTime;
    process.stdout.write(`  t=${elapsed}ms  polls=${polls}  waiting...   \r`);

    // Only check secondaries — the stopped container is unreachable
    for (const node of initialSecondaries) {
      const p = await getPrimaryNode(node);
      if (p) { newPrimary = p; break; }
    }
    if (newPrimary) break;
  }

  const electionMs = Date.now() - stopTime;

  if (!newPrimary) throw new Error(`No new primary elected within ${TIMEOUT_MS}ms`);

  console.log();
  console.log(`  New primary: ${newPrimary.label} (localhost:${newPrimary.port})`);
  console.log(`  Election time: ${electionMs} ms  (${polls} polls × ${POLL_MS} ms)`);
  console.log();

  results.electionTimeMs = electionMs;
  results.pollAttempts   = polls;
  results.newPrimary     = `${newPrimary.label} (localhost:${newPrimary.port})`;

  // Restart the stopped node — rejoins as secondary
  console.log(`  Restarting ${initialPrimary.container} (rejoins as secondary)...`);
  docker(['start', initialPrimary.container]);
  console.log(`  ${initialPrimary.container} restarted`);

  // ── Verify data after failover ─────────────────────────────────────────────
  const readClient2 = await openDirect(newPrimary.port);
  const readStart   = Date.now();
  const afterCount  = await readClient2.db(DB_NAME).collection(COLLECTION).countDocuments();
  const readMs      = Date.now() - readStart;
  await readClient2.db(DB_NAME).collection(COLLECTION).deleteMany({});
  await readClient2.close();

  const lostDocs = DOC_COUNT - afterCount;
  const totalMs  = Date.now() - (stopTime - writeMs);

  results.docsAfterFailover = afterCount;
  results.readTimeAfterMs   = readMs;
  results.dataLoss          = lostDocs;

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log();
  sep();
  console.log('  RESULTS');
  sep();
  console.log();

  const pad = (label) => `  ${label.padEnd(38)}`;
  console.log(`${pad('Initial primary:')}${results.initialPrimary}`);
  console.log(`${pad('Initial secondaries:')}${results.initialSecondaries}`);
  console.log(`${pad('Documents written:')}${results.docsWritten}`);
  console.log(`${pad('Write time:')}${results.writeTimeMs} ms`);
  console.log(`${pad('Documents before failover:')}${results.docsBeforeFailover}`);
  console.log(`${pad('Container stopped:')}${results.containerStopped}`);
  console.log(`${pad('Election time:')}${results.electionTimeMs} ms`);
  console.log(`${pad('Poll attempts:')}${results.pollAttempts}`);
  console.log(`${pad('New primary:')}${results.newPrimary}`);
  console.log(`${pad('Documents after failover:')}${results.docsAfterFailover}`);
  console.log(`${pad('Read time after failover:')}${results.readTimeAfterMs} ms`);
  console.log(`${pad('Data loss:')}${results.dataLoss} documents`);
  console.log(`${pad('Total test duration:')}${totalMs} ms`);
  console.log();

  if (lostDocs === 0) {
    console.log('  RESULT: PASS — zero data loss, failover successful');
  } else {
    console.log(`  RESULT: FAIL — ${lostDocs} document(s) lost during failover`);
  }

  console.log();
  sep();

  return lostDocs === 0 ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error('\n  ERROR:', err.message);
    console.error();
    process.exit(1);
  });
