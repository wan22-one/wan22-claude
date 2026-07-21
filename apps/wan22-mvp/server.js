const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '127.0.0.1';
const PORT = 4180;

const ROOT_DIR = __dirname;
const STATE_FILE = path.join(ROOT_DIR, 'data', 'state.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function serveStatic(req, res) {
  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(ROOT_DIR, path.normalize(requestPath).replace(/^(\.\.[/\\])+/, ''));

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function handleGetState(req, res) {
  fs.readFile(STATE_FILE, 'utf8', (err, data) => {
    if (err) {
      sendJson(res, 500, { error: 'Unable to read state file' });
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(data);
  });
}

function handlePostState(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
  });
  req.on('end', () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (err) {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }
    parsed.meta = parsed.meta || {};
    parsed.meta.updatedAt = new Date().toISOString();

    fs.writeFile(STATE_FILE, JSON.stringify(parsed, null, 2), (err) => {
      if (err) {
        sendJson(res, 500, { error: 'Unable to write state file' });
        return;
      }
      sendJson(res, 200, { ok: true });
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/state' && req.method === 'GET') {
    handleGetState(req, res);
    return;
  }
  if (req.url === '/api/state' && req.method === 'POST') {
    handlePostState(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`WAN22 OS MVP running at http://${HOST}:${PORT}/`);
});
