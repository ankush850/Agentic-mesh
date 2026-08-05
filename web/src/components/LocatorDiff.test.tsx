import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LocatorDiff } from "./LocatorDiff";

describe("LocatorDiff", () => {
  it("shows both locators with a character-level diff", () => {
    const { container } = render(
      <LocatorDiff oldLocator="#todo-input" newLocator="#task-entry-field" />,
    );

    expect(screen.getByText("Old locator")).toBeInTheDocument();
    expect(screen.getByText("Healed locator")).toBeInTheDocument();

    const oldCode = container.querySelectorAll("code")[0];
    const newCode = container.querySelectorAll("code")[1];
    expect(oldCode.textContent).toBe("#todo-input");
    expect(newCode.textContent).toBe("#task-entry-field");

    // The removed/added characters are highlighted rather than replaced wholesale.
    expect(oldCode.querySelector(".line-through")).not.toBeNull();
    expect(newCode.querySelector(".bg-passed\\/25")).not.toBeNull();
  });

  it("describes model provenance and confidence", () => {
    render(
      <LocatorDiff
        oldLocator="#login-btn"
        newLocator="#btn-submit-auth"
        modelUsed="groq/openai/gpt-oss-120b"
        confidence={0.94}
        reason="Nearest candidate with a submit role"
      />,
    );

    expect(screen.getByText("groq/openai/gpt-oss-120b")).toBeInTheDocument();
    expect(screen.getByText("94% · high confidence")).toBeInTheDocument();
    expect(screen.getByText("Nearest candidate with a submit role")).toBeInTheDocument();
  });

  it("flags low confidence repairs for review", () => {
    render(<LocatorDiff oldLocator="#a" newLocator="#b" confidence={0.61} />);

    expect(screen.getByText("61% · low confidence — review carefully")).toBeInTheDocument();
  });
});
