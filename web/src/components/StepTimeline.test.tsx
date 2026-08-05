import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RunStep } from "../../../shared/contracts";
import { StepTimeline } from "./StepTimeline";

const steps: RunStep[] = [
  {
    testId: "TC-01",
    stepIndex: 0,
    description: "Navigate to the demo app",
    status: "passed",
    durationMs: 420,
  },
  {
    testId: "TC-01",
    stepIndex: 1,
    description: "Type the username",
    status: "healed",
    durationMs: 1500,
    oldLocator: "#username",
    newLocator: "#user-account-input",
  },
  {
    testId: "TC-01",
    stepIndex: 2,
    description: "Assert the todo list",
    status: "failed",
    error: "locator resolved to 0 elements",
  },
];

describe("StepTimeline", () => {
  it("renders each step with its outcome", () => {
    render(<StepTimeline steps={steps} />);

    expect(screen.getByText("Navigate to the demo app")).toBeInTheDocument();
    expect(screen.getByText("Type the username")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
    expect(screen.getByText("1.5 s")).toBeInTheDocument();
  });

  it("inlines the locator diff for healed steps", () => {
    const { container } = render(<StepTimeline steps={steps} />);

    expect(screen.getByText("Old locator")).toBeInTheDocument();
    // The diff is split across <span>s, so assert on the assembled code text.
    const codes = Array.from(container.querySelectorAll("code")).map((node) => node.textContent);
    expect(codes).toContain("#username");
    expect(codes).toContain("#user-account-input");
  });

  it("surfaces the failure message", () => {
    render(<StepTimeline steps={steps} />);

    expect(screen.getByText("locator resolved to 0 elements")).toBeInTheDocument();
  });

  it("renders streamed reasoning notes", () => {
    render(
      <StepTimeline
        steps={steps}
        reasoning={{ 1: ["Scanning the DOM", "Picked the account input"] }}
      />,
    );

    expect(screen.getByText("Scanning the DOM")).toBeInTheDocument();
    expect(screen.getByText("Picked the account input")).toBeInTheDocument();
  });

  it("marks cached steps", () => {
    render(<StepTimeline steps={[{ ...steps[0], cached: true }]} />);

    expect(screen.getByText("cached")).toBeInTheDocument();
  });

  it("becomes an interactive list when onSelect is provided", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<StepTimeline steps={steps} onSelect={onSelect} selectedIndex={1} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(buttons[1]).toHaveAttribute("aria-pressed", "true");

    await user.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ stepIndex: 0 }));
  });

  it("shows an empty state instead of an empty list", () => {
    render(<StepTimeline steps={[]} emptyLabel="Waiting for the first step…" />);

    expect(screen.getByText("Waiting for the first step…")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
