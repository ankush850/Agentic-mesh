import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { Version3Client } from "jira.js";

/**
 * One entry per demo app: the ticket to create in Jira and the local demo UI
 * (in demo/) that its acceptance criteria describe. Criteria are written in
 * Given/When/Then with concrete values so the generator + runner are deterministic.
 */
export interface DemoTicket {
  summary: string;
  description: string;
  demoFile: string;
  acceptanceCriteria: string[];
}

export const DEMO_TICKETS: DemoTicket[] = [
  {
    summary: "Calculator: add two numbers and show the sum",
    description: "As a user I want a simple calculator so that I can add two numbers and see the result.",
    demoFile: "demo/calculator.html",
    acceptanceCriteria: [
      "Given the calculator page, when the user types '5' into the first number field and '7' into the second number field and clicks Add, the result shows 'Sum: 12'",
      "Given the calculator page, when the user types '10' into the first number field and '4' into the second number field and clicks Add, the result shows 'Sum: 14'",
      "Given the calculator page, when the user leaves both number fields empty and clicks Add, the result shows 'Sum: 0'",
    ],
  },
  {
    summary: "Contact form: submit details and confirm or validate",
    description: "As a visitor I want to send a message so that the site owner can contact me.",
    demoFile: "demo/contact-form.html",
    acceptanceCriteria: [
      "Given the contact page, when the user fills Name with 'Amit', Email with 'amit@example.com', Message with 'Hello there' and clicks Submit, they should see 'Thank you, Amit! Your message has been sent.'",
      "Given the contact page, when the user leaves the Name field empty and clicks Submit, they should see the error 'Please fill all fields'",
      "Given the contact page, the heading 'Contact Us' should be visible",
    ],
  },
  {
    summary: "Notes: add notes to a list",
    description: "As a user I want to jot down quick notes so that I can remember them later.",
    demoFile: "demo/notes.html",
    acceptanceCriteria: [
      "Given the notes page, when the user types 'Buy milk' into the note input and clicks Add, the notes list should contain 'Buy milk'",
      "Given the notes page, when the user types 'Call mom' into the note input and clicks Add, the notes list should contain 'Call mom'",
      "Given the notes page, when the user clicks Add while the note input is empty, no new note should be added",
    ],
  },
  {
    summary: "Currency converter: convert USD to EUR",
    description: "As a traveller I want to convert US dollars to euros so that I know the local price.",
    demoFile: "demo/currency.html",
    acceptanceCriteria: [
      "Given the currency page, when the user types '100' into the amount field and clicks Convert to EUR, the result shows '100 USD = 85.00 EUR'",
      "Given the currency page, when the user types '200' into the amount field and clicks Convert to EUR, the result shows '200 USD = 170.00 EUR'",
      "Given the currency page, the heading 'Currency Converter' should be visible",
    ],
  },
  {
    summary: "Theme toggle: switch between light and dark mode",
    description: "As a user I want to toggle the colour theme so that I can read comfortably at night.",
    demoFile: "demo/theme-toggle.html",
    acceptanceCriteria: [
      "Given the theme page showing 'Light mode', when the user clicks Toggle Theme, the label should show 'Dark mode'",
      "Given the theme page showing 'Dark mode', when the user clicks Toggle Theme again, the label should show 'Light mode'",
      "Given the theme page, the initial label should show 'Light mode'",
    ],
  },
  {
    summary: "Fruit search: filter a list as you type",
    description: "As a user I want to search a list of fruits so that I can quickly find one.",
    demoFile: "demo/search-filter.html",
    acceptanceCriteria: [
      "Given the fruit search page, when the user types 'ap' into the search input, the list should show 'Apple' and hide 'Banana'",
      "Given the fruit search page, when the user types 'zzz' into the search input, they should see 'No results'",
      "Given the fruit search page, when the search input is empty, all four fruits 'Apple', 'Banana', 'Mango' and 'Grape' should be visible",
    ],
  },
  {
    summary: "Counter: increment and decrement a value",
    description: "As a user I want a counter so that I can track a running total.",
    demoFile: "demo/counter.html",
    acceptanceCriteria: [
      "Given the counter page showing '0', when the user clicks Increment twice, the count should show '2'",
      "Given the counter page showing '0', when the user clicks Decrement once, the count should show '-1'",
      "Given the counter page, the initial count should show '0'",
    ],
  },
  {
    summary: "BMI calculator: compute BMI and category",
    description: "As a user I want to compute my BMI so that I can understand if my weight is healthy.",
    demoFile: "demo/bmi.html",
    acceptanceCriteria: [
      "Given the BMI page, when the user types '1.75' into the Height field and '70' into the Weight field and clicks Calculate, the result shows '22.9 (Normal)'",
      "Given the BMI page, when the user types '1.60' into the Height field and '90' into the Weight field and clicks Calculate, the result shows '35.2 (Obese)'",
      "Given the BMI page, the heading 'BMI Calculator' should be visible",
    ],
  },
  {
    summary: "Password strength: rate a password as weak, medium or strong",
    description: "As a user I want live feedback on my password strength so that I choose a secure one.",
    demoFile: "demo/password-strength.html",
    acceptanceCriteria: [
      "Given the password strength page, when the user types 'abc' into the password input, the strength label should show 'Weak'",
      "Given the password strength page, when the user types 'Abc12345' into the password input, the strength label should show 'Medium'",
      "Given the password strength page, when the user types 'Abc12345!@#' into the password input, the strength label should show 'Strong'",
    ],
  },
  {
    summary: "Shopping list: add items to a list",
    description: "As a shopper I want to build a shopping list so that I do not forget anything.",
    demoFile: "demo/shopping-list.html",
    acceptanceCriteria: [
      "Given the shopping list page, when the user types 'Bread' into the item input and clicks Add, the list should contain 'Bread'",
      "Given the shopping list page, when the user types 'Milk' into the item input and clicks Add, the list should contain 'Milk'",
      "Given the shopping list page, the hint 'Your list is empty.' should be visible before any item is added",
    ],
  },
];

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

