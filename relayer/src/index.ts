import { getConfig } from '@astro-bridge/config';
import { RelayService } from './services/RelayService';
import { WatchdogService } from './services/WatchdogService';

async function main() {
  console.log('🌟 Starting AstroBridge Relayer Service...');
  const config = getConfig();

  const coordinatorUrl = `http://localhost:${config.PORT}`;
  const relayService = new RelayService(coordinatorUrl);
  const watchdogService = new WatchdogService(coordinatorUrl);

  // Relay loop: check every 5 seconds
  const relayInterval = setInterval(async () => {
    await relayService.tick();
  }, 5000);

  // Watchdog loop: check refunds every 15 seconds
  const watchdogInterval = setInterval(async () => {
    await watchdogService.checkRefunds();
  }, 15000);

  console.log('🚀 Relayer and Watchdog loops started.');

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🛑 Stopping relayer service gracefully...');
    clearInterval(relayInterval);
    clearInterval(watchdogInterval);
    console.log('👋 Relayer service stopped. Goodbye!');
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Fatal relayer error:', err);
  process.exit(1);
});
