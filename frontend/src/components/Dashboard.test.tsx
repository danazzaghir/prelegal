import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ADA, fakeServer, savedAgreement, type FakeServer } from "@/test-utils/fakeBackend";
import Dashboard from "./Dashboard";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/dashboard/" }));

afterEach(() => {
  vi.unstubAllGlobals();
  router.push.mockClear();
  router.replace.mockClear();
});

function setup(server: FakeServer) {
  const fetchMock = fakeServer(server);
  const user = userEvent.setup();
  render(<Dashboard />);
  return { fetchMock, user, server };
}

describe("Dashboard", () => {
  it("lists the user's agreements with a link to continue each one", async () => {
    setup({
      user: ADA,
      agreements: [
        savedAgreement(2, { title: "Cloud Service Agreement · Acme Inc", updatedAt: new Date().toISOString() }),
        savedAgreement(1, { title: "Service Level Agreement" }),
      ],
    });
    const list = await screen.findByRole("list");
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole("link", { name: "Cloud Service Agreement · Acme Inc" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/documents\/?\?id=2$/),
    );
    expect(rows[0]).toHaveTextContent("Draft, last edited just now");
    expect(within(rows[1]).getByRole("link", { name: "Open" })).toHaveAttribute("href", expect.stringMatching(/id=1$/));
    expect(screen.getByRole("heading", { level: 1, name: "My agreements" })).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("invites the user to start when there are no agreements", async () => {
    setup({ user: ADA, agreements: [] });
    expect(await screen.findByText("You haven't drafted anything yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start your first agreement" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/documents\/?$/),
    );
  });

  it("deletes an agreement after asking to confirm", async () => {
    const { user, server } = setup({ user: ADA, agreements: [savedAgreement(1), savedAgreement(2, { title: "Other" })] });
    await screen.findByRole("list");
    await user.click(screen.getByRole("button", { name: "Delete Service Level Agreement" }));
    expect(screen.getByText("Delete this agreement?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep" }));
    expect(server.agreements).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Delete Service Level Agreement" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(server.agreements.map((a) => a.id)).toEqual([2]);
  });

  it("sends signed-out visitors to sign in", async () => {
    setup({ user: null, agreements: [] });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("heading", { name: "My agreements" })).not.toBeInTheDocument();
  });

  it("signs out from the header", async () => {
    const { user, server } = setup({ user: ADA, agreements: [] });
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
    expect(server.user).toBeNull();
  });

  it("marks the current page in the navigation", async () => {
    setup({ user: ADA, agreements: [] });
    const nav = await screen.findByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "My agreements" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "New agreement" })).not.toHaveAttribute("aria-current");
  });
});