function buildDescription(t: DemoTicket): string {
  return [t.description, "", "Acceptance Criteria:", ...t.acceptanceCriteria].join("\n");
}

async function findIssueType(client: Version3Client, project: string): Promise<string> {
  const meta: any = await client.issues.getCreateIssueMeta({ projectIds: [], projectKeys: [project] });
  const types = (meta.projects?.[0]?.issuetypes ?? []).filter((t: any) => !t.subtask);
  const preferred =
    types.find((t: any) => t.name?.toLowerCase() === "story") ??
    types.find((t: any) => t.name?.toLowerCase() === "task") ??
    types[0];
  if (!preferred) throw new Error(`No creatable issue type found in project ${project}`);
  return String(preferred.id);
}

async function main() {
  const project = process.env.JIRA_PROJECT_KEY || "SQA";
  if (!process.env.JIRA_BASE_URL || !process.env.JIRA_EMAIL || !process.env.JIRA_API_TOKEN) {
    throw new Error("JIRA_BASE_URL / JIRA_EMAIL / JIRA_API_TOKEN are not set in .env");
  }

  const client = new Version3Client({
    host: process.env.JIRA_BASE_URL,
    authentication: { basic: { email: process.env.JIRA_EMAIL, apiToken: process.env.JIRA_API_TOKEN } },
  });

  console.log(`Seeding ${DEMO_TICKETS.length} tickets into ${project} @ ${process.env.JIRA_BASE_URL}\n`);
  const issueTypeId = await findIssueType(client, project);

  const manifest: { key: string; summary: string; demoFile: string; acceptanceCriteria: string[] }[] = [];
  for (const t of DEMO_TICKETS) {
    const created: any = await client.issues.createIssue({
      fields: {
        project: { key: project },
        issuetype: { id: issueTypeId },
        summary: t.summary,
        description: toAdf(buildDescription(t)) as any,
      },
    });
    console.log(`  ✔ ${created.key}  ${t.summary}  →  ${t.demoFile}`);
    manifest.push({ key: created.key, summary: t.summary, demoFile: t.demoFile, acceptanceCriteria: t.acceptanceCriteria });
  }

  const target = path.resolve("fixtures", "demo-tickets.json");
  fs.writeFileSync(target, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`\nCreated ${manifest.length} tickets. Manifest saved → ${target}`);
  console.log("Run any of them in the console: New Run → Fetch from Jira → <key>, target = the demo file.");
}

main().catch((error: any) => {
  const data = error?.response?.data;
  console.error("Seeding failed:", data ? JSON.stringify(data, null, 2) : (error as Error).message);
  process.exit(1);
});
