import { ElementCandidate } from "../types";

const COMMON_COMPOUNDS: Record<string, string[]> = {
  username: ["user", "name", "account"],
  password: ["pass", "password", "secret", "key"],
  passcode: ["pass", "code"],
  signin: ["sign", "in", "login", "auth"],
  signup: ["sign", "up", "register"],
  login: ["log", "in", "login", "auth", "submit"],
  logout: ["log", "out", "logout", "exit", "terminate", "session"],
  todo: ["task", "todo", "item", "entry"],
  task: ["task", "todo", "item", "entry"],
  submit: ["submit", "send", "action", "auth"],
};

/**
 * Calculates Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1,     // deletion
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Normalized string similarity score between 0 and 1.
 */
export function stringSimilarity(a: string, b: string): number {
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    return 0.8 + 0.2 * (minLen / maxLen);
  }

  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Tokenizes identifier string (camelCase, snake_case, kebab-case, whitespace, and compound words).
 */
export function tokenize(str: string): Set<string> {
  const tokens = str
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-.:#[\]='"]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  const resultSet = new Set<string>(tokens);

  // Expand with compound synonyms
  for (const t of tokens) {
    if (COMMON_COMPOUNDS[t]) {
      COMMON_COMPOUNDS[t].forEach((syn) => resultSet.add(syn));
    }
    // Check if any compound key is a substring
    for (const [key, syns] of Object.entries(COMMON_COMPOUNDS)) {
      if (t.includes(key) || key.includes(t)) {
        syns.forEach((syn) => resultSet.add(syn));
      }
    }
  }

  return resultSet;
}

/**
 * Jaccard / substring similarity between two token sets.
 */
export function tokenOverlap(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const itemA of setA) {
    if (setB.has(itemA)) {
      intersection += 1;
    } else {
      // Check partial substring match (e.g. 'user' in 'username')
      for (const itemB of setB) {
        if (itemA.length >= 3 && itemB.length >= 3) {
          if (itemA.includes(itemB) || itemB.includes(itemA)) {
            intersection += 0.75;
            break;
          }
        }
      }
    }
  }

  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : Math.min(1.0, intersection / union);
}

/**
 * Parses intent from an old selector or step description.
 */
export function parseTargetIntent(target: string): {
  expectedTag?: string;
  expectedType?: string;
  forbiddenType?: string;
  expectedTokens: Set<string>;
  rawTarget: string;
} {
  const rawTarget = target.toLowerCase();
  let expectedTag: string | undefined;
  let expectedType: string | undefined;
  let forbiddenType: string | undefined;

  if (rawTarget.includes("button") || rawTarget.includes("btn") || rawTarget.includes("click")) {
    expectedTag = "button";
  } else if (rawTarget.includes("password") || rawTarget.includes("pass") || rawTarget.includes("secret")) {
    expectedTag = "input";
    expectedType = "password";
  } else if (rawTarget.includes("username") || rawTarget.includes("user") || rawTarget.includes("account")) {
    expectedTag = "input";
    expectedType = "text";
    forbiddenType = "password";
  } else if (rawTarget.includes("todo") || rawTarget.includes("task") || rawTarget.includes("item")) {
    expectedTag = "input";
    forbiddenType = "password";
  }

  return {
    expectedTag,
    expectedType,
    forbiddenType,
    expectedTokens: tokenize(target),
    rawTarget,
  };
}

/**
 * Scores an element candidate against a failed locator or target description.
 */
export function scoreCandidate(
  target: string,
  candidate: ElementCandidate,
): { score: number; matchReasons: string[] } {
  const reasons: string[] = [];
  const intent = parseTargetIntent(target);
  let totalScore = 0;

  // 1. Tag Match (Weight: 0.25)
  let tagScore = 0;
  if (intent.expectedTag) {
    if (candidate.tag.toLowerCase() === intent.expectedTag) {
      tagScore = 1.0;
      reasons.push(`Tag exact match: <${candidate.tag}>`);
    } else if (
      (intent.expectedTag === "button" && (candidate.role === "button" || candidate.type === "submit")) ||
      (intent.expectedTag === "input" && candidate.tag === "textarea")
    ) {
      tagScore = 0.85;
      reasons.push(`Interactive semantic match: <${candidate.tag} role=${candidate.role || candidate.type}>`);
    }
  } else {
    tagScore = 0.5;
  }
  totalScore += tagScore * 0.25;

  // 2. Type Match & Penalty (Weight: 0.20)
  let typeScore = 0.5;
  if (intent.expectedType) {
    if (candidate.type?.toLowerCase() === intent.expectedType) {
      typeScore = 1.0;
      reasons.push(`Input type matched: ${candidate.type}`);
    } else if (intent.forbiddenType && candidate.type?.toLowerCase() === intent.forbiddenType) {
      typeScore = 0.0; // Penalty for matching password input when looking for username
    }
  } else if (intent.forbiddenType && candidate.type?.toLowerCase() === intent.forbiddenType) {
    typeScore = 0.0;
  }
  totalScore += typeScore * 0.20;

  // 3. Text and Label Similarity (Weight: 0.25)
  let textScore = 0;
  const candidateTexts = [
    candidate.text,
    candidate.ariaLabel,
    candidate.placeholder,
  ].filter(Boolean) as string[];

  for (const text of candidateTexts) {
    const sim = stringSimilarity(target, text);
    const overlap = tokenOverlap(target, text);
    const combined = Math.max(sim, overlap);
    if (combined > textScore) {
      textScore = combined;
      if (combined > 0.3) {
        reasons.push(`Label/text similarity: "${text}" (${Math.round(combined * 100)}%)`);
      }
    }
  }
  totalScore += textScore * 0.25;

  // 4. Attribute / ID / Name Overlap (Weight: 0.30)
  let attrScore = 0;
  const candidateAttrs = [
    candidate.id,
    candidate.name,
    candidate.placeholder,
    ...(candidate.classes || []),
  ].filter(Boolean) as string[];

  for (const attr of candidateAttrs) {
    const overlap = tokenOverlap(target, attr);
    const sim = stringSimilarity(target, attr);
    const combined = Math.max(overlap, sim);
    if (combined > attrScore) {
      attrScore = combined;
      if (combined > 0.3) {
        reasons.push(`Attribute token overlap: "${attr}" (${Math.round(combined * 100)}%)`);
      }
    }
  }
  totalScore += attrScore * 0.30;

  const normalizedScore = Math.min(1.0, Math.round(totalScore * 100) / 100);

  return {
    score: normalizedScore,
    matchReasons: reasons,
  };
}

/**
 * Ranks all candidate elements by similarity to the target, returning top candidates.
 */
export function rankCandidates(
  target: string,
  candidates: ElementCandidate[],
  minScore = 0.2,
): ElementCandidate[] {
  const scored = candidates.map((cand) => {
    const { score, matchReasons } = scoreCandidate(target, cand);
    return {
      ...cand,
      score,
      matchReasons,
    };
  });

  return scored
    .filter((c) => (c.score || 0) >= minScore)
    .sort((a, b) => (b.score || 0) - (a.score || 0));
}
