import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DocumentsRoute from "./DocumentsRoute";

// The address's query string, changed by each test.
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));

// A stand-in creator that shows which agreement it opened and counts its mounts.
let mounts = 0;
let lastOnCreated: (id: number) => void = () => {};
vi.mock("@/components/DocumentCreator", async () => {
  const { useState } = await import("react");
  return {
    default: function FakeCreator({ savedId, onCreated }: { savedId: number | null; onCreated: (id: number) => void }) {
      const [mount] = useState(() => ++mounts);
      const [opened] = useState(savedId);
      lastOnCreated = onCreated;
      return <p>{`creator ${mount} opened ${opened ?? "new"}`}</p>;
    },
  };
});

function goTo(query: string, rerender: () => void) {
  search = query;
  act(rerender);
}

afterEach(() => {
  search = "";
  mounts = 0;
});

describe("DocumentsRoute", () => {
  it("opens the agreement named in the address", () => {
    search = "id=3";
    render(<DocumentsRoute />);
    expect(screen.getByText("creator 1 opened 3")).toBeInTheDocument();
  });

  it("keeps the same creator when it saves a new agreement, and puts its id in the address", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    const { rerender } = render(<DocumentsRoute />);
    act(() => lastOnCreated(5));
    expect(replaceState).toHaveBeenCalledWith(null, "", "/documents/?id=5");
    goTo("id=5", () => rerender(<DocumentsRoute />));
    expect(screen.getByText("creator 1 opened new")).toBeInTheDocument();
    replaceState.mockRestore();
  });

  it("ignores a first save that finishes after the user started a new agreement", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    search = "";
    const { rerender } = render(<DocumentsRoute />);
    const oldOnCreated = lastOnCreated;
    goTo("id=3", () => rerender(<DocumentsRoute />));
    goTo("", () => rerender(<DocumentsRoute />));
    act(() => oldOnCreated(5));
    expect(replaceState).not.toHaveBeenCalled();
    expect(screen.getByText("creator 3 opened new")).toBeInTheDocument();
    replaceState.mockRestore();
  });

  it("starts a fresh creator for New agreement or another saved agreement", () => {
    search = "id=3";
    const { rerender } = render(<DocumentsRoute />);
    goTo("", () => rerender(<DocumentsRoute />));
    expect(screen.getByText("creator 2 opened new")).toBeInTheDocument();
    goTo("id=8", () => rerender(<DocumentsRoute />));
    expect(screen.getByText("creator 3 opened 8")).toBeInTheDocument();
  });
});
