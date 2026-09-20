const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile, exec } = require('child_process');

const PORT = 8765;
const HOST = '127.0.0.1';               // local machine only
const CURL = process.platform === 'win32' ? 'curl.exe' : 'curl';
const MAX_BODY = 1024 * 1024;           // 1 MB for /api/exec
const MAX_DECRYPT_BODY = 60 * 1024 * 1024; // 60 MB for /api/decrypt (large ciphertext)
const MAX_OUTPUT = 50 * 1024 * 1024;    // 50 MB curl output limit
const ALLOWED_HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function openBrowser() {
  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === 'win32'
    ? `cmd.exe /c start "" ${url}`
    : process.platform === 'darwin'
      ? `open ${url}`
      : `xdg-open ${url}`;
  exec(cmd, { windowsHide: true }, () => {});
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// Blocks other websites (CSRF) and DNS-rebinding attacks from using this server.
function isTrustedRequest(req) {
  if (!ALLOWED_HOSTS.includes(req.headers.host)) return false;
  const origin = req.headers.origin;
  if (origin && !ALLOWED_HOSTS.some(h => origin === `http://${h}`)) return false;
  return true;
}

function readJsonBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------------ */
/* AES decryption (uses the key/passphrase YOU provide)               */
/* ------------------------------------------------------------------ */

const HEX_RE = /^[0-9a-fA-F]+$/;
const B64_RE = /^[A-Za-z0-9+/_-]+={0,2}$/;

function looksLikePlaylist(buf) {
  const text = buf.toString('utf8');
  return text.includes('#EXTM3U') || text.includes('#EXTINF');
}

// Quick check on the first bytes so wrong keys are rejected without decrypting everything.
function headLooksTextual(buf) {
  const n = Math.min(buf.length, 64);
  if (n === 0) return false;
  let ok = 0;
  for (let i = 0; i < n; i++) {
    const b = buf[i];
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126) || b >= 128) ok++;
  }
  return ok / n >= 0.9;
}

function decodeCiphertext(raw) {
  const s = String(raw || '').replace(/\s+/g, '');
  const out = [];
  if (s.length >= 32 && s.length % 2 === 0 && HEX_RE.test(s)) out.push({ label: 'hex', buf: Buffer.from(s, 'hex') });
  if (B64_RE.test(s)) {
    const std = s.replace(/-/g, '+').replace(/_/g, '/');
    out.push({ label: 'base64', buf: Buffer.from(std, 'base64') });
  }
  return out;
}

