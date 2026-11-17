/** Plain-language startup messages, kept apart from index.ts so they can be tested. */

const ALL_INTERFACES = new Set(['0.0.0.0', '::']);

/** The URL to open for a server bound to `host`; "all interfaces" is opened as localhost. */
export function listenUrl(host: string, port: number): string {
  const name = ALL_INTERFACES.has(host) ? 'localhost' : host.includes(':') ? `[${host}]` : host;
  return `http://${name}:${port}`;
}

/** One sentence for a failure to bind, instead of a stack trace. */
export function listenErrorMessage(error: NodeJS.ErrnoException, host: string, port: number) {
  const settings = '~/.moneyinmotion/config.json';
  switch (error.code) {
    case 'EADDRINUSE':
      return `Port ${port} is in use; change it in ${settings} or stop the other program.`;
    case 'EACCES':
      return `This account may not listen on port ${port}; choose a port above 1024 in ${settings}.`;
    case 'EADDRNOTAVAIL':
    case 'ENOTFOUND':
      return `Host "${host}" is not an address of this machine; fix "host" in ${settings}.`;
    default:
      return `Could not listen on ${host}:${port}: ${error.message}`;
  }
}
