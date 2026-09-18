#!/usr/bin/env node
/* A stand-in for Supabase that refuses every sign-in.
 *
 * It has to be its own process. The tests drive the agent with
 * spawnSync, which blocks the calling process's event loop until the
 * child exits — a server living in that same process could never answer
 * the request, and the two would wait on each other until something
 * timed out.
 *
 * Prints {"port":N} on its first line and then serves. The parent reads
 * that line rather than guessing a port, so two runs at once cannot
 * collide.
 */
'use strict';

const server = require('http').createServer((req, res) => {
  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'stub refuses everything' }));
});

server.listen(0, '127.0.0.1', () => {
  process.stdout.write(JSON.stringify({ port: server.address().port }) + '\n');
});
