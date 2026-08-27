import type { Metadata } from "next";

import AdminCatalogPanel from "./admin-catalog-panel";

export const metadata: Metadata = {
  title: "Catalog review | Book My Room",
  description: "Review Book My Room vendors and property publication evidence.",
  robots: { index: false, follow: false },
};

export default function AdminCatalogPage() {
  return <AdminCatalogPanel />;
}
