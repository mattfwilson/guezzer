import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { config } from "../src/config.ts";
import { ROSTER } from "../src/auth/roster.ts";

/**
 * SignInScreen behavior contract (plan 18-04, Task 2, AUTH-01 / D-01/D-03/D-18).
 *
 * The supabase singleton, the identity-record writer, and the legacy-dex claim
 * are all mocked so these tests exercise ONLY the sign-in SURFACE and its two
 * success side effects — never a real network/auth call or IndexedDB:
 *
 *  - Wrong password → the GENERIC "Invalid login credentials" string, inline,
 *    no "no such user"/"wrong password" enumeration (D-18, threat T-18-04-I2).
 *  - Success → writeIdentityRecord + claimLegacyDexOnce both called with the
 *    session's returned userId (D-08 wiring).
 *  - online=false → the calm "connect once" screen (D-03), form not surfaced.
 *
 * `../src/db/supabase.ts` MUST be mocked: importing the real module throws at
 * load time when VITE_SUPABASE_URL is unset (test env has no .env.local).
 */
vi.mock("../src/db/supabase.ts", () => ({
  supabase: { auth: { signInWithPassword: vi.fn() } },
}));
vi.mock("../src/auth/identityRecord.ts", () => ({
  writeIdentityRecord: vi.fn(),
}));
vi.mock("../src/auth/claimDex.ts", () => ({
  claimLegacyDexOnce: vi.fn().mockResolvedValue(undefined),
}));

const { supabase } = (await import("../src/db/supabase.ts")) as unknown as {
  supabase: { auth: { signInWithPassword: Mock } };
};
const { writeIdentityRecord } = (await import(
  "../src/auth/identityRecord.ts"
)) as unknown as { writeIdentityRecord: Mock };
const { claimLegacyDexOnce } = (await import(
  "../src/auth/claimDex.ts"
)) as unknown as { claimLegacyDexOnce: Mock };
const { SignInScreen } = await import("../src/auth/SignInScreen.tsx");

const copy = config.copy.auth;
const signIn = supabase.auth.signInWithPassword;

/** Pick the first roster name, then type a password into the revealed field. */
function pickNameAndType(password: string) {
  fireEvent.click(screen.getByRole("button", { name: ROSTER[0].displayName }));
  fireEvent.change(screen.getByPlaceholderText(copy.passwordPlaceholder), {
    target: { value: password },
  });
}

beforeEach(() => {
  signIn.mockReset();
  writeIdentityRecord.mockReset();
  claimLegacyDexOnce.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("SignInScreen — name-picker + password (AUTH-01 / D-01/D-03/D-18)", () => {
  it("renders the roster name-picker under the 'Who's here?' heading when online", () => {
    render(<SignInScreen online={true} />);
    expect(screen.getByText(copy.whosHere)).toBeInTheDocument();
    for (const entry of ROSTER) {
      expect(
        screen.getByRole("button", { name: entry.displayName }),
      ).toBeInTheDocument();
    }
  });

  it("tapping a name marks it aria-pressed and reveals the password field", () => {
    render(<SignInScreen online={true} />);
    // Password field is not the primary surface until a name is picked.
    expect(
      screen.queryByPlaceholderText(copy.passwordPlaceholder),
    ).not.toBeInTheDocument();

    const nameBtn = screen.getByRole("button", { name: ROSTER[0].displayName });
    fireEvent.click(nameBtn);
    expect(nameBtn).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByPlaceholderText(copy.passwordPlaceholder),
    ).toBeInTheDocument();
  });

  it("a wrong password renders the GENERIC 'Invalid login credentials' inline — no enumeration", async () => {
    signIn.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });
    render(<SignInScreen online={true} />);
    pickNameAndType("wrong-pw");
    fireEvent.click(screen.getByRole("button", { name: copy.signIn }));

    await waitFor(() =>
      expect(screen.getByText("Invalid login credentials")).toBeInTheDocument(),
    );
    // The calm "ask the owner" recovery line accompanies the error (D-18).
    expect(screen.getByText(copy.forgotOwner)).toBeInTheDocument();
    // No enumeration copy anywhere.
    expect(screen.queryByText(/no such user/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wrong password/i)).not.toBeInTheDocument();
    // Side effects never fire on failure.
    expect(writeIdentityRecord).not.toHaveBeenCalled();
    expect(claimLegacyDexOnce).not.toHaveBeenCalled();
  });

  it("submits the tapped roster handle (not free-text) to signInWithPassword", async () => {
    signIn.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });
    render(<SignInScreen online={true} />);
    pickNameAndType("pw123");
    fireEvent.click(screen.getByRole("button", { name: copy.signIn }));

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith({
      email: ROSTER[0].handle,
      password: "pw123",
    });
  });

  it("on success writes the identity record and claims the legacy dex with the returned userId", async () => {
    signIn.mockResolvedValue({
      data: {
        session: {
          user: {
            id: "user-abc-123",
            user_metadata: { display_name: "Matt" },
          },
        },
      },
      error: null,
    });
    render(<SignInScreen online={true} />);
    pickNameAndType("correct-pw");
    fireEvent.click(screen.getByRole("button", { name: copy.signIn }));

    await waitFor(() =>
      expect(writeIdentityRecord).toHaveBeenCalledWith({
        userId: "user-abc-123",
        displayName: "Matt",
      }),
    );
    await waitFor(() =>
      expect(claimLegacyDexOnce).toHaveBeenCalledWith("user-abc-123"),
    );
  });

  it("online=false renders the calm 'connect once' screen, not the sign-in form", () => {
    render(<SignInScreen online={false} />);
    expect(screen.getByText(copy.connectOnceHeading)).toBeInTheDocument();
    expect(screen.getByText(copy.connectOnceBody)).toBeInTheDocument();
    // The name-picker / password form is NOT the surface when offline.
    expect(screen.queryByText(copy.whosHere)).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(copy.passwordPlaceholder),
    ).not.toBeInTheDocument();
  });
});
