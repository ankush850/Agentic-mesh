import * as fs from "fs";
import * as path from "path";
import { RepairRecord, RepairRecordSchema } from "../types";
import { logger } from "../logger";

const DEFAULT_LOG_PATH = path.resolve(process.cwd(), "reports/repairs.jsonl");

export class RepairLogger {
  private filePath: string;

  constructor(customPath?: string) {
    this.filePath = customPath ? path.resolve(process.cwd(), customPath) : DEFAULT_LOG_PATH;
    this.ensureDirectory();
  }

  private ensureDirectory() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Appends a RepairRecord to reports/repairs.jsonl and logs via Pino.
   */
  public logRepair(record: RepairRecord): void {
    const validated = RepairRecordSchema.parse(record);
    this.ensureDirectory();

    const line = JSON.stringify(validated) + "\n";
    fs.appendFileSync(this.filePath, line, "utf-8");

    logger.info(
      {
        testId: validated.testId,
        stepIndex: validated.stepIndex,
        oldLocator: validated.oldLocator,
        newLocator: validated.newLocator,
        confidence: validated.confidence,
        modelUsed: validated.modelUsed,
      },
      `[SELF-HEALING] Repaired locator: "${validated.oldLocator}" -> "${validated.newLocator}" (${Math.round(validated.confidence * 100)}% conf)`
    );
  }

  /**
   * Reads all RepairRecords from the JSONL log file.
   */
  public getRepairs(): RepairRecord[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }

    const content = fs.readFileSync(this.filePath, "utf-8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    const records: RepairRecord[] = [];

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        const record = RepairRecordSchema.safeParse(parsed);
        if (record.success) {
          records.push(record.data);
        }
      } catch {
        // Skip corrupted line
      }
    }

    return records;
  }

  /**
   * Clears the repairs file.
   */
  public clearRepairs(): void {
    if (fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, "", "utf-8");
    }
  }
}

// Export default singleton instance
export const repairLogger = new RepairLogger();
export const logRepair = (record: RepairRecord) => repairLogger.logRepair(record);
export const getRepairs = () => repairLogger.getRepairs();
export const clearRepairs = () => repairLogger.clearRepairs();

