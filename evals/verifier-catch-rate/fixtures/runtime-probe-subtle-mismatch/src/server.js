'use strict';

const http = require('node:http');

const WIDGETS = [
  { id: 1, colour: 'red' },
  { id: 2, colour: 'blue' },
];

/** Pure helper: shapes the /widgets response body. */
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
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(buildWidgetsPayload()));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });
}

module.exports = { createServer, buildWidgetsPayload };
