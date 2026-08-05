import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders colour, icon and readable text together", () => {
    render(<StatusBadge status="healed" />);

    const badge = screen.getByText("Self-healed");
    expect(badge).toBeInTheDocument();
    // Never colour-only: the tone class and a sibling icon both exist.
    expect(badge.className).toContain("text-healed");
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("accepts an explicit label override", () => {
    render(<StatusBadge status="passed" label="3 passed" />);

    expect(screen.getByText("3 passed")).toBeInTheDocument();
  });

  it("can render a dot instead of an icon for dense tables", () => {
    render(<StatusBadge status="failed" dotOnly />);

    const badge = screen.getByText("Failed");
    expect(badge.querySelector("svg")).toBeNull();
    expect(badge.querySelector("span[aria-hidden]")).not.toBeNull();
  });
});
