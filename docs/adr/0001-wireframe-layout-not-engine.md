# Take WireFrame's layout, not its engine

The CRM adopts the page layouts from the WireFrame template (light sidebar, top bar with search, **+ New** and account, page header, KPI row and cards, view tabs on lists, three-column record page, five-tab phone bottom bar), re-expressed in this repo's own stylesheet with the AEEG colours and fonts. We did not port the CRM onto WireFrame's config-driven core: that would turn Agent HQ, project analytics, the fit score and the finder into modules and rewrite most of the app for no user-visible gain. WireFrame stays a reference for layout only; nothing is copied from it as code, so the two can evolve separately.

Decided 2026-10-10. Not adopted: WireFrame's global region switcher (a data-scoping feature), bulk-select and per-page export on tables, and its blue palette.
