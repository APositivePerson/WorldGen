import { parseWorld, specs, type World } from '../src/scene';
import { sceneSchema } from './schema';

// Keep import compatibility separate: local generations must explicitly state the environment.
export function localSchema(outdoor:boolean, editing:boolean) {
 const maximum=outdoor?500:40;
 const numeric={type:'number',minimum:-1000,maximum:1000};
 const vector=<T extends object>(n:number,items:T)=>({type:'array',minItems:n,maxItems:n,items});
 return {...sceneSchema,required:[...sceneSchema.required,'environment'],properties:{...sceneSchema.properties,
  environment:{type:'string',enum:[outdoor?'outdoor':'indoor']},
  dimensions:vector(2,{type:'number',minimum:4,maximum}),
  objects:{...sceneSchema.properties.objects,maxItems:editing?200:24,items:{...sceneSchema.properties.objects.items,properties:{...sceneSchema.properties.objects.items.properties,
   position:vector(3,numeric),size:vector(3,{type:'number',exclusiveMinimum:0,maximum}),
   color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},rotation:numeric,
   id:{type:'string',minLength:1},name:{type:'string',minLength:1}
  }}}
 }};
}
export class LocalOutputError extends Error {}
export function readLocalWorld(data:unknown):World {
 if(!data||typeof data!=='object')throw new LocalOutputError('Ollama 响应不是 JSON 对象');
 const response=data as {done?:boolean;done_reason?:string;message?:{content?:unknown}};
 if(response.done_reason==='length')throw new LocalOutputError('输出达到 token 上限，被截断');
 if(response.done!==true)throw new LocalOutputError('Ollama 未报告生成完成');
 const content=response.message?.content;
 if(typeof content!=='string'||!content.trim())throw new LocalOutputError('模型返回空内容');
 // Some Ollama/model combinations wrap an otherwise valid JSON object in a code fence.
 const text=content.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i,'$1');
 let w;try{w=JSON.parse(text);}catch{throw new LocalOutputError('输出不是完整合法的 JSON');}
 if(!w||typeof w!=='object'||Array.isArray(w))throw new LocalOutputError('场景必须是 JSON 对象');
 if(!['indoor','outdoor'].includes(w.environment))throw new LocalOutputError('environment 必须是 indoor 或 outdoor');
 const max=w.environment==='outdoor'?500:40;
 const vector=(v:unknown,n:number,min:number,max:number)=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max);
 if(w.version!==1||w.units!=='meters'||w.upAxis!=='Z')throw new LocalOutputError('场景必须使用 version=1、units=meters、upAxis=Z');
 if(!vector(w.dimensions,2,4,max))throw new LocalOutputError(`dimensions 必须是两个 4–${max} 米的数字`);
 if(!Array.isArray(w.objects)||w.objects.length>200)throw new LocalOutputError('objects 必须是数组且最多 200 项');
 const ids=new Set();
 for(let i=0;i<w.objects.length;i++){
  const o=w.objects[i];const path=`objects[${i}]`;
  if(!o||typeof o!=='object')throw new LocalOutputError(`${path} 必须是对象`);
  if(typeof o.id!=='string'||!o.id.trim()||ids.has(o.id))throw new LocalOutputError(`${path}.id 缺失或重复`);
  ids.add(o.id);
  if(!Object.hasOwn(specs,o.kind))throw new LocalOutputError(`${path}.kind 不在支持的资产类型中`);
  if(!vector(o.position,3,-1000,1000))throw new LocalOutputError(`${path}.position 必须是三个有限数字`);
  if(!vector(o.size,3,Number.MIN_VALUE,max))throw new LocalOutputError(`${path}.size 必须是三个大于 0 且不超过 ${max} 的数字`);
  if(typeof o.color!=='string'||!/^#[\da-f]{6}$/i.test(o.color))throw new LocalOutputError(`${path}.color 必须是 #RRGGBB 格式`);
  if(!Number.isFinite(o.rotation))throw new LocalOutputError(`${path}.rotation 必须是数字角度`);
  if(typeof o.name!=='string'||!o.name.trim())throw new LocalOutputError(`${path}.name 不能为空`);
  if(o.shape!==undefined&&!['ring','solid'].includes(o.shape)||o.shape==='ring'&&o.kind!=='path')throw new LocalOutputError(`${path}.shape 只支持 solid 或用于 path 的 ring`);
 }
 return parseWorld(JSON.stringify(w));
}