function parseBytes(str, fmt) {
  const s = String(str || '');
  if (!s) return [];
  const t = s.trim();
  const list = [];
  const add = (label, buf) => { if (buf && buf.length) list.push({ label, buf }); };

  if (fmt === 'hex') {
    if (HEX_RE.test(t) && t.length % 2 === 0) add('hex', Buffer.from(t, 'hex'));
  } else if (fmt === 'base64') {
    if (B64_RE.test(t)) add('base64', Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  } else if (fmt === 'text') {
    add('text', Buffer.from(s, 'utf8'));
  } else { // auto
    add('text', Buffer.from(s, 'utf8'));
    if (HEX_RE.test(t) && t.length % 2 === 0) add('hex', Buffer.from(t, 'hex'));
    if (B64_RE.test(t) && t.length % 4 === 0) {
      const b = Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
      if ([16, 24, 32].includes(b.length)) add('base64', b);
    }
  }
  return list;
}

function fitKeySize(buf) {
  if ([16, 24, 32].includes(buf.length)) return buf;
  const target = buf.length < 16 ? 16 : buf.length < 24 ? 24 : 32;
  const out = Buffer.alloc(target);
  buf.copy(out, 0, 0, Math.min(buf.length, target));
  return out;
}

function buildKeyCandidates(keyStr, fmt) {
  const seen = new Set();
  const out = [];
  const add = (label, buf) => {
    const id = buf.toString('hex');
    if (!seen.has(id)) { seen.add(id); out.push({ label, buf }); }
  };
  parseBytes(keyStr, fmt).forEach(({ label, buf }) => {
    const exact = [16, 24, 32].includes(buf.length);
    add(exact ? `${label}` : `${label}, zero-padded`, fitKeySize(buf));
  });
  if (fmt === 'auto' || fmt === 'text') {
    const raw = Buffer.from(String(keyStr), 'utf8');
    add('MD5 of passphrase', crypto.createHash('md5').update(raw).digest());
    add('SHA-256 of passphrase', crypto.createHash('sha256').update(raw).digest());
  }
  return out;
}

// OpenSSL / CryptoJS "Salted__" format: key and IV derived from a passphrase.
function evpBytesToKey(pass, salt, keyLen, ivLen, digest) {
  let prev = Buffer.alloc(0);
  const chunks = [];
  let total = 0;
  while (total < keyLen + ivLen) {
    prev = crypto.createHash(digest).update(Buffer.concat([prev, pass, salt])).digest();
    chunks.push(prev);
    total += prev.length;
  }
  const all = Buffer.concat(chunks);
  return { key: all.subarray(0, keyLen), iv: all.subarray(keyLen, keyLen + ivLen) };
}

function tryOpenSsl(data, passphrase) {
  if (data.length < 32 || data.subarray(0, 8).toString('latin1') !== 'Salted__') return null;
  const salt = data.subarray(8, 16);
  const body = data.subarray(16);
  const pass = Buffer.from(passphrase, 'utf8');
  for (const digest of ['md5', 'sha256']) {
    for (const bits of [256, 128]) {
      try {
        const { key, iv } = evpBytesToKey(pass, salt, bits / 8, 16, digest);
        const d = crypto.createDecipheriv(`aes-${bits}-cbc`, key, iv);
        const out = Buffer.concat([d.update(body), d.final()]);
        if (looksLikePlaylist(out)) return { out, method: `OpenSSL/CryptoJS salted AES-${bits}-CBC (${digest.toUpperCase()})` };
      } catch (_) { /* try next */ }
    }
  }
  return null;
}

function tryStandard(data, keyCands, ivInput, ivFmt, mode) {
  const modes = mode === 'auto' ? ['cbc', 'ecb', 'ctr', 'gcm'] : [mode];
  const userIvs = parseBytes(ivInput, ivFmt);

  for (const k of keyCands) {
    const bits = k.buf.length * 8;
    for (const m of modes) {
      const algo = `aes-${bits}-${m}`;

      if (m === 'ecb') {
        const r = attempt(algo, k.buf, null, data);
        if (r) return { out: r, method: `AES-${bits}-ECB (key: ${k.label})` };
        continue;
      }

      if (m === 'gcm') {
        const ivs = [];
        userIvs.filter(v => v.buf.length === 12).forEach(v => ivs.push({ iv: v.buf, body: data, label: 'IV provided' }));
        if (data.length > 28) ivs.push({ iv: data.subarray(0, 12), body: data.subarray(12), label: 'IV prefixed' });
        for (const c of ivs) {
          if (c.body.length <= 16) continue;
          try {
            const d = crypto.createDecipheriv(algo, k.buf, c.iv);
            d.setAuthTag(c.body.subarray(c.body.length - 16));
            const out = Buffer.concat([d.update(c.body.subarray(0, c.body.length - 16)), d.final()]);
            if (looksLikePlaylist(out)) return { out, method: `AES-${bits}-GCM (${c.label}, key: ${k.label})` };
          } catch (_) { /* try next */ }
        }
        continue;
      }

      // CBC / CTR need a 16-byte IV
      const ivs = [];
      userIvs.filter(v => v.buf.length === 16).forEach(v => ivs.push({ iv: v.buf, body: data, label: `IV provided (${v.label})` }));
      if (data.length > 16) ivs.push({ iv: data.subarray(0, 16), body: data.subarray(16), label: 'IV prefixed' });
      ivs.push({ iv: Buffer.alloc(16), body: data, label: 'zero IV' });
      ivs.push({ iv: k.buf.subarray(0, 16), body: data, label: 'IV = key' });
      for (const c of ivs) {
        const r = attempt(algo, k.buf, c.iv, c.body);
        if (r) return { out: r, method: `AES-${bits}-${m.toUpperCase()} (${c.label}, key: ${k.label})` };
      }
    }
  }
  return null;
}

function attempt(algo, key, iv, body) {
  try {
    // Cheap pre-check: decrypt only the first blocks and see if they look like text.
    const isEcb = algo.endsWith('-ecb');
    const head = body.subarray(0, Math.min(body.length - (body.length % 16), 64));
    if (head.length >= 16) {
      const pd = crypto.createDecipheriv(algo, key, isEcb ? null : iv);
      pd.setAutoPadding(false);
      const first = pd.update(head);
      if (!headLooksTextual(first)) return null;
    }
    const d = crypto.createDecipheriv(algo, key, isEcb ? null : iv);
    const out = Buffer.concat([d.update(body), d.final()]);
    return looksLikePlaylist(out) ? out : null;
  } catch (_) {
    return null;
  }
}

function decryptPlaylist({ data, key, keyFormat, iv, mode }) {
  const fmt = ['auto', 'text', 'hex', 'base64'].includes(keyFormat) ? keyFormat : 'auto';
  const m = ['auto', 'cbc', 'ecb', 'ctr', 'gcm', 'openssl'].includes(mode) ? mode : 'auto';
  const keyStr = String(key || '');
  if (!keyStr) return { ok: false, error: 'Enter a key or passphrase first.' };

  const cipherOptions = decodeCiphertext(data);
  if (!cipherOptions.length) return { ok: false, error: 'The payload does not look like Base64 or hex ciphertext.' };

  for (const c of cipherOptions) {
    if (m === 'auto' || m === 'openssl') {
      const r = tryOpenSsl(c.buf, keyStr);
      if (r) return { ok: true, text: r.out.toString('utf8').replace(/^\uFEFF/, ''), method: r.method };
      if (m === 'openssl') continue;
    }
    if (m === 'openssl') continue;
    const keyCands = buildKeyCandidates(keyStr, fmt);
    const r = tryStandard(c.buf, keyCands, iv, fmt, m);
    if (r) return { ok: true, text: r.out.toString('utf8').replace(/^\uFEFF/, ''), method: `${r.method}, input: ${c.label}` };
  }
  return {
    ok: false,
    error: 'Could not decrypt. Check the key/passphrase, or try picking the exact mode and IV instead of Auto.'
  };
}

/* ------------------------------------------------------------------ */
/* Startup: reuse a running instance if there is one                  */
/* ------------------------------------------------------------------ */

const checkReq = http.get({ host: HOST, port: PORT, path: '/', timeout: 600 }, (res) => {
  res.resume();
  openBrowser();
  setTimeout(() => process.exit(0), 300);
});
checkReq.on('error', startServer);
checkReq.on('timeout', () => {
  checkReq.destroy();
  startServer();
});

/* ------------------------------------------------------------------ */
/* Server                                                             */
/* ------------------------------------------------------------------ */

function startServer() {
  const server = http.createServer(async (req, res) => {
    if (!isTrustedRequest(req)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
        if (err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('index.html not found');
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/exec') {
      let parsed;
      try {
        parsed = await readJsonBody(req, MAX_BODY);
      } catch (e) {
        return sendJson(res, 400, { error: e.message });
      }

      const targetUrl = String(parsed.url || '').trim();
      const ua = String(parsed.ua || '').trim();
      const headers = Array.isArray(parsed.headers) ? parsed.headers : [];
      const followRedirect = parsed.followRedirect === true;
      const timeout = Math.min(90, Math.max(5, parseInt(parsed.timeout, 10) || 90));

      if (!targetUrl) return sendJson(res, 400, { error: 'Missing target URL' });

      // Only http(s) URLs (blocks file://, ftp://, and values that look like curl options)
      let parsedUrl;
      try {
        parsedUrl = new URL(targetUrl);
      } catch {
        return sendJson(res, 400, { error: 'Invalid URL' });
      }
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return sendJson(res, 400, { error: 'Only http:// and https:// URLs are allowed' });
      }

      const args = [
        '-v', '-sS',
        '--connect-timeout', String(Math.min(15, timeout)),
        '--max-time', String(timeout),
        '--proto', '=http,https',
        '--proto-redir', '=http,https'
      ];
      if (followRedirect) args.push('-L');
      if (ua) args.push('-A', ua);
      headers.forEach(h => {
        const trimmed = String(h || '').trim();
        if (trimmed) args.push('-H', trimmed);
      });
      args.push('--', parsedUrl.href);

      execFile(CURL, args, { maxBuffer: MAX_OUTPUT, timeout: (timeout + 10) * 1000 }, (err, stdout, stderr) => {
        let log = stderr || '';
        if (err && err.code === 'ENOENT') {
          log = `curl was not found (looked for "${CURL}"). Install curl and make sure it is in your PATH.`;
        } else if (!log && err) {
          log = err.message;
        }
        sendJson(res, 200, {
          payload: stdout || '',
          processLog: log || 'No process logs recorded.',
          hasError: !!err && !stdout
        });
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/api/decrypt') {
      try {
        const body = await readJsonBody(req, MAX_DECRYPT_BODY);
        return sendJson(res, 200, decryptPlaylist(body));
      } catch (e) {
        return sendJson(res, 400, { ok: false, error: e.message });
      }
    }

    res.writeHead(404);
    res.end();
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      openBrowser();
      process.exit(0);
    }
    console.error(err);
    process.exit(1);
  });

  server.listen(PORT, HOST, openBrowser);
}