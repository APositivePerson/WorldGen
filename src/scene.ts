export type Kind = 'table' | 'chair' | 'shelf' | 'plant' | 'sofa' | 'lamp';
export type Vec = [number, number, number];
export interface SceneObject { id: string; name: string; kind: Kind; position: Vec; size: Vec; rotation: number; color: string }
export interface World { version: 1; units: 'meters'; upAxis: 'Z'; name: string; dimensions: [number, number]; objects: SceneObject[] }
const specs: Record<Kind, { name: string; size: Vec; color: string }> = {
 table: { name: '桌子', size: [2.4, 1.3, .78], color: '#be9972' }, chair: { name: '椅子', size: [.6,.6,.95], color: '#738f81' }, shelf: { name: '书架', size: [1.5,.45,2.1], color: '#bd9569' }, plant: { name: '绿植', size: [.7,.7,1.5], color: '#5b8968' }, sofa: { name: '沙发', size: [2.4,.9,.85], color: '#a1a999' }, lamp: { name: '落地灯', size: [.5,.5,1.8], color: '#e1bf7c' }
};
export function object(kind: Kind, position: Vec, index: number): SceneObject { return {id: `${kind}-${index}`, name: `${specs[kind].name} ${index}`, kind, position, size: [...specs[kind].size], rotation: 0, color: specs[kind].color}; }
export const initialPrompt = '生成一个 10×8 米的房间，中央放一张桌子，桌子北侧放两把椅子，东墙旁放一个书架，角落放两盆绿植，再加一张沙发和一盏落地灯。';
export function generate(prompt: string): World {
 const match = prompt.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
 const dimensions: [number,number] = match ? [Math.min(40,Math.max(4,+match[1])), Math.min(40,Math.max(4,+match[2]))] : [10,8];
 const [w,d] = dimensions; const objects: SceneObject[] = [];
 const aliases: [Kind,RegExp][] = [['table',/桌[子]?/],['chair',/椅[子]?/],['shelf',/书架/],['plant',/绿植|植物/],['sofa',/沙发/],['lamp',/灯/]];
 const counts: Record<string,number> = {'一':1,'两':2,'二':2,'三':3,'四':4,'五':5,'六':6};
 for (const [kind, regex] of aliases) {
  const clause = prompt.split(/[，。,;；]/).find(c=>regex.test(c)); if (!clause) continue;
  const count = clause.match(/([一两二三四五六\d]+)\s*[张把个盆盏]/); const n = Math.min(12, count ? (counts[count[1]] ?? Number(count[1])) || 1 : 1);
  for(let i=0;i<n;i++) {
   let p: Vec = kind==='table'?[0,0,0]:kind==='chair'?[(i-(n-1)/2)*.95,1.25,0]:kind==='shelf'?[w/2-.5,0,0]:kind==='plant'?[i%2 ? w/2-1 : -w/2+1,d/2-1-Math.floor(i/2),0]:kind==='sofa'?[-w/2+1,0,0]:[-w/2+1,-d/2+1,0];
   if (/南/.test(clause)) p[1] = -d/2+1.4;
   if (/北/.test(clause) && kind!=='chair') p[1] = d/2-1.4;
   if (/东/.test(clause)) p[0] = w/2-.8;
   if (/西/.test(clause)) p[0] = -w/2+.8;
   objects.push(object(kind,p,i+1));
  }
 }
 return {version:1, units:'meters', upAxis:'Z', name:'宁静的阅读空间', dimensions, objects};
}
export const distance = (a: SceneObject,b: SceneObject) => Math.hypot(...a.position.map((v,i)=>v-b.position[i]));
export function parseWorld(text:string):World {
 const w = JSON.parse(text);
 const vec=(v:unknown,n:number)=>Array.isArray(v)&&v.length===n&&v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1000);
 if(!w||typeof w!=='object'||w.version!==1||w.units!=='meters'||w.upAxis!=='Z'||typeof w.name!=='string'||!vec(w.dimensions,2)||w.dimensions.some((v:number)=>v<4||v>40)||!Array.isArray(w.objects)||w.objects.length>200) throw Error('场景格式无效：需要 v1、米制、Z-up，房间尺寸 4–40 米，最多 200 个物体。');
 const ids = new Set();
 for(const o of w.objects) { if(!o||typeof o.id!=='string'||ids.has(o.id)||typeof o.name!=='string'||!Object.hasOwn(specs,o.kind)||!vec(o.position,3)||!vec(o.size,3)||o.size.some((v:number)=>v<=0||v>40)||!Number.isFinite(o.rotation)||typeof o.color!=='string'||!/^#[0-9a-f]{6}$/i.test(o.color)) throw Error('物体数据无效：请检查 ID、坐标、尺寸及颜色。'); ids.add(o.id); }
 return w;
}
