# ADR-0005 — Brand, domain, and existing UI

- Date: 2026-08-27
- Status: accepted

## Decision

The production canonical origin is `https://bookmyroom.site`. Preserve the existing homepage’s premium green/lime,
editorial, rounded, travel-focused visual direction while converting it to a complete data-driven product.

## Why

The user has already designed part of the homepage and requested it as the frontend starting point. The domain is a
deployment target, not a content/reference dependency.

## Consequences

Do not replace the UI with a generic template. Existing sample data and remote website assets are not product truth.
Move managed production media to ImageKit, use original/authorized content, and implement canonical SEO for the domain.

## Binding frontend preservation contract

The current homepage is the visual reference implementation for every Release 1 surface. Search, property details,
checkout, authentication, customer/vendor dashboards, and the admin control plane must extend this system rather
than introduce an unrelated dashboard theme.

- Palette: warm paper surfaces, deep forest/ink green, restrained pale-blue support surfaces, and lime as the single
  dominant action/accent color. Lime is for actions, selected states, small labels, and intentional highlights—not
  large competing backgrounds.
- Typography: Manrope is the editorial display/heading face and DM Sans is the readable body/UI face. Preserve the
  tight large-heading tracking, clear hierarchy, and compact uppercase kickers. Do not silently replace these with a
  generic system-font-only treatment.
- Shape and depth: preserve pill actions, rounded search controls, 16–24px cards/panels, soft borders, restrained
  glass/blur, image overlays, subtle grain, and controlled shadows. Dense dashboards may reduce radii/spacing only
  through shared tokens, never by switching visual language.
- Layout and imagery: retain generous editorial spacing, scenic Bangladesh travel imagery, immersive image cards,
  and the hero/search composition. Managed production images require verified rights, ImageKit ownership metadata,
  responsive transformations, dimensions, useful alt text, and fallbacks.
- Motion: retain purposeful breathing/entrance/hover feedback, keep continuous motion restrained, avoid layout
  jank, and always honor `prefers-reduced-motion`. Interaction must remain usable without hover.
- Responsive/accessibility: desktop, tablet, and mobile are equal acceptance targets. Preserve mobile sheets and
  adaptive grids, visible keyboard focus, semantic controls, 44px practical touch targets, and WCAG 2.2 AA contrast.
- States: loading, empty, error, disabled, unavailable, success, and destructive states must look native to this
  system. Tour and Car remain visibly non-bookable/“Coming soon” until independently implemented and verified.

### Change control

Refactoring components, extracting tokens, replacing hard-coded content with real server data, and improving
responsiveness/accessibility/performance are allowed when rendered appearance remains recognizably consistent.
Before any material change to palette, typefaces, hero composition, card language, imagery direction, animation
character, or global spacing rhythm, show the owner the reason and proposed visual change and obtain approval.

Every milestone touching UI must include regression evidence for representative desktop, tablet, and mobile
viewports and must explicitly state how this contract was preserved. M0 smoke tests protect structure and behavior;
M4 adds visual, accessibility, responsive, and media-migration evidence.
