/**
 * MongoDB Replica Set Failover Test
 *
 * Simulates a primary node failure and validates that:
 *   - A new primary is elected automatically
 *   - Zero data is lost during the failover
 *   - Reads resume correctly from the new primary
 *
 * Prerequisites:
 *   1. Add to /etc/hosts (Mac/Linux) or
 *      C:\Windows\System32\drivers\etc\hosts (Windows):
 *        127.0.0.1  mongo1 mongo2 mongo3
 *
 *   2. Start the replica set:
 *        docker compose -f docker-compose.replset.yml up -d
 *
 *   3. Install dependencies and run:
 *        cd scripts && npm install && node test-replica-failover.js
 */

'use strict';

const { MongoClient } = require('mongodb');
const { execSync, spawnSync } = require('child_process');

// ── Config ─────────────────────────────────────────────────────────────────────
const RS_URI     = 'mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0&serverSelectionTimeoutMS=10000';
const DB_NAME    = 'failover_test';
const COLLECTION = 'documents';
const DOC_COUNT  = 100;
const POLL_MS    = 500;   // how often to check for new primary
const TIMEOUT_MS = 30000; // max time to wait for election

// ── Helpers ───────────────────────────────────────────────────────────────────
const sep  = () => console.log('='.repeat(72));
const line = () => console.log('-'.repeat(72));

