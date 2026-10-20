import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignInPage from "@/app/page";
import SignUpPage from "@/app/signup/page";
import { ADA, fakeServer, requestsTo } from "@/test-utils/fakeBackend";

const router = { push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** A signed-out backend whose sign-in or sign-up answers with `reply`. */
function fakeAuth(reply: Response) {
  const fetchMock = fakeServer({ user: null, agreements: [] });
  const signedOut = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (input, init) =>
    String(input).startsWith("/api/auth/sign") ? reply : signedOut(input, init),
  );
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  router.push.mockClear();
  router.replace.mockClear();
});

describe("Sign-in page", () => {
  function setup(reply = json(ADA)) {
    const fetchMock = fakeAuth(reply);
    const user = userEvent.setup();
    render(<SignInPage />);
    return {
      fetchMock,
      user,
      email: screen.getByLabelText("Email"),
      password: screen.getByLabelText("Password"),
      submit: screen.getByRole("button", { name: "Sign in" }),
    };
  }

  it("shows the brand, the agreements on offer and the form", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
    expect(screen.getAllByText(/Prelegal|Pre/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Agreements you can draft" })).toBeInTheDocument();
    expect(screen.getByText("Cloud Service Agreement")).toBeInTheDocument();
    expect(screen.queryByText("Mutual Non-Disclosure Agreement Cover Page")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute("href", expect.stringMatching(/^\/signup\/?$/));
  });

  it("signs in and goes to the dashboard", async () => {
    const { fetchMock, user, email, password, submit } = setup();
    await user.type(email, " ada@example.com ");
    await user.type(password, "correct horse");
    await user.click(submit);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/"));
    expect(requestsTo(fetchMock, "/api/auth/signin")).toEqual([{ email: "ada@example.com", password: "correct horse" }]);
  });

  it("shows the server's message when the password is wrong", async () => {
    const { user, email, password, submit } = setup(json({ detail: "Wrong email or password." }, 401));
    await user.type(email, "ada@example.com");
    await user.type(password, "nope{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Wrong email or password.");
    expect(router.push).not.toHaveBeenCalled();
    expect(submit).toBeEnabled();
  });

  it("uses the purple secondary color for the submit button", () => {
    const { submit } = setup();
    expect(submit).toHaveAttribute("type", "submit");
    expect(submit.className).toContain("bg-[#753991]");
  });

  it("lets the browser block an empty or invalid email", async () => {
    const { fetchMock, user, email, password, submit } = setup();
    await user.click(submit);
    await user.type(email, "not-an-email");
    await user.type(password, "x");
    await user.click(submit);
    expect(requestsTo(fetchMock, "/api/auth/signin")).toEqual([]);
  });

  it("sends someone already signed in to the dashboard", async () => {
    fakeServer({ user: ADA, agreements: [] });
    render(<SignInPage />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/"));
  });
});

describe("Sign-up page", () => {
  function setup(reply = json(ADA, 201)) {
    const fetchMock = fakeAuth(reply);
    const user = userEvent.setup();
    render(<SignUpPage />);
    return { fetchMock, user };
  }

  async function fillIn(user: ReturnType<typeof userEvent.setup>, password = "correct horse") {
    await user.type(screen.getByLabelText("Name"), " Ada Lovelace ");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText(/^Password/), password);
    await user.click(screen.getByRole("button", { name: "Create account" }));
  }

  it("asks for a name, email and a password of at least 8 characters", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/)).toHaveAttribute("minLength", "8");
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/");
  });

  it("creates the account and goes to the dashboard", async () => {
    const { fetchMock, user } = setup();
    await fillIn(user);
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/dashboard/"));
    expect(requestsTo(fetchMock, "/api/auth/signup")).toEqual([
      { name: "Ada Lovelace", email: "ada@example.com", password: "correct horse" },
    ]);
  });

  it("doesn't submit a short password", async () => {
    const { fetchMock, user } = setup();
    await fillIn(user, "short");
    expect(requestsTo(fetchMock, "/api/auth/signup")).toEqual([]);
    expect(screen.getByRole("alert")).toHaveTextContent("Use at least 8 characters for your password.");
  });

  it("explains when the email is already registered", async () => {
    const { user } = setup(json({ detail: "An account with this email already exists. Sign in instead." }, 409));
    await fillIn(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
    expect(router.push).not.toHaveBeenCalled();
  });
});
