export type Kind = 'table' | 'chair' | 'shelf' | 'plant' | 'sofa' | 'lamp' | 'lake' | 'island' | 'path' | 'bridge' | 'pavilion' | 'tree' | 'bench' | 'sign' | 'rock';
export type Vec = [number, number, number];
export interface SceneObject { id: string; name: string; kind: Kind; shape?: 'ring' | 'solid'; position: Vec; size: Vec; rotation: number; color: string }
export interface World { version: 1; units: 'meters'; upAxis: 'Z'; name: string; environment?: 'indoor' | 'outdoor'; dimensions: [number, number]; objects: SceneObject[] }
export const specs: Record<Kind, { name: string; size: Vec; color: string }> = {
 table: { name: '桌子', size: [2.4, 1.3, .78], color: '#be9972' }, chair: { name: '椅子', size: [.6,.6,.95], color: '#738f81' }, shelf: { name: '书架', size: [1.5,.45,2.1], color: '#bd9569' }, plant: { name: '绿植', size: [.7,.7,1.5], color: '#5b8968' }, sofa: { name: '沙发', size: [2.4,.9,.85], color: '#a1a999' }, lamp: { name: '落地灯', size: [.5,.5,1.8], color: '#e1bf7c' },
 lake:{name:'湖泊',size:[54,40,.16],color:'#64b8bc'},island:{name:'湖心岛',size:[12,10,.8],color:'#93ae72'},path:{name:'步道',size:[12,3,.1],color:'#d8c6a4'},bridge:{name:'小桥',size:[24,3,1.6],color:'#a67c50'},pavilion:{name:'凉亭',size:[7,7,6],color:'#657d70'},tree:{name:'树木',size:[4,4,8],color:'#668c64'},bench:{name:'长椅',size:[2.5,.8,1.1],color:'#aa805b'},sign:{name:'指示牌',size:[2.4,.25,2.8],color:'#b29a71'},rock:{name:'景石',size:[4,3,2],color:'#999f8b'}
};
export function object(kind: Kind, position: Vec, index: number): SceneObject { return {id: `${kind}-${index}`, name: `${specs[kind].name} ${index}`, kind, position, size: [...specs[kind].size], rotation: 0, color: specs[kind].color}; }
export const initialPrompt = '生成一个 10×8 米的房间，中央放一张桌子，桌子北侧放两把椅子，东墙旁放一个书架，角落放两盆绿植，再加一张沙发和一盏落地灯。';
export function generate(prompt: string): World {
 if (/景区|湖畔|湖泊|公园|湖心岛/.test(prompt)) return generateLakeside(prompt);
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
 if(!w||typeof w!=='object'||w.version!==1||w.units!=='meters'||w.upAxis!=='Z'||typeof w.name!=='string'||(w.environment!==undefined&&!['indoor','outdoor'].includes(w.environment))||!vec(w.dimensions,2)||w.dimensions.some((v:number)=>v<4||v>(w.environment==='outdoor'?500:40))||!Array.isArray(w.objects)||w.objects.length>200) throw Error('场景格式无效：需要 v1、米制、Z-up，室内尺寸 4–40 米，室外尺寸 4–500 米，最多 200 个物体。');
 const ids = new Set();
 for(const o of w.objects) { if(!o||typeof o.id!=='string'||ids.has(o.id)||typeof o.name!=='string'||(o.shape!==undefined&&!['ring','solid'].includes(o.shape))||(o.shape==='ring'&&o.kind!=='path')||!Object.hasOwn(specs,o.kind)||!vec(o.position,3)||!vec(o.size,3)||o.size.some((v:number)=>v<=0||v>(w.environment==='outdoor'?500:40))||!Number.isFinite(o.rotation)||typeof o.color!=='string'||!/^#[0-9a-f]{6}$/i.test(o.color)) throw Error('物体数据无效：请检查 ID、坐标、尺寸及颜色。'); ids.add(o.id); }
 return w;
}

export const lakesidePrompt='生成一个 120×100 米的湖畔景区，中央是湖泊和湖心岛，环湖铺设步道，东侧设置入口，用小桥连接湖心岛，北侧放一座凉亭，沿湖布置树木、长椅和指示牌。';
export function generateLakeside(prompt=lakesidePrompt):World {
 const match=prompt.match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)/);
 const dimensions:[number,number]=match?[Math.min(500,Math.max(60,+match[1])),Math.min(500,Math.max(60,+match[2]))]:[120,100];
 const sx=dimensions[0]/120,sy=dimensions[1]/100;const objects:SceneObject[]=[];
 const add=(kind:Kind,name:string,p:Vec,size?:Vec,rotation=0)=>{const o=object(kind,[p[0]*sx,p[1]*sy,p[2]],objects.filter(o=>o.kind===kind).length+1);o.name=name;if(size)o.size=size;o.rotation=rotation;objects.push(o);return o;};
 add('lake','镜湖',[0,0,.03],[54*sx,40*sy,.16]);
 // Ring inner radii are 86% of the outer radii.
 add('path','环湖步道',[0,0,.02],[66*sx,52*sy,.1]).shape='ring';
 add('island','湖心岛',[0,0,.15],[12*sx,10*sy,.8]);
 add('bridge','湖心桥',[18,0,.65],[24*sx,3*sy,1.6]);
 add('path','入口连接步道',[43,0,.02],[22*sx,3*sy,.1]);
 add('path','凉亭连接步道',[0,29.5,.02],[3*sx,9*sy,.1]);
 add('pavilion','听风亭',[0,37,0]);
 add('sign','东入口导览牌',[54,4,0]);add('bench','湖畔长椅 1',[19,-25,0]);add('bench','湖畔长椅 2',[-19,-25,0]);add('sign','湖心岛指示牌',[33,3.5,0]);
 add('tree','岛上树木 1',[-2,-1,.95],[3,3,6]);add('tree','岛上树木 2',[2,1,.95],[2.7,2.7,5]);
 for(let i=0;i<24;i++){const a=i/24*Math.PI*2;const x=44*Math.cos(a),y=38*Math.sin(a);if((x>35&&Math.abs(y)<10)||(Math.abs(x)<10&&y>30))continue;add('tree',`湖岸树木 ${i+1}`,[x,y,0],[3.5+(i%3)*.4,3.5+(i%3)*.4,6+(i%4)]);}
 for(let i=0;i<5;i++)add('rock',`湖岸景石 ${i+1}`,[-32-i*2,8+i*3,0],[3+i*.3,2.4,1.4+i*.2]);
 return {version:1,units:'meters',upAxis:'Z',environment:'outdoor',name:'镜湖 · 湖畔微景区',dimensions,objects};
}
