# CURRENT

- active_loop: M5 implementation / PARTIAL
- target: M5
- iteration: 2
- last_gate: no M5 completion gate yet; researched policy/tax/invoice contracts and full maker checks pass, while M3/M4 retain their recorded partial status
- last_action: accepted ADR-0006; added versioned 48-hour cancellation fallback, approved merchant tax-profile calculation, invoice identity readiness and immutable invoice snapshot/numbering contracts
- parallel_update: imported the live legacy WordPress catalog into MongoDB/ImageKit staging (4 properties, 4 rooms, 11 destinations, 4 rates, 14 media); fixed homepage discovery cleanup AbortError; import verification and focused Playwright pass
- parallel_publication: owner-authorized legacy catalog publication is live (4 properties, 11 destinations, 14 approved media); public API, search, homepage cards and property gallery render Mongo/ImageKit data with 9/9 focused Playwright checks
- next_action: add customer-authorized booking application/Mongo repository and prove atomic booking+hold+invoice sequence idempotency/concurrency, then route/UI/PDF/E2E
- implementation_state: M0, M1, and M2 complete; M3 overall partial; M4 owner-deferred partial; M5 domain/policy/tax/invoice contracts implemented and tested but persistence/UI remain partial/unverified
- known_external_blocker: real merchants must still supply verified legal name/address/BIN/status and approved tax/fee profiles; owner-authorized legacy M4 content is publicly visible, while exact ownership/policy/location details remain follow-up work before transactional launch; official EPS contract blocks M6
- verification_rule: never run `npm run build`
- last_updated: 2026-08-28 Asia/Dhaka
