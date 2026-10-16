import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseWorld, type World } from '../src/scene';
import { sceneSchema, instructions } from './schema';
import { localSchema, readLocalWorld, LocalOutputError } from './local-scene';
export interface Options { key?:string; model?:string; fetcher?:typeof fetch; ollamaUrl?:string; localModel?:string; localFetcher?:typeof fetch }
class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
function send(res:ServerResponse,status:number,body:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
export function createApi(options:Options){
 let active=0;
 return async(req:IncomingMessage,res:ServerResponse):Promise<boolean>=>{
  const path=req.url?.split('?')[0];if(!path?.startsWith('/api/'))return false;
  try{
   if(path==='/api/status'&&req.method==='GET'){send(res,200,{configured:!!options.key,model:options.model??'deepseek-flash',localModel:options.localModel??'qwen2.5-coder:7b',localConfigured:!!options.ollamaUrl});return true;}
   if(path!=='/api/world'){throw new ApiError(404,'接口不存在。');}
   if(req.method!=='POST')throw new ApiError(405,'请使用 POST 请求。');
   if(req.headers.origin){let host;try{host=new URL(req.headers.origin).host;}catch{throw new ApiError(403,'无效来源。');}if(host!==req.headers.host)throw new ApiError(403,'不允许跨站请求。');}
   if(!req.headers['content-type']?.startsWith('application/json'))throw new ApiError(415,'需要 JSON 请求。');
   if(active>=2)throw new ApiError(429,'生成任务繁忙，请稍后再试。');
   let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>1_000_000)throw new ApiError(413,'场景请求过大。');}
   let body;try{body=JSON.parse(raw);}catch{throw new ApiError(400,'请求 JSON 无效。');}
   if(!body||typeof body.prompt!=='string'||!body.prompt.trim()||body.prompt.length>4000||!['generate','edit'].includes(body.mode))throw new ApiError(400,'请提供 1–4000 字的提示词和有效操作模式。');
   let world:World|undefined;if(body.mode==='edit'){try{world=parseWorld(JSON.stringify(body.world));}catch{throw new ApiError(400,'当前场景数据无效。');}}
   const localRequested=body.provider==='ollama';
   if(body.provider!==undefined&&!['ollama','auto'].includes(body.provider))throw new ApiError(400,'无效的模型服务。');
   if(!options.key&&!options.ollamaUrl)throw new ApiError(503,'尚未配置 DeepSeek 密钥。请在服务端设置 WORLDGEN_DEEPSEEK_KEY 后重启，或切换本地规则模式。');
   active++;
   try{
    const messages=[{role:'system',content:instructions+'\nJSON schema for the required scene:\n'+JSON.stringify(sceneSchema)},{role:'user',content:JSON.stringify({mode:body.mode,prompt:body.prompt,world,selectedId:typeof body.selectedId==='string'?body.selectedId:null})}];
    const runLocal=async(fallback:boolean)=>{
     if(!options.ollamaUrl)throw new ApiError(503,'本地 Ollama 未配置，请设置 WORLDGEN_OLLAMA_URL。');
     const outdoor=body.mode==='edit'?world?.environment==='outdoor':/景区|湖|公园|室外|户外|park|lake|outdoor/i.test(body.prompt);
     const schema=localSchema(outdoor,body.mode==='edit');
     const localMessages=[{role:'system',content:instructions+'\nOUTPUT CONSTRAINTS: environment must be '+(outdoor?'outdoor':'indoor')+'. All dimensions, positions and sizes are NUMBER ARRAYS, never objects. Use #RRGGBB colors. Return one complete JSON object, no markdown. '+(body.mode==='generate'?'Generate no more than 24 objects; avoid repetitive decorative trees to fit the output budget.':'Preserve all existing objects unrelated to the edit. Do not drop objects to shorten output.')+'\nJSON Schema:\n'+JSON.stringify(schema)},messages[1]];
     const signal=AbortSignal.timeout(180000);let result;let reason='未知格式错误';
     for(let attempt=0;attempt<2;attempt++){
      let response:Response;
      try{response=await(options.localFetcher??options.fetcher??fetch)(options.ollamaUrl.replace(/\/$/,'')+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal,body:JSON.stringify({model:options.localModel??'qwen2.5-coder:7b',messages:attempt===0?localMessages:[...localMessages,{role:'user',content:'上一次输出未能通过检查：'+reason+'。请重新完成原任务并修正此问题。必须返回完整场景 JSON，不要解释。'+(body.mode==='generate'?'减少装饰物，保持最多 24 个物体。':'保留所有与编辑无关的原物体。')}],stream:false,format:schema,options:{temperature:0,num_predict:8192,num_ctx:16384}})});}catch{throw new ApiError(503,fallback?'DeepSeek 余额不足，且本地 Ollama 连接失败或推理超时；原场景已保留。':'Ollama 连接失败或本地推理超时，请检查服务；原场景已保留。');}
      if(!response.ok)throw new ApiError(502,response.status===404?'Ollama 模型未安装，请运行 ollama pull qwen2.5-coder:7b。':'Ollama 推理失败，请检查服务状态。');
      try{result=readLocalWorld(await response.json());break;}catch(error){reason=error instanceof LocalOutputError?error.message:'Ollama 响应不是合法 JSON';}
     }
     if(!result)throw new ApiError(422,'本地模型自动修复后仍未通过检查：'+reason+'。原场景已保留；请减少物体数量后重试。');
     send(res,200,{world:result,provider:'ollama',model:options.localModel??'qwen2.5-coder:7b',fallback});
    };
    if(localRequested||!options.key){await runLocal(false);return true;}
    let upstream:Response;
    try{upstream=await(options.fetcher??fetch)('https://api.deepseek.com/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${options.key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(60_000),body:JSON.stringify({model:options.model??'deepseek-flash',max_tokens:8192,thinking:{type:'disabled'},messages:[{role:'system',content:instructions+'\nJSON schema for the required scene:\n'+JSON.stringify(sceneSchema)},{role:'user',content:JSON.stringify({mode:body.mode,prompt:body.prompt,world,selectedId:typeof body.selectedId==='string'?body.selectedId:null})}],response_format:{type:'json_object'}})});}catch(error){throw new ApiError(504,error instanceof Error&&/timeout|abort/i.test(error.name)?'DeepSeek 请求超时，请稍后重试。':'无法连接 DeepSeek，请检查服务端网络。');}
    if(upstream.status===402&&options.ollamaUrl){await runLocal(true);return true;}
    if(!upstream.ok){throw new ApiError(upstream.status===429?429:502,upstream.status===401?'DeepSeek 认证失败，请检查服务端密钥。':upstream.status===402?'DeepSeek 账户余额不足，请充值后重试。':upstream.status===429?'DeepSeek 请求过于频繁，请稍后重试。':upstream.status===403?'DeepSeek 拒绝访问，请检查账户权限或网络策略。':'DeepSeek 服务请求失败，请检查模型配置后重试。');}
    let result;try{const data=await upstream.json();const choice=data.choices?.[0];if(choice?.message?.refusal)throw new ApiError(422,'模型拒绝了此请求，请调整描述。');if(choice?.finish_reason!=='stop')throw new ApiError(422,'模型输出未完成，请简化场景后重试。');result=parseWorld(choice.message.content);}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(422,'模型输出未通过场景校验；原场景已保留，请重试。');}
    send(res,200,{world:result,model:options.model??'deepseek-flash',provider:'deepseek',fallback:false});
   }finally{active--;}
  }catch(error){send(res,error instanceof ApiError?error.status:500,{error:error instanceof ApiError?error.message:'场景服务发生错误。'});}
  return true;
 };
}
