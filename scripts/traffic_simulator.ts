/**
 * Continuous 1-Second Traffic Simulator
 * Generates continuous synthetic requests against mock microservices
 * with configurable RPS and error logging.
 */

interface TrafficStats {
  totalSent: number;
  success: number;
  failed: number;
}

const stats: TrafficStats = { totalSent: 0, success: 0, failed: 0 };

async function pingService(url: string, options?: RequestInit) {
  stats.totalSent++;
  try {
    const res = await fetch(url, options);
    if (res.ok) {
      stats.success++;
    } else {
      stats.failed++;
      console.warn(`[TrafficSimulator] HTTP ${res.status} from ${url}`);
    }
  } catch (err) {
    stats.failed++;
    console.error(`[TrafficSimulator] Error contacting ${url}:`, (err as Error).message);
  }
}

async function loop() {
  console.log("[TrafficSimulator] Starting continuous 1-second pulse generator...");
  
  setInterval(async () => {
    // 1. Auth service health
    await pingService("http://localhost:3001/health");

    // 2. Payment service checkout / health
    await pingService("http://localhost:3002/process-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: Math.floor(Math.random() * 100) + 1, currency: "USD" })
    });

    // 3. Ingestion ping
    await pingService("http://localhost:3003/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "heartbeat",
        timestamp: new Date().toISOString()
      })
    });

    if (stats.totalSent % 15 === 0) {
      console.log(`[TrafficSimulator Stats] Total: ${stats.totalSent} | Success: ${stats.success} | Errors: ${stats.failed}`);
    }
  }, 1000);
}

loop();
