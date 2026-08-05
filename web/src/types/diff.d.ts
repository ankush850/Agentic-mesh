declare module "diff" {
  export interface Change {
    value: string;
    added?: boolean;
    removed?: boolean;
    count?: number;
  }

  export function diffChars(oldText: string, newText: string): Change[];
  export function diffWords(oldText: string, newText: string): Change[];
  export function diffLines(oldText: string, newText: string): Change[];
}
