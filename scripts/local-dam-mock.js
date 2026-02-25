const http = require('http');

const PORT = process.env.LOCAL_DAM_PORT || 8000;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function writeJson(res, statusCode, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  });
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      writeJson(res, 200, { status: 'ok', service: 'local-dam-mock' });
      return;
    }

    if (req.method === 'POST' && req.url === '/initiate') {
      const body = await readJson(req);
      const sessionId = body.sessionId || body.session_id || `local-${Date.now()}`;
      writeJson(res, 200, {
        session_id: sessionId
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/predict') {
      const body = await readJson(req);
      const sessionId = body.sessionId || body.session_id || `local-${Date.now()}`;
      writeJson(res, 200, {
        session_id: sessionId,
        status: 'submitted'
      });
      return;
    }

    writeJson(res, 404, { error: 'not_found', path: req.url });
  } catch (err) {
    writeJson(res, 500, { error: 'server_error', message: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`[local-dam-mock] listening on http://localhost:${PORT}`);
});
