import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Health, Settings } from "../../../shared/contracts";
import { mockDemoPages, mockSettings, mockTestCases, mockTicket } from "../mocks/data";
import NewRun from "./NewRun";

// The whole page talks to the backend through this module.
vi.mock("../lib/api", () => ({
  api: {
    health: vi.fn(),
    settings: vi.fn(),
    fetchTicket: vi.fn(),
    demoPages: vi.fn(),
    generateTests: vi.fn(),
    createRun: vi.fn(),
  },
}));

import { api } from "../lib/api";

const healthWith = (overrides: Partial<Health> = {}): Health => ({
  ok: true,
  version: "1.0.0",
  mockMode: false,
  providers: { groq: true, gemini: true, jira: true },
  ...overrides,
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NewRun />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * Demo of the ticket intake flow: the console must default to *real* Jira
 * whenever the server reports Jira credentials, and only fall back to the
 * bundled mock ticket when they are missing (or explicitly requested).
 */
describe("NewRun ticket intake", () => {
  beforeEach(() => {
    vi.mocked(api.health).mockResolvedValue(healthWith());
    vi.mocked(api.settings).mockResolvedValue(mockSettings as Settings);
    vi.mocked(api.fetchTicket).mockResolvedValue(mockTicket);
    vi.mocked(api.demoPages).mockResolvedValue({ pages: mockDemoPages });
    vi.mocked(api.generateTests).mockResolvedValue({ testCases: mockTestCases });
  });

  it("defaults to real Jira and requires a ticket key", async () => {
    const user = userEvent.setup();
    renderPage();

    // Jira is connected → the fetch button targets Jira and the key input is enabled.
    const fetchButton = await screen.findByRole("button", { name: /fetch from jira/i });
    const keyInput = screen.getByPlaceholderText("SQA-42");
    expect(keyInput).toBeEnabled();

    // Without a key we never ask the server for an arbitrary ticket.
    expect(fetchButton).toBeDisabled();

    await user.type(keyInput, "SQA-7");
    const submit = screen.getByRole("button", { name: /fetch from jira/i });
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() =>
      expect(api.fetchTicket).toHaveBeenCalledWith({ key: "SQA-7", useMock: false }),
    );
    // Landing on the plan step proves the real ticket flowed through.
    expect(await screen.findByText("Generated test plan")).toBeInTheDocument();
  });

  it("falls back to the bundled mock ticket when Jira is not configured", async () => {
    vi.mocked(api.health).mockResolvedValue(
      healthWith({ providers: { groq: false, gemini: false, jira: false } }),
    );
    const user = userEvent.setup();
    renderPage();

    const mockButton = await screen.findByRole("button", { name: /load mock ticket/i });
    expect(screen.getByPlaceholderText("QA-101")).toBeDisabled();

    await user.click(mockButton);
    await waitFor(() =>
      expect(api.fetchTicket).toHaveBeenCalledWith({ key: undefined, useMock: true }),
    );
  });
});
