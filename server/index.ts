import { createServer } from 'node:http';
import { existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';
import { createApi } from './api';
// Load only server-side configuration; Vite never exposes these unprefixed values.
if(existsSync('.env'))process.loadEnvFile('.env');
setGlobalDispatcher(new EnvHttpProxyAgent());
const portIndex=process.argv.indexOf('--port');
const port=Number(portIndex>=0?process.argv[portIndex+1]:process.env.PORT??3000);
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid port');
const production=process.argv.includes('--production');
const api=createApi({key:process.env.WORLDGEN_DEEPSEEK_KEY??process.env.DEEPSEEK_API_KEY,model:process.env.WORLDGEN_DEEPSEEK_MODEL??process.env.DEEPSEEK_MODEL});
const vite=production?null:await(await import('vite')).createServer({server:{middlewareMode:true},appType:'spa'});
const dist=resolve('dist');
if(production&&!existsSync(resolve(dist,'index.html')))throw Error('Run npm run build first');
const server=createServer(async(req,res)=>{
 if(await api(req,res))return;
 if(vite){vite.middlewares(req,res);return;}
 if(!['GET','HEAD'].includes(req.method??'')){res.writeHead(405);res.end();return;}
 let pathname;try{pathname=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 let file=resolve(dist,'.'+pathname);if(file!==dist&&!file.startsWith(dist+sep)){res.writeHead(403);res.end();return;}
 if(!existsSync(file)||!statSync(file).isFile()){if(extname(pathname)){res.writeHead(404);res.end();return;}file=resolve(dist,'index.html');}
 const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
 res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream'});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);
});
server.listen(port,'0.0.0.0',()=>console.log(`WorldGen ${production?'production':'development'} server on port ${port}; DeepSeek ${process.env.WORLDGEN_DEEPSEEK_KEY||process.env.DEEPSEEK_API_KEY?'configured':'not configured'}`));
