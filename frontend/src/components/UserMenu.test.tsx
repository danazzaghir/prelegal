import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSignedInEmail, signIn } from "@/lib/session";
import UserMenu from "./UserMenu";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("UserMenu", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("shows the signed-in email", () => {
    signIn("ada@example.com");
    render(<UserMenu />);
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });

  it("shows only sign out when nobody signed in", () => {
    const { container } = render(<UserMenu />);
    expect(container).toHaveTextContent(/^Sign out$/);
  });

  it("updates when the user signs in elsewhere on the page", () => {
    render(<UserMenu />);
    act(() => signIn("alan@example.com"));
    expect(screen.getByText("alan@example.com")).toBeInTheDocument();
  });

  it("signs out and goes back to the login screen", async () => {
    signIn("ada@example.com");
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(getSignedInEmail()).toBeNull();
    expect(push).toHaveBeenCalledWith("/");
    expect(screen.queryByText("ada@example.com")).not.toBeInTheDocument();
  });
});
