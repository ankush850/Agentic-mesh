import "dotenv/config";

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY } = process.env;

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT_KEY) {
  console.error("Missing Jira configuration in .env. Ensure JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, and JIRA_PROJECT_KEY are set.");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64");

const criteria = [
  "Given the login page, when I enter test@example.com and Password123 and click login, then I see a welcome message.",
  "Given the login page, when I enter a wrong password, then I see 'Invalid email or password'.",
  "Given I am logged in, when I add 'Buy milk', then it appears in the task list.",
  "Given I am logged in, when I click logout, then I return to the login page.",
];

const adf = (paras) => ({
  type: "doc",
  version: 1,
  content: paras.map((t) => ({ type: "paragraph", content: [{ type: "text", text: t }] })),
});

try {
  const res = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        project: { key: JIRA_PROJECT_KEY },
        issuetype: { name: "Story" },
        summary: "User can log in and manage todo tasks",
        description: adf(["Acceptance Criteria:", ...criteria.map((c, i) => `${i + 1}. ${c}`)]),
      },
    }),
  });

  const data = await res.json();
  if (res.ok) {
    console.log(`\n✅ Jira Ticket Created Successfully!`);
    console.log(` • Ticket Key: ${data.key}`);
    console.log(` • URL:        ${JIRA_BASE_URL}/browse/${data.key}`);
  } else {
    console.error(`\n❌ Failed to create Jira ticket (${res.status}):`, data);
  }
} catch (err) {
  console.error("Error creating ticket:", err);
}

