import { TestCase } from "../types";

export function exportToPlaywrightSpec(tests: TestCase[], baseUrl = "http://localhost:3000"): string {
  const lines: string[] = [
    `import { test, expect } from '@playwright/test';`,
    ``,
    `// Autonomously generated and healed Playwright spec from SentinelQA`,
    `test.describe('Synthesized & Self-Healed Test Suite', () => {`,
    `  test.beforeEach(async ({ page }) => {`,
    `    await page.goto('${baseUrl}');`,
    `  });`,
    ``
  ];

  for (const t of tests) {
    lines.push(`  test('${t.title.replace(/'/g, "\\'")}', async ({ page }) => {`);
    for (const step of t.steps) {
      if (step.action === "click" && step.selector) {
        lines.push(`    await page.locator('${step.selector}').click();`);
      } else if (step.action === "type" && step.selector) {
        lines.push(`    await page.locator('${step.selector}').fill('${step.value || ""}');`);
      } else if (step.action === "navigate") {
        lines.push(`    await page.goto('${step.url || baseUrl}');`);
      } else if (step.action === "assert") {
        lines.push(`    // Assertion: ${step.description}`);
      }
    }
    lines.push(`  });`);
    lines.push(``);
  }

  lines.push(`});`);
  return lines.join("\n");
}
