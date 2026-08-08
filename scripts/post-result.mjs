import "dotenv/config";

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
const [key, passed = "0", failed = "0", healed = "0"] = process.argv.slice(2);

if (!key) {
  console.error("Usage: node scripts/post-result.mjs <TICKET-KEY> <PASSED> <FAILED> <HEALED>");
  process.exit(1);
}

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error("Missing Jira configuration in .env.");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

const lines = [
  "🛡️ Agentic-mesh run completed",
  `Passed: ${passed} | Failed: ${failed} | Self-healed: ${healed}`,
  "Every repair is logged in reports/repairs.jsonl for human review.",
];

const body = {
  body: {
    type: "doc",
    version: 1,
    content: lines.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
  },
};

try {
  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${key}/comment`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    console.log(`\n✅ Comment posted to Jira issue ${key} (Status: ${res.status})`);
  } else {
    console.error(`\n❌ Failed to post comment (${res.status}):`, await res.text());
  }
} catch (err) {
  console.error("Error posting Jira comment:", err);
}

