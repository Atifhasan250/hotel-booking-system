import type { Metadata } from "next";

import OnboardingPanel from "./onboarding-panel";

export const metadata: Metadata = {
  title: "Vendor studio | Book My Room",
  description: "Create and prepare an approved Book My Room property catalog.",
  robots: { index: false, follow: false },
};

export default function VendorOnboardingPage() {
  return <OnboardingPanel />;
}
