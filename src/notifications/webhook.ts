import { logger } from "../logger";

export interface DiscordEmbed {
  title: string;
  description: string;
  color?: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
}

export async function broadcastWebhook(title: string, description: string, fields: Array<{ name: string; value: string; inline?: boolean }> = [], isFailure = false): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    logger.debug("DISCORD_WEBHOOK_URL not configured. Skipping broadcast.");
    return false;
  }

  const payload = {
    embeds: [
      {
        title: `🛡️ SentinelQA: ${title}`,
        description,
        color: isFailure ? 0xe11d48 : 0x10b981, // Red or Emerald
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "SentinelQA Autonomous Quality & SRE Engine" }
      }
    ]
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err) {
    logger.warn({ err }, "Failed to send Discord webhook broadcast");
    return false;
  }
}