const docker = (args) => {
  const result = spawnSync('docker', args, { encoding: 'utf8' });
  if (result.error) throw new Error(`docker ${args[0]} failed: ${result.error.message}`);
  return (result.stdout || '').trim();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getPrimary = async (client) => {
  const status = await client.db('admin').command({ replSetGetStatus: 1 });
  return status.members.find((m) => m.stateStr === 'PRIMARY') || null;
};

const getMembers = async (client) => {
  const status = await client.db('admin').command({ replSetGetStatus: 1 });
  return status.members;
};

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  sep();
  console.log('  MongoDB Replica Set Failover Test');
  sep();
  console.log();

  const results = {};
  let client;

  try {
    client = await MongoClient.connect(RS_URI);
    const db  = client.db(DB_NAME);
    const col = db.collection(COLLECTION);

    // ── Step 1: Replica set status ─────────────────────────────────────────
    console.log('[1/5] Replica set status');
    const members = await getMembers(client);
    let initialPrimary = null;
    const initialSecondaries = [];

    for (const m of members) {
      const shortName = m.name.split(':')[0];
      const port = { mongo1: 27017, mongo2: 27018, mongo3: 27019 }[shortName] || '?';
      if (m.stateStr === 'PRIMARY') {
        initialPrimary = { name: shortName, container: shortName, port };
        console.log(`  PRIMARY      ${shortName} (localhost:${port})`);
      } else if (m.stateStr === 'SECONDARY') {
        initialSecondaries.push({ name: shortName, container: shortName, port });
        console.log(`  SECONDARY    ${shortName} (localhost:${port})`);
      }
    }
    console.log();

    if (!initialPrimary) throw new Error('No primary found — is the replica set initialised?');

    results.initialPrimary     = `${initialPrimary.name} (localhost:${initialPrimary.port})`;
    results.initialSecondaries = initialSecondaries.map((s) => `${s.name}:${s.port}`).join(', ');

    // ── Step 2: Write documents ────────────────────────────────────────────
    console.log(`[2/5] Writing ${DOC_COUNT} documents (writeConcern: majority)`);
    await col.deleteMany({});

    const docs = Array.from({ length: DOC_COUNT }, (_, i) => ({
      index:     i,
      value:     `doc-${i}`,
      createdAt: new Date(),
    }));

    const writeStart = Date.now();
    await col.insertMany(docs, { writeConcern: { w: 'majority' } });
    const writeMs = Date.now() - writeStart;

    console.log(`  Inserted  : ${DOC_COUNT} documents`);
    console.log(`  Write time: ${writeMs} ms`);
    console.log(`  w:majority — data confirmed on ≥2 nodes before ack`);
    console.log();

    results.docsWritten = DOC_COUNT;
    results.writeTimeMs = writeMs;

    // ── Step 3: Pre-failover read ──────────────────────────────────────────
    console.log('[3/5] Pre-failover read check');
    const beforeCount = await col.countDocuments();
    console.log(`  Documents readable before failover: ${beforeCount}`);
    console.log();

    results.docsBeforeFailover = beforeCount;

    // ── Step 4: Stop the primary ───────────────────────────────────────────
    console.log(`[4/5] Stopping primary: ${initialPrimary.container} (localhost:${initialPrimary.port})`);
    docker(['stop', initialPrimary.container]);
    const stopTime = Date.now();
    console.log(`  ${initialPrimary.container} stopped at t=0`);
    console.log();

    results.containerStopped = initialPrimary.container;

    // ── Step 5: Wait for election ──────────────────────────────────────────
    console.log('[5/5] Waiting for election...');
    console.log();

    let newPrimary = null;
    let polls = 0;

    // Reconnect with a fresh client — the old connection's primary is gone
    await client.close();
    const remainingHosts = initialSecondaries.map((s) => `${s.name}:27017`).join(',');
    const fallbackUri = `mongodb://${remainingHosts}/?replicaSet=rs0&serverSelectionTimeoutMS=${TIMEOUT_MS}`;
    client = await MongoClient.connect(fallbackUri);

    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
      polls++;
      await sleep(POLL_MS);
      try {
        const p = await getPrimary(client);
        if (p) {
          newPrimary = p;
          break;
        }
      } catch {
        // Election in progress — retry
      }
      const elapsed = Date.now() - stopTime;
      process.stdout.write(`  t=${elapsed}ms  polls=${polls}  waiting...\r`);
    }

    if (!newPrimary) throw new Error(`No new primary elected within ${TIMEOUT_MS}ms`);

    const electionMs = Date.now() - stopTime;
    console.log();
    const newName = newPrimary.name.split(':')[0];
    const newPort = { mongo1: 27017, mongo2: 27018, mongo3: 27019 }[newName] || '?';
    console.log(`  New primary: ${newName} (localhost:${newPort})`);
    console.log(`  Election time: ${electionMs} ms  (${polls} polls × ${POLL_MS} ms)`);
    console.log();

    results.electionTimeMs = electionMs;
    results.pollAttempts   = polls;
    results.newPrimary     = `${newName} (localhost:${newPort})`;

    // Restart the stopped node so it rejoins as a secondary
    console.log(`  Restarting ${initialPrimary.container} (rejoins as secondary)...`);
    docker(['start', initialPrimary.container]);
    console.log(`  ${initialPrimary.container} restarted`);

    // ── Verify data after failover ─────────────────────────────────────────
    const afterCol   = client.db(DB_NAME).collection(COLLECTION);
    const readStart  = Date.now();
    const afterCount = await afterCol.countDocuments();
    const readMs     = Date.now() - readStart;
    const lostDocs   = DOC_COUNT - afterCount;

    results.docsAfterFailover = afterCount;
    results.readTimeAfterMs   = readMs;
    results.dataLoss          = lostDocs;

    // ── Summary ────────────────────────────────────────────────────────────
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
    console.log(`${pad('Total test duration:')}${Date.now() - stopTime + writeMs} ms`);
    console.log();

    if (lostDocs === 0) {
      console.log('  RESULT: PASS — zero data loss, failover successful');
    } else {
      console.log(`  RESULT: FAIL — ${lostDocs} document(s) lost during failover`);
    }

    console.log();
    sep();

    // Clean up test data
    await afterCol.deleteMany({});

    return lostDocs === 0 ? 0 : 1;

  } catch (err) {
    console.error('\n  ERROR:', err.message);
    console.error('\n  Is the replica set running?');
    console.error('  docker compose -f docker-compose.replset.yml up -d\n');
    console.error('  Do mongo1/mongo2/mongo3 resolve to 127.0.0.1?');
    console.error('  Add to /etc/hosts:  127.0.0.1  mongo1 mongo2 mongo3\n');
    return 1;
  } finally {
    if (client) await client.close();
  }
}

main().then((code) => process.exit(code));
