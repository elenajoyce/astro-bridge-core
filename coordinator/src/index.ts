import express from 'express';
import cors from 'cors';
import { getConfig } from '@astro-bridge/config';
import { Persistence } from './persistence';
import { QuoteService } from './services/QuoteService';
import { SecretService } from './services/SecretService';
import { OrderService } from './services/OrderService';
import { createRouter } from './server/routes';
import { EthereumListener } from './listeners/EthereumListener';
import { SorobanListener } from './listeners/SorobanListener';
import { SolanaListener } from './listeners/SolanaListener';

async function main() {
  console.log('🌟 Starting AstroBridge Coordinator Service...');

  // 1. Load config
  const config = getConfig();

  // 2. Init database persistence
  const persistence = new Persistence(config.DATABASE_URL);
  await persistence.init();
  console.log('💾 Database persistence layer initialized successfully.');

  // 3. Init services
  const quoteService = new QuoteService();
  const secretService = new SecretService(persistence);
  const orderService = new OrderService(persistence, quoteService);

  // 4. Start Blockchain Listeners
  // EVM Escrow contract deployment addresses will be loaded or fallback to default
  const evmEscrowAddress = process.env.ETHEREUM_ESCROW_ADDRESS || '0xb352339BEb000000000000000000000000000178';
  const ethListener = new EthereumListener(config.ETHEREUM_RPC_URL, evmEscrowAddress, orderService);
  ethListener.start();

  const sorobanHtlcId = process.env.STELLAR_HTLC_PROGRAM || 'CDIKSJKV00000000000000000000000000000000000000000000CTA6JK';
  const sorobanRpcUrl = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org';
  const sorobanListener = new SorobanListener(sorobanRpcUrl, sorobanHtlcId, orderService);
  await sorobanListener.start();

  const solanaListener = new SolanaListener(
    orderService,
    config.SOLANA_RPC_URL,
    config.SOLANA_HTLC_PROGRAM
  );
  solanaListener.start();

  // 5. Start Express API Server
  const app = express();
  app.use(cors());
  app.use(express.json());

  const apiRouter = createRouter(orderService, quoteService, secretService);
  app.use('/api', apiRouter);

  // Healthcheck at root
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: Date.now() });
  });

  const server = app.listen(config.PORT, () => {
    console.log(`🚀 HTTP API Server listening on port ${config.PORT}`);
    console.log(`📊 Metrics available at http://localhost:${config.PORT}/api/metrics`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Shutting down coordinator service gracefully...');
    server.close();
    ethListener.stop();
    sorobanListener.stop();
    solanaListener.stop();
    await persistence.close();
    console.log('👋 Coordinator service stopped. Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
