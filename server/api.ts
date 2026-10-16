import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseWorld } from '../src/scene';
import { sceneSchema, instructions } from './schema';
export interface Options { key?:string; model?:string; fetcher?:typeof fetch }
class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
function send(res:ServerResponse,status:number,body:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
export function createApi(options:Options){
 let active=0;
 return async(req:IncomingMessage,res:ServerResponse):Promise<boolean>=>{
  const path=req.url?.split('?')[0];if(!path?.startsWith('/api/'))return false;
  try{
   if(path==='/api/status'&&req.method==='GET'){send(res,200,{configured:!!options.key,model:options.model??'gpt-4.1-mini'});return true;}
   if(path!=='/api/world'){throw new ApiError(404,'接口不存在。');}
   if(req.method!=='POST')throw new ApiError(405,'请使用 POST 请求。');
   if(req.headers.origin){let host;try{host=new URL(req.headers.origin).host;}catch{throw new ApiError(403,'无效来源。');}if(host!==req.headers.host)throw new ApiError(403,'不允许跨站请求。');}
   if(!req.headers['content-type']?.startsWith('application/json'))throw new ApiError(415,'需要 JSON 请求。');
   if(active>=2)throw new ApiError(429,'生成任务繁忙，请稍后再试。');
   let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>1_000_000)throw new ApiError(413,'场景请求过大。');}
   let body;try{body=JSON.parse(raw);}catch{throw new ApiError(400,'请求 JSON 无效。');}
   if(!body||typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>4000||!['generate','edit'].includes(body.mode))throw new ApiError(400,'请提供 1–4000 字的提示词和有效操作模式。');
   let world;if(body.mode==='edit'){try{world=parseWorld(JSON.stringify(body.world));}catch{throw new ApiError(400,'当前场景数据无效。');}}
   if(!options.key)throw new ApiError(503,'尚未配置 OpenAI 密钥。请在服务端设置 WORLDGEN_OPENAI_KEY 后重启，或切换本地规则模式。');
   active++;
   try{
    let upstream:Response;
    try{upstream=await(options.fetcher??fetch)('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${options.key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(60_000),body:JSON.stringify({model:options.model??'gpt-4.1-mini',max_completion_tokens:14000,messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify({mode:body.mode,prompt:body.prompt,world,selectedId:typeof body.selectedId==='string'?body.selectedId:null})}],response_format:{type:'json_schema',json_schema:{name:'world_scene',strict:true,schema:sceneSchema}}})});}catch(error){throw new ApiError(504,error instanceof Error&&/timeout|abort/i.test(error.name)?'OpenAI 请求超时，请稍后重试。':'无法连接 OpenAI，请检查服务端网络。');}
    if(!upstream.ok){throw new ApiError(upstream.status===429?429:502,upstream.status===401?'OpenAI 认证失败，请检查服务端密钥。':upstream.status===429?'OpenAI 配额不足或请求过于频繁。':upstream.status===403?'OpenAI 拒绝访问，请检查账户权限或网络策略。':'OpenAI 服务请求失败，请检查模型配置后重试。');}
    let result;try{const data=await upstream.json();const choice=data.choices?.[0];if(choice?.message?.refusal)throw new ApiError(422,'模型拒绝了此请求，请调整描述。');if(choice?.finish_reason!=='stop')throw new ApiError(422,'模型输出未完成，请简化场景后重试。');result=parseWorld(choice.message.content);}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(422,'模型输出未通过场景校验；原场景已保留，请重试。');}
    send(res,200,{world:result,model:options.model??'gpt-4.1-mini'});
   }finally{active--;}
  }catch(error){send(res,error instanceof ApiError?error.status:500,{error:error instanceof ApiError?error.message:'场景服务发生错误。'});}
  return true;
 };
}
