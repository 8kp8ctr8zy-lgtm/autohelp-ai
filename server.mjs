import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import diagnose from './netlify/functions/diagnose.mjs';
import { handler as checkout } from './netlify/functions/checkout.js';

const root = process.cwd();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon'};
const maxBody = 1_600_000;
const port = Number(process.env.PORT || 8080);

function send(res, status, data, type='application/json; charset=utf-8') {
  res.writeHead(status, {'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(data);
}
async function body(req) {
  const chunks=[]; let total=0;
  for await (const chunk of req) {
    total+=chunk.length;
    if(total>maxBody){const error=new Error('Request too large');error.status=413;throw error;}
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
http.createServer(async (req,res)=>{
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if(pathname==='/health') return send(res,200,JSON.stringify({ok:true,service:'autohelp-ai'}));
    if(pathname==='/\.netlify/functions/diagnose' || pathname==='/\.netlify/functions/checkout') {
      if(req.method!=='POST') return send(res,405,JSON.stringify({error:'Method not allowed'}));
      const raw=await body(req);
      if(pathname.endsWith('/diagnose')){
        const request=new Request('http://localhost'+pathname,{method:'POST',headers:req.headers,body:raw});
        const response=await diagnose(request);
        res.writeHead(response.status, Object.fromEntries(response.headers));
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      const result=await checkout({httpMethod:'POST',headers:req.headers,body:raw.toString('utf8')});
      return send(res,result.statusCode||500,result.body||'{}',result.headers?.['Content-Type']||'application/json; charset=utf-8');
    }
    if(req.method!=='GET'&&req.method!=='HEAD') return send(res,405,JSON.stringify({error:'Method not allowed'}));
    const name=pathname==='/'?'/index.html':decodeURIComponent(pathname);
    const target=resolve(root,'.'+name);
    if(target!==root&&!target.startsWith(root+sep)) return send(res,403,'Forbidden','text/plain');
    if(name.includes('..')||name.split('/').some(part=>part.startsWith('.')&&part.length>1)||name.startsWith('/.git')||name.startsWith('/netlify/')||name.startsWith('/node_modules/')||name==='/package.json'||name==='/package-lock.json'||name==='/server.mjs'||name==='/netlify.toml') return send(res,404,'Not found','text/plain');
    const info=await stat(target).catch(()=>null);
    if(!info?.isFile()) return send(res,404,'Not found','text/plain');
    const file=await readFile(target);
    res.writeHead(200,{'Content-Type':mime[extname(target)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300'});
    res.end(req.method==='HEAD'?undefined:file);
  } catch(error) {
    send(res,error.status||500,JSON.stringify({error:error.status===413?'Request too large':'Internal server error'}));
  }
}).listen(port,'0.0.0.0',()=>console.log('AutoHelp AI listening on '+port));
