import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import Home from "../../app/page";

describe("homepage baseline", () => {
  it("renders the preserved premium discovery experience", () => {
    render(<Home />);

    expect(screen.getByRole("heading", {
      level: 1,
      name: /Find your\s*Bangladesh sanctuary/i,
    })).toBeDefined();
    expect(screen.getByRole("tablist", { name: "Booking type" })).toBeDefined();
    expect(screen.getByRole("button", { name: /Check availability/i })).toBeDefined();
    expect(screen.getByRole("heading", { name: /Where comfort meets discovery/i })).toBeDefined();
    expect(screen.getAllByAltText("Book My Room")).toHaveLength(2);
    for (const logo of screen.getAllByAltText("Book My Room")) {
      expect(decodeURIComponent(logo.getAttribute("src") ?? "")).toContain("/bookmyroom-dark-no-bg.png");
    }
  });

  it("keeps the stay search selectors interactive", async () => {
    const user = userEvent.setup();
    render(<Home />);

    await user.click(screen.getByRole("button", { name: /Location\s*Dhaka/i }));
    const selector = screen.getByRole("dialog", { name: "Booking options" });
    await user.click(within(selector).getByRole("button", { name: /Sylhet/i }));

    expect(screen.getByRole("button", { name: /Location\s*Sylhet/i })).toBeDefined();
  });

  it("keeps unverified Tour and Car services non-bookable", async () => {
    const user = userEvent.setup();
    render(<Home />);

    const tabs = screen.getByRole("tablist", { name: "Booking type" });
    for (const service of ["Tour", "Car"]) {
      await user.click(within(tabs).getByRole("tab", { name: service }));
      expect(screen.getByRole("button", {
        name: `${service} booking coming soon`,
      }).hasAttribute("disabled")).toBe(true);
    }
  });

  it("ignores a pending discovery response after unmount without aborting it", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const view = render(<Home />);
      view.unmount();
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/catalog/public-home", { cache: "no-store" });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
