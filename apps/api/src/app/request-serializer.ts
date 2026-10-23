/**
 * pino-http request serializer: the A17 PII boundary for request logs.
 *
 * The default serializer would log the full URL (query strings carry PII like
 * ?search=<email>) and every request header. This emits only id + method + the
 * path without its query string, so PII never reaches the logs at the source -
 * exported and unit-tested precisely because it is a security invariant, and an
 * inline closure in the module config could silently regress.
 */
export function serializeRequest(req: {
  id?: unknown;
  method?: string;
  url?: string;
}): { id: unknown; method?: string; url?: string } {
  return {
    id: req.id,
    method: req.method,
    url: typeof req.url === 'string' ? req.url.split('?')[0] : req.url,
  };
}
