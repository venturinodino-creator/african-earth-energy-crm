# The database stamps who made a change

Every change to the CRM's records is attributed by the database, from the sign-in that made it, not by the page or script that sends it. The browser used to send the author's name itself, which any page or script can get wrong, leave out or fake (221 touches were logged with no author at all), and tracking which people use the CRM is only worth having if the name cannot be spoofed. Agents still sign in as a person, so they declare themselves as an agent alongside; the database records the person's sign-in either way, and an agent's change reads as the agent run as that person.

## Considered Options

- **The page sends the name, everywhere.** Cheapest, and how next steps worked, but unenforced: changes made from a script, the API or an older page carry whatever they say.
- **A separate login for each agent.** Cleanest attribution, but every job then needs its own account, password and admin role to manage and rotate.
