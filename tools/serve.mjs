import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
const root = path.resolve(import.meta.dirname, '../_site');
if (!fs.existsSync(root)) throw new Error('Run npm run build before npm start.');
const port = Number(process.env.PORT || 4173);
const compressed = new Map();
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.mp3':'audio/mpeg','.xml':'application/xml','.txt':'text/plain','.woff2':'font/woff2'};
http.createServer((request,response) => {
    let pathname;
    try {pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);} catch {response.writeHead(400);response.end();return;}
    let file = path.resolve(root,'.'+pathname);
    if (file !== root && !file.startsWith(root+path.sep)) {response.writeHead(403);response.end();return;}
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        if (!pathname.endsWith('/')) {response.writeHead(301,{Location:pathname+'/'+new URL(request.url,'http://localhost').search});response.end();return;}
        file = path.join(file,'index.html');
    }
    const exists = fs.existsSync(file) && fs.statSync(file).isFile();
    if (!exists) file = path.join(root,'404.html');
    // These are preview headers; production headers must be set at the HTTP host.
    const headers = {'Content-Type':types[path.extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Cache-Control':'no-cache','Vary':'Accept-Encoding'};
    let body;
    if (/\bgzip\b/.test(request.headers['accept-encoding'] || '') && /\.(html|css|js|json|svg|xml|txt)$/.test(file)) {
        const modified = fs.statSync(file).mtimeMs;
        const cached = compressed.get(file);
        body = cached && cached.modified === modified ? cached.body : gzipSync(fs.readFileSync(file));
        compressed.set(file,{modified,body});
        headers['Content-Encoding'] = 'gzip';
    }
    response.writeHead(exists ? 200 : 404,headers);
    if (request.method === 'HEAD') response.end(); else if (body) response.end(body); else fs.createReadStream(file).pipe(response);
}).listen(port,'127.0.0.1',() => console.log('Nameless preview: http://127.0.0.1:'+port));
