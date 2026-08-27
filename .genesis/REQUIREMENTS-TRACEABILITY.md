# Requirements traceability

Status legend: `planned` means represented in a milestone but not verified; `future` means explicitly outside
Release 1. Update evidence only after real checks.

| Requirement group | Canonical detail | Milestone(s) | Status |
|---|---|---:|---|
| Multi-district stay marketplace | PROJECT-SPEC §§1–2,4 | M2–M4 | planned |
| Location/date/guest search | §4; ARCHITECTURE availability | M3–M4 | planned |
| All required filters and sorts | PROJECT-SPEC §4 | M3 | planned |
| Budget hotels / Eco Resorts | PROJECT-SPEC §4 homepage | M3–M4 | planned |
| Destinations / offers / reviews | §§4,7,9 | M4,M7,M9 | planned |
| WhatsApp / newsletter | §11 | M10 | planned |
| Property gallery/details/rooms | §4; DATA-MODEL catalog | M2,M4 | planned |
| Calendar/live availability/price | §§4–5; ADR-0003 | M3–M5 | planned |
| Map/nearby/policies/share/contact | §4 | M2,M4 | planned |
| Booking/guest/confirmation/history | §§5,7 | M5–M7 | planned |
| Invoice download | §§5,7; DATA-MODEL | M5,M7 | planned |
| Email and SMS | §11 | M10 | planned |
| EPS payment | §6 | M6 | planned / external contract |
| Customer dashboard (all items) | §7 | M1,M5,M7 | planned |
| Vendor dashboard (all items) | §8 | M1–M3,M8 | planned |
| Admin control (all items) | §9 | M1,M2,M9 | planned |
| Commission | §§9–10; DATA-MODEL finance | M9 | planned |
| Featured/ads/badges/subscriptions | §10 | M9 | planned |
| Authentication/RBAC/API/session | §§3,13 | M1,M11 | implemented / independently approved M1 candidate; awaiting owner authorization |
| Payment/input/upload security | §§6,13 | M2,M6,M11 | planned |
| Backup/firewall/operations | §§13–14; QUALITY-GATES | M11 | planned |
| Mobile-first/performance | §§12,14 | M4,M11 | planned |
| SEO architecture/content/admin | §§9,12 | M4,M9,M11 | planned |
| Clean scalable architecture | ARCHITECTURE; ADR-0002 | M0–M11 | planned |
| Tour packages | PROJECT-SPEC §2 future | M12+ | future |
| Car rental | PROJECT-SPEC §2 future | M12+ | future |
| Guide booking | PROJECT-SPEC §2 future | M12+ | future |
| National bus | PROJECT-SPEC §2 future | M12+ | future |
| Domestic flight | PROJECT-SPEC §2 future | M12+ | future |
| Android/iOS apps | PROJECT-SPEC §2 future | M12+ | future |
| AI recommendations | PROJECT-SPEC §2 future | M12+ | future |
| Loyalty rewards | PROJECT-SPEC §2 future | M12+ | future |

## Existing frontend adoption map

- Preserve: homepage visual language, responsive layout, search/date/guest interaction patterns, stay/destination/
  testimonial sections and reduced-motion support.
- Replace/evolve: hard-coded stays/destinations/reviews/prices; UI-only search; plain image elements and hotlinked
  assets; placeholder car/tour booking; static metadata/footer; inaccessible or unvalidated production behaviors.
- Do not treat existing copy, sample prices, ratings, availability, tours/cars, or remote assets as authoritative
  business data.

## M0 evidence — 2026-08-27

- Clean scalable architecture foundation: `src/modules/README.md`, `src/platform/README.md`, validated/cached
  server-only environment access, and integer-minor-unit BDT money primitive.
- Existing frontend adoption: `tests/smoke/homepage.test.tsx` covers preserved hero/search structure, district
  interaction, and non-bookable Tour/Car behavior. ADR-0005 now contains the binding cross-application design rules.
- Asset migration: `.genesis/inventories/remote-assets.md` records 19 remote image occurrences / 17 unique URLs for
  authorized ImageKit migration in M4; M0 intentionally does not claim migration complete.
- Checks: `npm.cmd run typecheck` exit 0; `npm.cmd run lint` exit 0 with 13 existing raw-image warnings;
  `npm.cmd run test` exit 0 with 3 files / 10 tests. Independent re-verification verdict: `APPROVE`.

## M1 candidate evidence — 2026-08-27

- Identity/session: runtime schemas, Argon2id passwords, hashed opaque database sessions, one-time contact/reset
  tokens, atomic rotation/replay rejection, global revocation after reset, secure cookie contract, generic recovery.
- Authorization/audit: current server-side grant resolver, explicit customer/vendor/admin/super-admin matrix,
  cross-customer/cross-vendor denial tests, mandatory actor/target identity, and transaction-coupled append-only
  success/denial/replay/rate-limit audit events.
- HTTP/UI: same-origin mutation policy, Mongo-backed abuse buckets, versioned auth routes, private noindex auth page,
  responsive labeled forms, and existing homepage design preservation.
- Evidence: exact M1 demo commands exit 0. A real one-node Mongo replica set proves transaction capability, atomic
  identity/audit rollback/commit, token consumption, session rotation/replay, exact indexes, and standalone rejection.
  Recovery request behavior is existence-independent. Playwright now proves `/auth` at desktop/tablet/mobile,
  title/noindex, overflow, 44px targets including the home link, visible focus, natural Tab/Enter traversal across all
  identity modes, and generic recovery UX: `npm.cmd run test:e2e` exit 0, 5/5.
- Final computed checks: typecheck exit 0; lint exit 0 with 13 known homepage warnings; test exit 0 (13 files/32);
  integration exit 0 (3 files/11); E2E exit 0 (5/5). Fresh independent verdict is `APPROVE` with no P0/P1 finding.
  M1 remains not complete pending explicit owner authorization. No manual WCAG audit or production delivery-provider
  success is claimed.
