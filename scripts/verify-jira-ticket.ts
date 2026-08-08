import "dotenv/config";
import { JiraClient } from "../src/jira/jiraClient";

async function main() {
  const client = new JiraClient({ strict: true });
  const ticket = await client.fetchTicket(process.argv[2] || "SQA-1");

  console.log("Fetched real ticket from Jira:");
  console.log(JSON.stringify(ticket, null, 2));

  const ok = await client.postResult(
    ticket.key,
    "Agentic-mesh connected this ticket end-to-end (fetch + comment).",
  );
  console.log(`\nPosted result comment back to ${ticket.key}: ${ok ? "OK" : "FAILED"}`);
}

main().catch((error) => {
  console.error("Verification failed:", (error as Error).message);
  process.exit(1);
});
