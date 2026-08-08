import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { es } from "@/i18n";
import { validateCredentials } from "@/lib/auth/credentials-schema";

const signInWithPassword = vi.fn();
const signUpWithPassword = vi.fn();

vi.mock("@/app/(auth)/actions", () => ({
  signInWithPassword: (i: unknown) => signInWithPassword(i),
  signUpWithPassword: (i: unknown) => signUpWithPassword(i),
}));
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({ auth: { signInWithOAuth: vi.fn() } }),
}));

const { AuthForm } = await import("./AuthForm");
const { PasswordInput } = await import("@/components/ui/password-input");

beforeEach(() => {
  vi.clearAllMocks();
  signInWithPassword.mockResolvedValue({
    ok: false,
    error: es.auth.errors.invalidCredentials,
  });
  signUpWithPassword.mockResolvedValue({
    ok: false,
    error: es.auth.errors.alreadyRegistered,
  });
});

describe("PasswordInput", () => {
  it("starts hidden and toggles to visible", async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="p" defaultValue="secreto" />);

    const field = document.querySelector("#p") as HTMLInputElement;
    expect(field.type).toBe("password");

    await user.click(screen.getByRole("button", { name: es.auth.showPassword }));
    expect(field.type).toBe("text");

    await user.click(screen.getByRole("button", { name: es.auth.hidePassword }));
    expect(field.type).toBe("password");
  });

  it("the toggle is type=button, so it cannot submit the form", () => {
    render(<PasswordInput id="p" />);

    const toggle = screen.getByRole("button", { name: es.auth.showPassword });
    // A button with no type submits its form — revealing the password would
    // have sent it.
    expect(toggle).toHaveAttribute("type", "button");
  });
});

describe("credential validation", () => {
  it("rejects a malformed email in both modes", () => {
    for (const mode of ["login", "signup"] as const) {
      expect(
        validateCredentials(mode, { email: "no-es-correo", password: "12345678" })
          .success
      ).toBe(false);
    }
  });

  it("sign-up enforces the minimum length", () => {
    const result = validateCredentials("signup", {
      email: "ana@ejemplo.com",
      password: "corta",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors.password).toBeTruthy();
  });

  it("sign-in only requires a password to be present", () => {
    // Rejecting a short one here would leak that it is not this account's, and
    // would lock out anyone whose password predates the policy.
    expect(
      validateCredentials("login", { email: "ana@ejemplo.com", password: "x" })
        .success
    ).toBe(true);
    expect(
      validateCredentials("login", { email: "ana@ejemplo.com", password: "" })
        .success
    ).toBe(false);
  });
});

describe("modes", () => {
  it("sign-up shows its own copy and links to sign in", () => {
    render(<AuthForm mode="signup" />);

    expect(screen.getByText(es.auth.signup.switchPrompt)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: es.auth.signup.switchAction })
    ).toHaveAttribute("href", "/login");
  });

  it("sign-in shows its own copy and links to sign up", () => {
    render(<AuthForm mode="login" />);

    expect(
      screen.getByRole("button", { name: es.auth.login.submit })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: es.auth.login.switchAction })
    ).toHaveAttribute("href", "/registro");
  });

  it("offers Google in both modes", () => {
    const { unmount } = render(<AuthForm mode="login" />);
    expect(
      screen.getByRole("button", { name: es.login.signInWithGoogle })
    ).toBeInTheDocument();
    unmount();

    render(<AuthForm mode="signup" />);
    expect(
      screen.getByRole("button", { name: es.login.signInWithGoogle })
    ).toBeInTheDocument();
  });
});

describe("submitting", () => {
  it("does not call the server while the form is invalid", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText(es.login.emailLabel), "no-es-correo");
    await user.click(screen.getByRole("button", { name: es.auth.login.submit }));

    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByText(es.auth.errors.emailInvalid)).toBeInTheDocument();
  });

  it("sign-up asks for the address first, and only then the password", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);

    // Step one: no password field at all.
    expect(screen.queryByLabelText(es.auth.passwordLabel)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: es.login.continue })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(es.login.emailLabel), "ana@ejemplo.com");
    await user.click(screen.getByRole("button", { name: es.login.continue }));

    // Step two REPLACES step one: the field is gone, the address is now
    // context, and nothing was sent on the way.
    expect(screen.getByLabelText(es.auth.passwordLabel)).toBeInTheDocument();
    expect(screen.queryByLabelText(es.login.emailLabel)).not.toBeInTheDocument();
    expect(screen.getByText("ana@ejemplo.com")).toBeInTheDocument();
    expect(signUpWithPassword).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(es.auth.passwordLabel), "unaClave123");
    await user.click(screen.getByRole("button", { name: es.auth.signup.submit }));

    expect(signUpWithPassword).toHaveBeenCalledWith({
      email: "ana@ejemplo.com",
      password: "unaClave123",
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("the second step can go back to fix a mistyped address", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);

    await user.type(screen.getByLabelText(es.login.emailLabel), "ana@ejemplo.com");
    await user.click(screen.getByRole("button", { name: es.login.continue }));
    await user.click(screen.getByRole("button", { name: es.auth.changeEmail }));

    // Back on step one, with what was typed still there.
    const field = screen.getByLabelText(es.login.emailLabel);
    expect(field).toHaveValue("ana@ejemplo.com");
    expect(screen.queryByLabelText(es.auth.passwordLabel)).not.toBeInTheDocument();
  });

  it("sign-up does not advance on an invalid address", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);

    await user.type(screen.getByLabelText(es.login.emailLabel), "no-es-correo");
    await user.click(screen.getByRole("button", { name: es.login.continue }));

    expect(screen.queryByLabelText(es.auth.passwordLabel)).not.toBeInTheDocument();
    expect(screen.getByText(es.auth.errors.emailInvalid)).toBeInTheDocument();
  });

  it("sign-in shows both fields at once", async () => {
    render(<AuthForm mode="login" />);

    expect(screen.getByLabelText(es.login.emailLabel)).toBeInTheDocument();
    expect(screen.getByLabelText(es.auth.passwordLabel)).toBeInTheDocument();
  });

  it("shows a failed sign-in generically, without confirming the address", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText(es.login.emailLabel), "ana@ejemplo.com");
    await user.type(screen.getByLabelText(es.auth.passwordLabel), "loquesea");
    await user.click(screen.getByRole("button", { name: es.auth.login.submit }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(es.auth.errors.invalidCredentials);
    // Nothing that would tell an attacker whether the account exists.
    expect(alert.textContent).not.toMatch(/no existe|no encontramos|no registrado/i);
  });

  it("points an already-registered address at signing in", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);

    await user.type(screen.getByLabelText(es.login.emailLabel), "ana@ejemplo.com");
    await user.click(screen.getByRole("button", { name: es.login.continue }));
    await user.type(screen.getByLabelText(es.auth.passwordLabel), "unaClave123");
    await user.click(screen.getByRole("button", { name: es.auth.signup.submit }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      es.auth.errors.alreadyRegistered
    );
  });
});
