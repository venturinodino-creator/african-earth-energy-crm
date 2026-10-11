# Take WireFrame's layout, not its engine

The CRM adopts the page layouts from the WireFrame template (light sidebar, top bar with search, **+ New** and account, page header, KPI row and cards, view tabs on lists, three-column record page, five-tab phone bottom bar), re-expressed in this repo's own stylesheet with the AEEG colours and fonts. We did not port the CRM onto WireFrame's config-driven core: that would turn Agent HQ, project analytics, the fit score and the finder into modules and rewrite most of the app for no user-visible gain. WireFrame stays a reference for layout only; nothing is copied from it as code, so the two can evolve separately.

Decided 2026-10-10. Not adopted: WireFrame's global region switcher (a data-scoping feature), bulk-select and per-page export on tables, and its blue palette.

## Amended 2026-10-11

That first restyle left four things out: a global province scope, bulk select, per-page export and a full-page import. The owner then asked for every change needed to match WireFrame's screens, and **all four exclusions were reversed**. The region switcher became the **Province scope**; bulk select and per-page export became the **Selection bar** with **Export selected**; the small import dialog became the **Import wizard**. Alongside them came the Settings page, the **+ New** drawer, Activity as follow-ups with a calendar, the Map's side panel, the News filter card, and the Dashboard's Needs attention and Coming up cards.

What did not change: WireFrame is still a layout reference only. None of its code or its config-driven engine is used, and the blue palette is still not adopted. The province scope is one app-wide setting held in this app's own state, not WireFrame's region feature. Nothing in the amendment added a table, a column or a migration.
