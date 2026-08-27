import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import OnboardingPanel from "../../app/vendor/onboarding/onboarding-panel";
import AdminCatalogPanel from "../../app/admin/catalog/admin-catalog-panel";

describe("catalog private UI", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders every required property type and keeps property work disabled until onboarding", () => {
    render(<OnboardingPanel />);
    expect(screen.getByRole("heading", { name: "Turn a beautiful stay into a trusted listing." })).toBeTruthy();
    for (const type of ["HOTEL", "RESORT", "ECO_RESORT", "HOMESTAY", "COTTAGE", "VILLA"]) expect(screen.getByRole("option", { name: type })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Create property draft/ }).matches(":disabled")).toBe(true);
    expect(screen.getByText(/Nothing publishes by accident/)).toBeTruthy();
  });

  it("keeps property tools gated until the server reports an approved vendor", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { vendor: { id: "vendor-browser-1", status: "DRAFT" } } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { vendor: { id: "vendor-browser-1", status: "APPROVED" } } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<OnboardingPanel />);
    fireEvent.change(screen.getByLabelText("Public business name"), { target: { value: "Megh Bari" } });
    fireEvent.change(screen.getByLabelText("Legal business name"), { target: { value: "Megh Bari Ltd" } });
    fireEvent.change(screen.getByLabelText("Contact email"), { target: { value: "owner@example.test" } });
    fireEvent.change(screen.getByLabelText("Bangladesh mobile"), { target: { value: "+8801712345678" } });
    fireEvent.click(screen.getByRole("button", { name: /Save organization/ }));
    await waitFor(() => expect(screen.getByText("vendor-browser-1")).toBeTruthy());
    expect(screen.getByRole("button", { name: /Create property draft/ }).matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Refresh approval" }));
    await waitFor(() => expect(screen.getByText("APPROVED")).toBeTruthy());
    expect(screen.getByRole("button", { name: /Create property draft/ }).matches(":disabled")).toBe(false);
  });

  it("renders explicit admin evidence controls", () => {
    render(<AdminCatalogPanel />);
    expect(screen.getByRole("heading", { name: "Publish evidence, not promises." })).toBeTruthy();
    expect(screen.getByLabelText("Location evidence verified")).toBeTruthy();
    expect(screen.getByLabelText("Media rights and metadata approved")).toBeTruthy();
  });
});
