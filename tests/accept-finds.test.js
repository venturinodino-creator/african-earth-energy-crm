/* Tests for the terminal Accept (scripts/accept-finds.js): both reads page
 * past PostgREST's 1000-row cap, so the same-person check sees every contact
 * on file and accepting a find never creates a second copy of someone.
 *
 *   node tests/accept-finds.test.js
 *
 * fetch is stubbed with a fake PostgREST that honours limit/offset and caps
 * each response at 1000 rows, as the live API does. No framework and no
 * dependencies, matching the rest of the repo.
 */
'use strict';

const assert = require('assert');
const { restAll, loadQueue, onFileIn } = require('../scripts/accept-finds.js');

const CAP = 1000;
let requests = [];
function fakePostgrest(tables) {
  global.fetch = async (url) => {
    requests.push(url);
    const u = new URL(url);
    const rows = tables[u.pathname.split('/').pop()] || [];
    const offset = Number(u.searchParams.get('offset') || 0);
    const limit = Math.min(Number(u.searchParams.get('limit') || CAP), CAP);
    const body = JSON.stringify(rows.slice(offset, offset + limit));
    return { ok: true, status: 200, text: async () => body };
  };
}
const pad = i => String(i).padStart(5, '0');
const contact = i => ({ id: 'c_' + pad(i), offtaker_id: 'off_' + (i % 50), first: 'First' + i, last: 'Last' + i, title: '', email: '', phone: '', notes: '' });

let n = 0;
const test = async (name, fn) => { requests = []; await fn(); n++; console.log('ok - ' + name); };

(async () => {
  await test('restAll reads every row of a table past the 1000-row cap', async () => {
    fakePostgrest({ aee_contacts: Array.from({ length: 1594 }, (_, i) => contact(i)) });
    const rows = await restAll('aee_contacts?select=*&order=id.asc');
    assert.strictEqual(rows.length, 1594);
    assert.strictEqual(requests.length, 2);
    assert.ok(requests[0].includes('&limit=1000&offset=0'));
    assert.ok(requests[1].includes('&limit=1000&offset=1000'));
  });

  await test('a table of exactly 1000 rows takes one more request, which comes back empty', async () => {
    fakePostgrest({ aee_contacts: Array.from({ length: 1000 }, (_, i) => contact(i)) });
    const rows = await restAll('aee_contacts?select=*&order=id.asc');
    assert.strictEqual(rows.length, 1000);
    assert.strictEqual(requests.length, 2);
  });

  await test('loadQueue pages both reads in a stable id order', async () => {
    const finds = Array.from({ length: 1784 }, (_, i) => ({ id: 'f_' + pad(i), status: 'pending' }));
    fakePostgrest({ aee_contacts: Array.from({ length: 1594 }, (_, i) => contact(i)), aee_found_contacts: finds });
    const q = await loadQueue(null);
    assert.strictEqual(q.finds.length, 1784);
    assert.strictEqual(q.contacts.length, 1594);
    assert.ok(requests.every(r => r.includes('order=id.asc')), 'every page is ordered by id');
  });

  await test('loadQueue keeps the run filter on every page', async () => {
    fakePostgrest({ aee_contacts: [], aee_found_contacts: [] });
    await loadQueue(['run_a', 'run_b']);
    const findReqs = requests.filter(r => r.includes('aee_found_contacts'));
    assert.ok(findReqs.length >= 1);
    assert.ok(findReqs.every(r => r.includes('run_id=in.(run_a,run_b)') && r.includes('status=eq.pending')));
  });

  await test('a find for a contact stored past row 1000 is matched, not created again', async () => {
    const contacts = Array.from({ length: 1594 }, (_, i) => contact(i));
    fakePostgrest({ aee_contacts: contacts, aee_found_contacts: [{ id: 'f_1', status: 'pending', offtaker_id: contacts[1500].offtaker_id, first: 'First1500', last: 'Last1500', email: 'x@y.co.za' }] });
    const q = await loadQueue(null);
    const hit = onFileIn(q.contacts, q.finds[0]);
    assert.ok(hit, 'the contact on row 1501 is found');
    assert.strictEqual(hit.id, contacts[1500].id);
  });

  console.log(n + ' tests passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
