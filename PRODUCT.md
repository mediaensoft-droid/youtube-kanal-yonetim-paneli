# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are operators who run portfolios of multiple YouTube channels at once — including the founder's own portfolio of faceless/multi-language content channels (history, mystery, documentary-style, etc.) — plus paying customers on Free/Standart/Pro/Ultra plans who manage their own channel portfolios through the same product. The job: keep dozens of channels organized by category, concept, language and target country, know when each one is due to publish, and see growth/health at a glance without falling back to spreadsheets or juggling single-channel tools.

## Product Purpose

Centralizes management of many YouTube channels in one panel: categorization (category/concept/language/target country), a weekly publish-day/time pattern per channel with a visual publish calendar (planned/published/skipped tracking), automatic daily stat refresh (subscribers/views/video count) with growth trend history, and an optional AI-assisted channel analysis panel (NexLev data + Claude) for audience fit, RPM and revenue estimates. Success is an operator being able to run a large channel portfolio from a single dashboard instead of ad hoc spreadsheets and per-channel tools.

## Positioning

Multi-channel operation management at scale is the thing a neighboring product can't truthfully claim: a dashboard, publish calendar, and category/language/country breakdown that cover an entire portfolio of channels at once, plus automatic daily stat refresh — where single-channel-focused tools (TubeBuddy/VidIQ) and generic trackers (Sheets/Notion) require the operator to do the cross-channel aggregation by hand.

## Operating Context

- Sign-in is Google OAuth only (no email/password); the app is multi-tenant, each user sees only their own channels/categories/concepts/schedule.
- A channel is added by URL/ID and tagged with category, concept, one or more languages, and one or more target countries.
- Each channel has a weekly publish-day pattern and a default publish time; the /calendar page shows a month grid (day-by-day agenda on mobile) of planned/published/skipped status per channel per date, with per-month pattern overrides.
- The Dashboard shows category distribution (donut, % labels), language distribution (bar chart with flags), a country distribution map (Yandex Maps, SVG fallback), and a live local-clock widget per target country.
- An optional /analysis panel (Ultra plan) calls NexLev + Claude for per-channel audience-fit, RPM and revenue-estimate analysis; results are cached globally across all users because NexLev's API quota is small (200 units/month).
- Billing runs through iyzico (Turkish Lira subscription checkout) with Free/Standart/Pro/Ultra plans, each with a channel-count limit.
- A /profile page lets a user edit their display name and upload a custom avatar (Vercel Blob storage); Google's name/photo only seed the account at first sign-in, after that the app-stored values are authoritative.

## Capabilities and Constraints

- Next.js App Router, Turso/libSQL (SQLite-compatible) for data, NextAuth (Google) for auth, Tailwind for styling, hosted on Vercel.
- YouTube Data API supplies channel stats/thumbnails — quota-bound, refreshed on a schedule/manually rather than continuously.
- NexLev API is quota-constrained (200 units/month); analysis results are cached and shared across all users to conserve it.
- Yandex Maps (not Google Maps) powers the country-distribution map; an SVG/d3 fallback renders if the Yandex key is missing/invalid.
- PWA-installable.
- UI language is Turkish throughout.

## Brand Commitments

Name: "Kanal Paneli". Mark: a YouTube-style red rounded-rect play-button glyph. Palette: YouTube red (#FF0000) on a near-black dark surface — dark theme only, no light theme currently. Voice: plain, direct Turkish.

## Evidence on Hand

The product already runs a real, active channel portfolio (e.g. "Tarihte Türk", "Arqueonix", "Crónicas Ocultas", "Echoes Beyond", "Lumière de Grâce" and others) with real categories, languages, target countries and stats flowing through it live — this is real operating evidence, not sample data. No testimonials, case studies, press, or third-party endorsements exist yet; future work must not invent any.

## Product Principles

1. Scale over single-channel depth — every feature should make managing many channels at once easier, not compete with deep single-channel analytics tools.
2. Turkish-first, global-reach — the operator and UI are Turkish, but the channels themselves span many languages/countries, so multi-market facts (flags, local time, language mix) must stay visible and accurate.
3. Respect third-party quotas — YouTube and NexLev API usage are quota-constrained; caching and conservative refresh are product constraints, not incidental implementation details.
4. Operational trust — this handles a real income-generating channel portfolio (the operator's own, plus paying customers'), so correctness and clear status (published/skipped/planned, refresh recency) outrank visual flourish.
5. Low-friction onboarding — Google-only sign-in, minimal fields to add a channel, no manual account setup.
