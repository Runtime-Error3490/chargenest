import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSiteUrl, siteUrlMiddleware, isAllowedOrigin } from '../src/config/index.js';

const inRequest = (env, req, fn) => {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  for (const k of Object.keys(env)) if (env[k] === undefined) delete process.env[k];
  let out;
  siteUrlMiddleware({ get: (h) => req[h.toLowerCase()], protocol: req.protocol }, null, () => { out = fn(); });
  process.env = saved;
  return out;
};

test('production: uses the address the browser called, no settings needed', () => {
  const url = inRequest(
    { NODE_ENV: 'production', FRONTEND_URL: undefined },
    { origin: 'https://chargenest.onrender.com', host: 'chargenest.onrender.com', protocol: 'https' },
    getSiteUrl,
  );
  assert.equal(url, 'https://chargenest.onrender.com');
});

test('production: a foreign Origin is ignored, the server address is used', () => {
  const url = inRequest(
    { NODE_ENV: 'production', FRONTEND_URL: undefined },
    { origin: 'https://evil.example', host: 'chargenest.onrender.com', protocol: 'https' },
    getSiteUrl,
  );
  assert.equal(url, 'https://chargenest.onrender.com');
});

test('development: the Vite dev server origin is used', () => {
  const url = inRequest(
    { NODE_ENV: 'development', FRONTEND_URL: undefined },
    { origin: 'http://localhost:5174', host: 'localhost:4000', protocol: 'http' },
    getSiteUrl,
  );
  assert.equal(url, 'http://localhost:5174');
});

test('FRONTEND_URL still overrides, trailing slash removed', () => {
  const url = inRequest(
    { FRONTEND_URL: 'https://my.domain/' },
    { origin: 'https://other', host: 'x', protocol: 'https' },
    getSiteUrl,
  );
  assert.equal(url, 'https://my.domain');
});

test('CORS: same host passes, foreign origin fails in production', () => {
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  assert.equal(isAllowedOrigin('https://a.com', 'a.com'), true);
  assert.equal(isAllowedOrigin('https://evil.com', 'a.com'), false);
  assert.equal(isAllowedOrigin(undefined, 'a.com'), true);
  process.env.NODE_ENV = saved;
});
