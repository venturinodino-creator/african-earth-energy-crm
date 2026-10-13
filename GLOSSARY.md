# African Earth Energy Offtaker CRM

The desk's working system for finding, qualifying and selling to the companies and municipalities that could buy African Earth Energy's solar and storage power.

## Language

### Selling

**Off-taker**:
A company or municipality that could buy power from an African Earth Energy site. One record type, living in exactly one of two lists.
_Avoid_: Customer, client, account (in user-facing text)

**Lead**:
An off-taker nobody has picked up yet. It has no sales stage and is listed on Off-taker Prospects.
_Avoid_: Prospect (the page is called Off-taker Prospects, but the record is a lead)

**Opportunity**:
An off-taker that somebody is actively working. It has a sales stage and sits on the Pipeline.
_Avoid_: Deal (in user-facing text)

**Opportunity page**:
What clicking an opportunity on the Pipeline opens: the header, the Next step and Account notes, the key figures, the Sales stages, then details, MW opportunities, stage history and the stakeholders seat by seat. A lead has none; its page is the company record.
_Avoid_: Deal page, panel

**Next step**:
What has to happen next on an opportunity and the date it is due by, set on its page and ticked done there. The soonest open one is the opportunity's next step on the page and the Pipeline list, and every open one is a follow-up.
_Avoid_: Task, action item

**Account note**:
A note about the account as a whole, whatever its stage. A **stage note** is a note filed on one stage and shown only on that stage's tab.

**Stage tab**:
One of the seven stages on an opportunity page. Clicking a tab opens that stage (its checklist, guidance, stage notes and the activity logged while the account sat there) and never moves the account; moving is the button under the tabs. **All activity**, under every tab, folds away.

**Work it**:
The act of moving a lead into the Pipeline at its first sales stage, Outreach. Done with the Work it button, or by logging a first touch to someone there. Never happens by merely opening a record.

**Site**:
One of African Earth Energy's own generation projects, with a catchment of off-takers around it.
_Avoid_: Project (for the physical plant; "project plan" means the ProjectManager.com task plan)

### Contacts

**Ladder seat**:
One of the seven roles at an off-taker that a rep wants a named person in: energy, sustainability, finance, executive, operations, engineering, procurement.
_Avoid_: Stakeholder slot

**Find**:
A person an agent or import believes exists, held in the review queue until a person accepts it. It is not a contact until accepted.
_Avoid_: Lead (that is an off-taker), scraped contact

**Review queue**:
Where finds wait to be accepted or discarded on the Contact finder page.

### Activity

**Follow-up**:
A date the CRM already holds that someone should act on: an open opportunity's target close date, a parked off-taker's revisit date, or a touch's follow-up date while nobody has answered it. It is not a separate task record, so nothing is entered twice, and it is completed where it already lives (closing the opportunity, clearing the revisit date, logging the next touch or the reply). The Activity page groups follow-ups as Overdue, Today, Next 7 days and Later; a touch's follow-up is labelled **Chase**.

**Touch**:
One logged activity aimed at one or more people at an off-taker: an email, a LinkedIn connection request or message, a call, or a meeting. It records who it went to, the channel, which touch it was in the round, what came of it (sent, replied, meeting booked, meeting held, declined, no answer) and when to follow up.
_Avoid_: Ping, hit

**Round**:
The reaching-out touches to one person: up to three, five working days apart. The touch number counts them; meetings and notes are not part of the round.
_Avoid_: Sequence, cadence (in user-facing text)

**Engagement**:
Where one person stands, worked out from the touches logged against them: Not contacted, Contacted, Replied, Engaging (a meeting booked or held), Declined, or Gone cold (three unanswered touches and the last one more than five working days old). Never typed in.
_Avoid_: Task, reminder

### Layout

**Shell**:
The frame around every page: the sidebar, the top bar, and on a phone the bottom bar.

**Top bar**:
The strip across the top of the shell holding search (press `/` to reach it), the province switcher, **+ New** and the account menu. It carries no page title.

**Page header**:
The title, subtitle and that page's own actions, shown at the top of the page content below the top bar.
_Avoid_: Page title bar, toolbar

**+ New**:
The top-bar menu listing every create action that exists (off-taker, contact, opportunity, log activity). Choosing one opens the **Drawer**. Hidden from read-only viewers.

**Drawer**:
The right-hand panel that **+ New** opens: one form, with pills to switch between off-taker, contact, opportunity and activity. It is for new records only; editing a record keeps the centred dialog, so the drawer means "new" and the dialog means "change". A possible duplicate is warned about as you type; an exact copy (the same name, or the same person at the same company) is still refused on save.
_Avoid_: Modal, sidebar

**Bottom bar**:
The five-tab phone navigation (Dashboard, Prospects, Pipeline, Contacts, More) that replaces the hamburger. More opens the full sidebar as a sheet.

**KPI row**:
The row of headline number cards at the top of a dashboard-style page.

**Card**:
The bordered surface that groups one topic on a page. Every page body is made of cards.

**View tab**:
A saved filter shown as a tab above a list (for example Priority list and Archive, a contact role, a sector tier). Changes which rows show; never what columns exist. Also used for the readings of one page (Board, Flow, Table).

**Filter bar**:
The search box and drop-downs between the view tabs and the table, with the grid/table switch and the result count.

**Province scope**:
The one province filter for the whole app, set from the switcher in the top bar and remembered on this device. "All provinces" means no narrowing. Dashboard, Off-taker Prospects, Contacts, Municipalities, Contact finder, Pipeline, Activity, News and Map follow it; Projects, Regions, Sectors, Analytics, Agent HQ, Playbook and the Calculator do not, and say "all provinces" under their title so the switcher is never read as covering them. A company in two provinces is in scope for either; a contact, an opportunity or a log entry takes its company's province.
_Avoid_: Region filter, region switcher

**Table card**:
One card around a table and its footer. The footer says how much of the list is on screen, how many rows the filters hide, and holds the pager.

**Selection bar**:
The strip that appears over a table when rows are ticked, offering **Export selected** and **Clear** and nothing else (no bulk delete, no bulk edit). The header tick selects the rows on the current page, not the whole result. A selection is cleared when the page, the tab, a filter, the search or the page number changes.
_Avoid_: Bulk actions bar

**Card grid**:
A set of cards laid out in an even grid, two across (three where it is named so), with a card that needs room spanning the full width.

**Header card**:
The card that opens a record page: an icon, the name, chips for its state, one line of description and the actions that can be taken on it.

**About card**:
The fact list on a record page: who or what it is and the figures the desk holds.

**Record page**:
The page for one off-taker, site, sector or municipality: a header card, then About | the working column | who is here. Three columns from 1440px, two below that, one on a phone. Its page header is only a breadcrumb.

**Wizard**:
A task laid out as numbered steps on a page of its own, where nothing is saved until the last step, so leaving at any step costs nothing. There is one today: **Import CSV** (Upload, Map columns, Review, Import). Rows it cannot import are **held back**, listed with the reason, and never silently dropped.
_Avoid_: Dialog, modal (the old import was one)
