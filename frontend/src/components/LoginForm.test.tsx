import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSignedInEmail } from "@/lib/session";
import LoginPage from "@/app/page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function setup() {
  const user = userEvent.setup();
  render(<LoginPage />);
  return {
    user,
    email: screen.getByLabelText("Email"),
    password: screen.getByLabelText("Password"),
    submit: screen.getByRole("button", { name: "Sign in" }),
  };
}

describe("Login page", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("shows the brand, a sign in form and that sign-in is not checked yet", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Prelegal" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText(/any email and password will do/i)).toBeInTheDocument();
  });

  it("asks for an email and a password", () => {
    const { email, password } = setup();
    expect(email).toHaveAttribute("type", "email");
    expect(email).toBeRequired();
    expect(password).toHaveAttribute("type", "password");
    expect(password).toBeRequired();
  });

  it("uses the purple secondary color for the submit button", () => {
    const { submit } = setup();
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit.className).toContain("bg-[#753991]");
  });

  it("brings the user into the platform with any email and password", async () => {
    const { user, email, password, submit } = setup();
    await user.type(email, "ada@example.com");
    await user.type(password, "anything");
    await user.click(submit);
    expect(push).toHaveBeenCalledWith("/nda/");
    expect(getSignedInEmail()).toBe("ada@example.com");
  });

  it("submits with the Enter key", async () => {
    const { user, email, password } = setup();
    await user.type(email, "ada@example.com");
    await user.type(password, "x{Enter}");
    expect(push).toHaveBeenCalledWith("/nda/");
  });

  it("does not sign in with the fields empty", async () => {
    const { user, submit } = setup();
    await user.click(submit);
    expect(push).not.toHaveBeenCalled();
    expect(getSignedInEmail()).toBeNull();
  });

  it("does not sign in with an invalid email", async () => {
    const { user, email, password, submit } = setup();
    await user.type(email, "not-an-email");
    await user.type(password, "x");
    await user.click(submit);
    expect(push).not.toHaveBeenCalled();
  });
});
