/* The name a script declares itself by, as an agent, on every request it makes to the CRM
   (the X-Aee-Agent header). The database records it beside the person whose sign-in the
   script uses, so the Change log shows the change as "<agent> (run as <name>)" and never
   counts it as that person's own work (docs/adr/0002-database-stamps-the-author.md).

   The name is the script that was started: a shared helper such as finder-gaps.js reads as
   apollo-daily when the daily Apollo run uses it, and as finder-gaps when run on its own.
   Loaded from anywhere else (a test), it is the helper's own file name. AEE_AGENT overrides
   both, so a runner can name a job itself. Letters, digits and dashes only, as the database
   keeps it. */
'use strict';

const path = require('path');

const clean = s => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

/* `selfFile` is the calling script's own __filename; `mainFile` defaults to the script Node started. */
function agentName(selfFile, mainFile) {
  if (clean(process.env.AEE_AGENT)) return clean(process.env.AEE_AGENT);
  const main = mainFile === undefined ? (require.main && require.main.filename) : mainFile;
  const started = main && path.dirname(main) === path.dirname(selfFile) ? main : selfFile;
  return clean(path.basename(started, '.js'));
}

module.exports = { agentName };
