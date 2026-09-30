/** Browser-origin protection is defense in depth, not authentication. */
import type { RequestHandler } from 'express';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const apiBoundary: RequestHandler = (req, res, next) => {
  // Financial records and filesystem configuration must not enter browser or
  // intermediary caches, including on failed requests.
  res.setHeader('Cache-Control', 'no-store');
  if (READ_METHODS.has(req.method)) {
    next();
    return;
  }

  // Multipart forms can send cross-origin requests without a CORS preflight.
  // Block them before body parsing/staging. Non-browser tools without Origin
  // or Fetch Metadata remain supported behind the deployment access boundary.
  const site = req.get('Sec-Fetch-Site');
  const origin = req.get('Origin');
  let blocked = site === 'cross-site' || site === 'same-site';
  if (origin) {
    try {
      const source = new URL(origin);
      // Preserve the public Host through reverse proxies. Compare host/port,
      // not req.protocol: TLS can terminate at the authenticating proxy.
      const target = new URL(`${source.protocol}//${req.get('Host') ?? ''}`);
      blocked ||= !['http:', 'https:'].includes(source.protocol) || source.host !== target.host;
    } catch {
      blocked = true;
    }
  }
  if (blocked) {
    res.status(403).json({
      error: 'Changes must be submitted from this website. Reload it and try again.',
      status: 403,
    });
    return;
  }
  next();
};
