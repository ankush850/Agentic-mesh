import "dotenv/config";
import { Version3Client } from "jira.js";

const client = new Version3Client({
  host: process.env.JIRA_BASE_URL!,
  authentication: {
    basic: { email: process.env.JIRA_EMAIL!, apiToken: process.env.JIRA_API_TOKEN! },
  },
});

const project = process.env.JIRA_PROJECT_KEY || "SQA";

/** A plain-text acceptance-criteria description the parser understands. */
const DEMO_DESCRIPTION = [
  "As a registered user, I want to securely log in, manage my daily tasks, and safely log out.",
  "",
  "Acceptance Criteria:",
  "Given the user is on the login page, when they enter valid username 'admin' and password 'password123' and click Login, they should see the dashboard and greeting 'Welcome, admin!'",
  "Given the user is on the login page, when they enter invalid credentials 'admin' and 'wrongpass' and click Login, they should see an error message 'Invalid username or password'",
  "Given the user is logged into the dashboard, when they type 'Deploy Agentic-mesh' into the task input and click Add Task, the new item should appear in the todo list",
  "Given the user is on the dashboard, when they click Logout, they should be redirected back to the login screen",
].join("\n");

async function findIssueType(): Promise<string> {
  const meta: any = await client.issues.getCreateIssueMeta({
    projectIds: [],
    projectKeys: [project],
  });
  const types = (meta.projects?.[0]?.issuetypes ?? []).filter((t: any) => !t.subtask);
  const preferred =
    types.find((t: any) => t.name?.toLowerCase() === "story") ??
    types.find((t: any) => t.name?.toLowerCase() === "task") ??
    types[0];
  if (!preferred) throw new Error(`No creatable issue type found in project ${project}`);
  console.log(`Using issue type: ${preferred.name} (id ${preferred.id})`);
  return String(preferred.id);
}

/** Wraps plain-text lines into the Atlassian Document Format the REST API expects. */
function toAdf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: text.split("\n").map((line) => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

async function main() {
  console.log(`Connecting to ${process.env.JIRA_BASE_URL} (project ${project})...`);

  const search: any = await client.issueSearch.searchForIssuesUsingJqlEnhancedSearch({
    jql: `project = ${project} ORDER BY created DESC`,
    maxResults: 25,
    fields: ["summary"],
  });
  const existing = search.issues ?? search ?? [];
  console.log(`\nExisting issues in ${project}:`);
  if (!existing.length) {
    console.log("  (none)");
  }
  for (const issue of existing) {
    console.log(`  - ${issue.key}: ${issue.fields?.summary}`);
  }

  const issueTypeId = await findIssueType();
  const created: any = await client.issues.createIssue({
    fields: {
      project: { key: project },
      issuetype: { id: issueTypeId },
      summary: "User Authentication and Todo Management Flow",
      description: toAdf(DEMO_DESCRIPTION) as any,
    },
  });

  console.log(`\nCreated real ticket ${created.key}: ${created.fields?.summary}`);
  console.log(`Use this key in the Agentic-mesh console → New Run → "SQA-…" = ${created.key}`);
}

main().catch((error: any) => {
  const data = error?.response?.data;
  if (data) {
    console.error("Jira operation failed:", JSON.stringify(data, null, 2));
  } else {
    console.error("Jira operation failed:", (error as Error).message);
  }
  process.exit(1);
});
