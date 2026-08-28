# Requirements traceability

Status legend: `planned` means represented in a milestone but not verified; `future` means explicitly outside
Release 1. Update evidence only after real checks.

| Requirement group | Canonical detail | Milestone(s) | Status |
|---|---|---:|---|
| Multi-district stay marketplace | PROJECT-SPEC §§1–2,4 | M2–M4 | M2 complete; M3 atomic repair verified but overall partial; M4 partial |
| Location/date/guest search | §4; ARCHITECTURE availability | M3–M4 | atomic holds verified; occupancy/hold-aware search incomplete; M4 public search partial |
| All required filters and sorts | PROJECT-SPEC §4 | M3 | verification gap; public UI does not yet expose the full required set |
| Budget hotels / Eco Resorts | PROJECT-SPEC §4 homepage | M3–M4 | published-data queries implemented; launch content pending |
| Destinations / offers / reviews | §§4,7,9 | M4,M7,M9 | planned |
| WhatsApp / newsletter | §11 | M10 | planned |
| Property gallery/details/rooms | §4; DATA-MODEL catalog | M2,M4 | M2 complete; M4 planned |
| Calendar/live availability/price | §§4–5; ADR-0003 | M3–M5 | concurrent no-oversell repair independently verified; broader M3 search/calendar acceptance partial; M4 uses conservative starting-price semantics |
| Map/nearby/policies/share/contact | §4 | M2,M4 | planned |
| Booking/guest/confirmation/history | §§5,7 | M5–M7 | M5 domain lifecycle, guest/consent validation and immutable snapshots started; application/UI unbuilt |
| Invoice download | §§5,7; DATA-MODEL | M5,M7 | ADR-0006 identity/numbering contract and immutable invoice snapshot tested; persistence/render/download remain partial |
| Email and SMS | §11 | M10 | planned |
| EPS payment | §6 | M6 | planned / external contract |
| Customer dashboard (all items) | §7 | M1,M5,M7 | planned |
| Vendor dashboard (all items) | §8 | M1–M3,M8 | M1-M2 complete; M3 calendar partial; M8 planned |
| Admin control (all items) | §9 | M1,M2,M9 | M1-M2 complete; M9 planned |
| Commission | §§9–10; DATA-MODEL finance | M9 | planned |
| Featured/ads/badges/subscriptions | §10 | M9 | planned |
| Authentication/RBAC/API/session | §§3,13 | M1,M11 | M1 complete; M11 launch hardening remains planned |
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
  The owner explicitly authorized completion after that verdict, so M1 is complete. No comprehensive manual WCAG
  The owner explicitly authorized completion after that verdict, so M1 is complete. No comprehensive manual WCAG
  audit or production delivery-provider success is claimed; those remain later gates.

## M2 candidate evidence — 2026-08-27

- Catalog and Onboarding: ImageKit signer adapter, models, vendor routes.
- Checks: integration tests and e2e passed. M2 explicitly authorized.

## M3 candidate evidence — 2026-08-27

- Search and Availability: Atomic holds capability, rates, offers, vendor calendar UI and public search UI.
- Checks: `npm run typecheck`, `npm run lint`, `vitest run tests/integration` (availability, pricing, search), `playwright test tests/e2e` (vendor-calendar, search) all passed. The owner explicitly authorized completion.
- 2026-08-28 correction: conditional per-night inventory version writes and gated real-replica races now prove
  no-oversell; idempotency and booking uniqueness regressions pass. The independent verifier approved this atomic
  repair but rejected overall M3 completion because hold/occupancy-aware search, total-price pagination/sorts, full
  filter/calendar UI, query-plan evidence, and accessibility evidence remain incomplete.

## M4 partial evidence and M3 correction — 2026-08-28

- Public catalog reads expose only published properties/destinations, active rooms, verified nearby places, approved
  environment-owned ImageKit media, review-safe empty states pending M7 provenance, and integer-minor-unit starting rates. Dynamic property
  and destination routes, truthful conditional structured data, canonical/OG metadata, robots/sitemap, noindex search,
  and resilient empty/error/not-found states are established.
- Homepage data is no longer hard-coded business truth. Reference-host images, placeholder avatars/profiles, invented
  testimonials, ratings, properties and prices are removed; responsive Next Image and a clearly labeled local media
  fallback preserve layout until owner-approved ImageKit assets exist.
- Maker checks: typecheck and lint exit 0; full Vitest 23/77; integration 9/45; Playwright 17/17 across public,
  auth, vendor and admin regression scenarios. No build was run. Independent review first found a P1 Mongo identity
  mismatch; canonical `_id` mapping and related safeguards were corrected, and fresh scoped re-verification returned
  `APPROVE` (9/9 focused unit/SEO/smoke and 12/12 focused integration). The owner approved this update on 2026-08-28.
  Overall M4 remains partial because the broader homepage/detail/filter/a11y/performance acceptance surface and
  controlled content inputs are incomplete and the independent verifier did not approve milestone completion.
- Correction: the original sequential test could not support concurrent/atomic acceptance. Conditional per-night
  version writes and real concurrent replica-set tests now pass independent atomic verification. Overall M3 remains
  partial for the separately recorded search/UI/query-plan/accessibility gaps.

## M4 legacy catalog migration evidence — 2026-08-28

- The public WordPress API at `bookmyroom.site` returned 4 hotels, 4 rooms and 10 tour-destination terms; the import
  also created the Dhaka hotel location destination, producing 11 staged destinations.
- The idempotent importer archived 22 exact source payloads and inserted 4 draft properties, 4 room types, 4 integer-
  minor-unit rate plans and 14 pending ImageKit media records. One run manifest and one pre-write recovery snapshot
  were persisted. All 14 ImageKit delivery URLs answered successfully during read-only verification.
- Sparse legacy content remains `DRAFT`/`UNVERIFIED`/`PENDING`; publication is still blocked on owner assignment,
  exact policies/class/room defaults, location validation, alt-text and image-rights moderation. This is migration
  evidence, not M4 completion or publication approval.
- Homepage fetch cleanup no longer aborts an in-flight request during unmount. Vitest 25 files/93 tests, focused
  Playwright public discovery 5/5, typecheck and lint pass; no build command was run.

## M4 legacy catalog owner-authorized publication evidence — 2026-08-28

- The owner explicitly authorized making the imported information and images visible. The guarded publisher stored a
  pre-publication recovery snapshot and audit event, then published 4 properties and 11 destinations and approved all
  14 imported ImageKit media records without changing the preserved `UNVERIFIED` location truth.
- Read-only verification reports 4 properties, 4 room types, 4 rate plans, 11 destinations and 14 media records; every
  ImageKit delivery URL is reachable. The public-home API returns the exact four legacy hotels and their integer-minor-
  unit prices, including a truthful no-price state for Hotel 4.
- Fresh Playwright verification proved the four hotels render on search, Hotel 1's homepage card image decodes, and its
  detail gallery image decodes from ImageKit with no page runtime error. Focused browser checks pass 9/9; Vitest passes
  26 files/101 tests; typecheck and lint pass. No build command was run.
- This owner-authorized catalog publication does not declare overall M4 complete; exact ownership, policies, legal
  address/location verification and the broader M4 acceptance surface remain separately governed follow-up work.
