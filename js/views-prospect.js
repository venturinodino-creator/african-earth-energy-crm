/* ═══════════════════════════════════════════════════════════════════
   Prospect profile
   One prospect on one page. A prospect has no verified load so it
   cannot be fit-scored — the researched overview is what a rep works
   from instead.
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ═══════════════════════════════════════════════════════════════
   PROSPECT PROFILE — everything the desk knows about one company,
   on one page, before anybody dials. The blurb is the point of it:
   a prospect with no load figures cannot be fit-scored, so what a
   rep has to go on is a readable account of the business.
   ═══════════════════════════════════════════════════════════════ */

/* The AEE site this prospect was filed against, which is not always the
   nearest one — a record can be attached to a catchment deliberately. */
function assignedSite(p) {
  return p.nearSite ? state.projects.find(x => x.id === p.nearSite) : null;
}

function renderProspect() {
  const p = getProspect(state.detailId);
  if (!p) { nav('prospects'); return; }

  const sec = sectorOf(p.sectorId);
  const site = assignedSite(p);
  const promotedTo = p.promotedTo ? getOfftaker(p.promotedTo) : null;
  const km = site && num(p.lat) && num(p.lng)
    ? haversineKm(p.lat, p.lng, site.lat, site.lng) : null;

  setPage(p.name, [sectorName(p.sectorId), p.town, p.province].filter(Boolean).join(' · '),
    '<button class="btn btn-outline btn-sm" onclick="nav(\'prospects\')">All prospects</button>' +
    (site ? '<button class="btn btn-outline btn-sm" onclick="nav(\'regions\')">' +
      icon('map', 14) + ' Catchment</button>' : '') +
    '<button class="btn btn-outline btn-sm" data-admin-only onclick="openEditProspect(\'' + esc(p.id) + '\')">' +
      icon('edit', 14) + ' Edit</button>' +
    '<button class="btn btn-outline btn-sm" onclick="openLogInteraction(\'\',\'' + esc(p.id) + '\')">' +
      icon('note', 14) + ' Log activity</button>' +
    '<button class="btn btn-outline btn-sm" data-admin-only onclick="openAddDeal(\'\',\'' + esc(p.id) + '\')">' +
      icon('bolt', 14) + ' New opportunity</button>' +
    (promotedTo && promotedTo.id
      ? '<button class="btn btn-primary btn-sm" onclick="nav(\'detail\',{id:\'' + esc(promotedTo.id) + '\'})">Open offtaker</button>'
      : '<button class="btn btn-primary btn-sm" data-admin-only onclick="promoteProspect(\'' + esc(p.id) + '\')">' +
        icon('plus', 14) + ' Convert to offtaker</button>'));

  const hero =
    '<div class="detail-hero">' +
      '<div class="dh-top">' +
        '<div class="dh-icon">' + sectorIcon(p.sectorId, 24) + '</div>' +
        '<div style="flex:1;min-width:220px">' +
          '<div class="dh-title">' + esc(p.name) + '</div>' +
          '<div class="dh-sub">' +
            sectorBadge(p.sectorId) +
            '<span class="badge ' + (p.status === 'promoted' ? 'b-contracted'
              : p.status === 'new' ? 'b-prospect' : 'b-medium') + '">' +
              esc(PROSPECT_STATUS[p.status] || p.status) + '</span>' +
            (sec ? '<span class="badge b-tier-' + sec.tier + '">Tier ' + sec.tier + '</span>' : '') +
            (safeHref(p.website) ? '<a class="ext-link" href="' + esc(safeHref(p.website)) +
              '" target="_blank" rel="noopener">Website</a>' : '') +
          '</div>' +
          (p.note ? '<p style="font-size:12.5px;color:var(--muted2);line-height:1.6;margin-top:10px;max-width:70ch">' +
            esc(p.note) + '</p>' : '') +
          contactLineHtml(p) +
          (p.address ? '<div style="font-size:11px;color:var(--muted);margin-top:4px">' +
            esc(p.address) + '</div>' : '') +
        '</div>' +
      '</div>' +
    '</div>';

  /* The overview. Written for someone about to sell electricity: what
     the company does, how big, who owns it, what shape the load is and
     what would make it sign. Empty is said plainly rather than padded
     with something generic — a made-up paragraph is worse than a gap. */
  const overview =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Company overview</div>' +
      '<div class="card-sub">Written for an energy seller — scale, ownership, load shape and what would make them buy</div></div></div>' +
      (p.blurb
        ? '<div style="font-size:12.5px;color:var(--text2);line-height:1.7;max-width:80ch;white-space:pre-line">' +
          esc(p.blurb) + '</div>'
        : '<div class="fg-hint">No overview written yet. Until someone researches this company, the ' +
          'record is a name and a sector — worth doing before it goes on a call list.</div>') +
    '</div>';

  /* How to approach it, and how much the contact details are worth. */
  const approach = (p.notes || p.contactSource)
    ? '<div class="card">' +
        '<div class="card-header"><div><div class="card-title">How to approach it</div></div></div>' +
        (p.notes ? '<div style="font-size:12.5px;color:var(--text2);line-height:1.7;max-width:80ch">' +
          esc(p.notes) + '</div>' : '') +
        (p.contactSource ? '<div class="fg-hint" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">' +
          'Contact details from: ' + esc(p.contactSource) + '</div>' : '') +
      '</div>'
    : '';

  const placing =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Load &amp; placing</div></div></div>' +
      '<dl class="kv">' +
        '<dt>Estimated load</dt><dd>' + (loadLabelHtml(p).replace(/^ · /, '') || 'not established') + '</dd>' +
        '<dt>Basis</dt><dd>' + esc(LOAD_BASIS_LABEL[p.loadBasis] || 'unknown') +
          (p.loadMethod ? ' — ' + esc(p.loadMethod) : '') + '</dd>' +
        '<dt>Filed against</dt><dd>' + (site ? esc(site.name) : 'no site') + '</dd>' +
        '<dt>Distance to site</dt><dd>' + (km === null ? '—' : Math.round(km) + ' km') + '</dd>' +
        '<dt>Site capacity</dt><dd>' + (site ? fmtNum(site.mw) + ' MW, COD ' + esc(site.cod) : '—') + '</dd>' +
      '</dl>' +
      '<div class="fg-hint" style="margin-top:12px">A prospect carries no verified load, so it is not fit-scored. ' +
      'Convert it once you know roughly what it consumes — that is when it starts being ranked.</div>' +
    '</div>';

  const sectorCard = sec ? '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Sector — ' + esc(sec.name) + '</div>' +
      '<div class="card-sub">Tier ' + sec.tier + ' · PPA fit ' + sec.ppaFit + '/5 · ' + esc(sec.cycleMonths) + ' month cycle</div></div>' +
      '<button class="btn btn-ghost btn-xs" onclick="nav(\'sector\',{id:\'' + esc(sec.id) + '\'})">Open</button></div>' +
      '<dl class="kv">' +
        '<dt>Typical load</dt><dd>' + esc(sec.loadMw) + ' MW</dd>' +
        '<dt>Typical deal</dt><dd>' + esc(sec.dealMw) + ' MW</dd>' +
        '<dt>Load profile</dt><dd>' + esc(sec.profile) + '</dd>' +
        '<dt>Solar match</dt><dd>' + esc(sec.solarMatch) + '</dd>' +
        '<dt>Who to ask for</dt><dd>' + esc((sec.roles || []).slice(0, 2).join(', ') || '—') + '</dd>' +
      '</dl>' +
    '</div>' : '';

  const opps = dealsForProspect(p.id);
  const oppsHtml =
    '<div class="card">' +
      '<div class="card-header"><div><div class="card-title">Opportunities (' + opps.length + ')</div>' +
      '<div class="card-sub">They move across with the lead when it is promoted</div></div>' +
      '<button class="btn btn-ghost btn-xs" data-admin-only onclick="openAddDeal(\'\',\'' + esc(p.id) + '\')">Add</button></div>' +
      (opps.length ? opps.map(d => {
        const st = PIPELINE_STAGES.find(x => x.id === d.stage) || {};
        return '<div class="person-row" style="cursor:pointer" onclick="openEditDeal(\'' + esc(d.id) + '\')">' +
          '<div style="min-width:0;flex:1">' +
            '<div class="person-name">' + fmtNum(d.mw) + ' MW · ' + esc(getProject(d.projectId).town || 'unassigned') + '</div>' +
            '<div class="person-title">' + esc(st.label || d.stage) + ' · ' + num(d.tenor) + ' yr at R' +
              num(d.tariff).toFixed(2) + '/kWh · ' + num(d.probability) + '% likely</div>' +
          '</div>' +
          '<div class="person-actions"><span style="font-weight:800;color:var(--accent);font-size:12.5px">' +
            fmtR(dealAnnualValue(d)) + '/yr</span></div>' +
        '</div>';
      }).join('')
        : '<div class="empty" style="padding:26px 10px"><h3>No opportunity yet</h3>' +
          '<p>Open one as soon as there is a number worth talking about — even a rough one.</p></div>') +
    '</div>';

  const logs = interactionsForProspect(p.id);
  const logHtml =
    '<div class="card">' +
      '<div class="card-header"><div class="card-title">Activity (' + logs.length + ')</div>' +
      '<button class="btn btn-ghost btn-xs" onclick="openLogInteraction(\'\',\'' + esc(p.id) + '\')">Log</button></div>' +
      (logs.length ? logs.map(i =>
        '<div class="int-row"><div class="int-dot"></div><div class="int-body">' +
        '<div class="int-meta">' + esc(i.type) + ' · ' + esc(i.date) + ' · ' + relTime(i.date) + '</div>' +
        '<div class="int-text">' + esc(i.summary) + '</div></div>' +
        '<button class="btn btn-xs btn-ghost" data-admin-only onclick="deleteInteraction(\'' + esc(i.id) + '\')">' +
          icon('trash', 11) + '</button></div>').join('')
        : '<div class="empty" style="padding:26px 10px"><h3>Nothing logged</h3>' +
          '<p>Log the first call. Half of these records are worked twice because nobody did.</p></div>') +
    '</div>';

  /* Same two columns as an offtaker reads in, for the same reason: rows of
     pairs left a hole whenever one of a pair had nothing in it, and a lead
     is mostly half-known. Read down the wide column, look things up in the
     narrow one. The sector's questions and objections are not repeated
     here — they are the sector page's, one click away. */
  /* No sales path here. A prospect is an unqualified lead — a name, a
     sector and no verified load — so there is no process to be at a
     stage of. The path belongs to an offtaker, and promoting this
     record is what starts it. */
  setContent(hero +
    '<div class="cols-2">' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + overview + oppsHtml + logHtml + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:14px">' + approach + placing + sectorCard + '</div>' +
    '</div>');
}
