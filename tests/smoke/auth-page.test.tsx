import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import AuthPage, { metadata } from "../../app/auth/page";

describe("auth page", () => {
  it("is noindex and exposes accessible identity lifecycle forms", () => {
    render(<AuthPage />);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(screen.getByRole("heading", { name: /your bangladesh stays/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in securely" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect(screen.getByLabelText("Full name").getAttribute("required")).not.toBeNull();
    expect(screen.getByLabelText("Email address").getAttribute("type")).toBe("email");
    expect(screen.getByLabelText("Password").getAttribute("minlength")).toBe("12");
    fireEvent.click(screen.getByRole("button", { name: /verification token/i }));
    expect(screen.getByLabelText("Secure token").getAttribute("autocomplete")).toBe("one-time-code");
  });
});
