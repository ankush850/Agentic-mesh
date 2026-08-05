import { describe, it, expect } from "vitest";
import {
  levenshteinDistance,
  stringSimilarity,
  tokenOverlap,
  scoreCandidate,
  rankCandidates,
} from "../healing/similarity";
import { ElementCandidate } from "../types";

describe("Similarity Scoring Engine (Healenium-inspired)", () => {
  it("calculates string distance and similarity correctly", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(stringSimilarity("username", "username")).toBe(1.0);
    expect(stringSimilarity("username", "user_name")).toBeGreaterThan(0.7);
    expect(stringSimilarity("username", "xyz")).toBeLessThan(0.3);
  });

  it("handles token overlap across case conventions", () => {
    expect(tokenOverlap("user-account-input", "username")).toBeGreaterThan(0.3);
    expect(tokenOverlap("todo-input", "task-entry-field")).toBeGreaterThan(0);
    expect(tokenOverlap("login-btn", "btn-submit-auth")).toBeGreaterThan(0.2);
  });

  it("scores refactored elements higher than unrelated elements", () => {
    const candidates: ElementCandidate[] = [
      {
        tag: "input",
        id: "user-account-input",
        name: "userAccount",
        type: "text",
        placeholder: "Account identifier",
        locator: "#user-account-input",
      },
      {
        tag: "input",
        id: "user-secret-key",
        name: "userSecret",
        type: "password",
        placeholder: "Secret credential",
        locator: "#user-secret-key",
      },
      {
        tag: "button",
        id: "btn-submit-auth",
        text: "Log In",
        locator: "#btn-submit-auth",
      },
    ];

    const usernameResult = rankCandidates("#username", candidates);
    expect(usernameResult[0].locator).toBe("#user-account-input");
    expect(usernameResult[0].score).toBeGreaterThan(0.5);

    const passwordResult = rankCandidates("#password", candidates);
    expect(passwordResult[0].locator).toBe("#user-secret-key");

    const buttonResult = rankCandidates("#login-btn", candidates);
    expect(buttonResult[0].locator).toBe("#btn-submit-auth");
  });
});

