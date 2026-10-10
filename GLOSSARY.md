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

**Work it**:
The act of moving a lead into the Pipeline at its first sales stage. Never happens by merely opening a record.

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

### Layout

**Shell**:
The frame around every page: the sidebar, the top bar, and on a phone the bottom bar.

**Top bar**:
The strip across the top of the shell holding search, **+ New** and the account menu. It carries no page title.

**Page header**:
The title, subtitle and that page's own actions, shown at the top of the page content below the top bar.
_Avoid_: Page title bar, toolbar

**+ New**:
The top-bar menu listing every create action that exists (off-taker, contact, opportunity, log activity). Hidden from read-only viewers.

**Bottom bar**:
The five-tab phone navigation (Dashboard, Prospects, Pipeline, Contacts, More) that replaces the hamburger. More opens the full sidebar as a sheet.

**KPI row**:
The row of headline number cards at the top of a dashboard-style page.

**Card**:
The bordered surface that groups one topic on a page. Every page body is made of cards.

**View tab**:
A saved filter shown as a tab above a list (for example All, Hot, Renewing). Changes which rows show; never what columns exist.

**Record page**:
The page for one off-taker or site: a header card, then a body of three columns (about, activity, related).
