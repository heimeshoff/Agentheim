'use strict';

const http = require('node:http');

const WIDGETS = [
  { id: 1, color: 'red' },
  { id: 2, color: 'blue' },
];

/** Pure helper: shapes the /widgets response body. Correct and unit-tested. */
function buildWidgetsPayload() {
  return { widgets: WIDGETS };
}

/** Creates (but does not start) the widgets status HTTP server. */
function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }
    if (req.method === 'GET' && req.url === '/widgets') {
      // BUG: the route handler was wired against an older, singular
      // response shape and never updated to call buildWidgetsPayload() —
      // it returns { widget: <first widget> } instead of the documented
      // { widgets: <array> }. buildWidgetsPayload() itself is correct and
      // covered by a unit test, but that test never drives this route
      // over real HTTP, so the mismatch is invisible to the unit suite.
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ widget: WIDGETS[0] }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
}

module.exports = { createServer, buildWidgetsPayload };
