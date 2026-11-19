import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.json':'application/json; charset=utf-8' };
const server = createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400).end('Bad request'); return; }
  let target = resolve(root, `.${pathname}`);
  if (target !== root && !target.startsWith(root + sep)) { response.writeHead(403).end('Forbidden'); return; }
  if (existsSync(target) && statSync(target).isDirectory()) target = resolve(target, 'index.html');
  if (!existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' });
    createReadStream(resolve(root,'404.html')).pipe(response);
    return;
  }
  response.writeHead(200, { 'Content-Type':types[extname(target).toLowerCase()] || 'application/octet-stream' });
  createReadStream(target).pipe(response);
});
const port = Number(process.env.PORT || 5500);
server.listen(port, '127.0.0.1', () => console.log(`AZL HAIL preview: http://127.0.0.1:${port}/`));
