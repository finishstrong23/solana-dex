import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { initDatabase } from './db';
import { startListener } from './listener';
import { startSnapshotJob } from './snapshots';
import { createApiServer } from './api';

const DEFAULT_PROGRAM_ID = 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS';
const DEFAULT_API_PORT = 3001;

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  Starforge DEX Indexer');
  console.log('========================================');

  // Configuration from environment variables
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl('devnet');
  const programIdStr = process.env.PROGRAM_ID || DEFAULT_PROGRAM_ID;
  const apiPort = parseInt(process.env.API_PORT || String(DEFAULT_API_PORT), 10);

  console.log(`[Config] RPC URL: ${rpcUrl}`);
  console.log(`[Config] Program ID: ${programIdStr}`);
  console.log(`[Config] API Port: ${apiPort}`);

  // Validate program ID
  let programId: PublicKey;
  try {
    programId = new PublicKey(programIdStr);
  } catch (err) {
    console.error(`[Error] Invalid program ID: ${programIdStr}`);
    process.exit(1);
  }

  // Initialize database
  console.log('[Init] Initializing database...');
  const db = initDatabase();

  // Create Solana connection
  const connection = new Connection(rpcUrl, {
    commitment: 'confirmed',
    wsEndpoint: rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://'),
  });

  // Verify connection
  try {
    const version = await connection.getVersion();
    console.log(`[Init] Connected to Solana (version: ${version['solana-core']})`);
  } catch (err) {
    console.error('[Error] Failed to connect to Solana RPC:', err);
    process.exit(1);
  }

  // Run backfill and start real-time listener
  console.log('[Init] Starting event listener...');
  let subscriptionId: number;
  try {
    subscriptionId = await startListener(connection, programId, db);
  } catch (err) {
    console.error('[Error] Failed to start listener:', err);
    // Continue running even if backfill/listener fails - API can still serve cached data
    subscriptionId = -1;
  }

  // Start snapshot job
  console.log('[Init] Starting snapshot job...');
  const snapshotInterval = startSnapshotJob(connection, programId, db);

  // Start API server
  const app = createApiServer(db);
  const server = app.listen(apiPort, () => {
    console.log(`[API] Server listening on http://localhost:${apiPort}`);
    console.log('========================================');
    console.log('  Indexer is running');
    console.log('========================================');
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log('\n[Shutdown] Shutting down gracefully...');

    clearInterval(snapshotInterval);
    console.log('[Shutdown] Snapshot job stopped');

    if (subscriptionId >= 0) {
      try {
        await connection.removeOnLogsListener(subscriptionId);
        console.log('[Shutdown] WebSocket listener removed');
      } catch (err) {
        console.error('[Shutdown] Error removing listener:', err);
      }
    }

    server.close(() => {
      console.log('[Shutdown] API server closed');
      db.close();
      console.log('[Shutdown] Database closed');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('[Shutdown] Forced exit after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[Fatal] Unhandled error:', err);
  process.exit(1);
});
