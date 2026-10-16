import { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { World, SceneObject } from './scene';
function material(color:string){return new T.MeshStandardMaterial({color,roughness:.8});}
function model(o:SceneObject){
 const g=new T.Group(); const [w,d,h]=o.size;
 const box=(x:number,y:number,z:number,a:number,b:number,c:number,color=o.color)=>{const m=new T.Mesh(new T.BoxGeometry(a,b,c),material(color));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);};
 const leg=(x:number,y:number,z:number,height:number)=>box(x,y,z,.07,.07,height,'#514a40');
 if(o.kind==='table'){box(0,0,h-.06,w,d,.12);for(const x of [-1,1])for(const y of [-1,1])leg(x*(w/2-.15),y*(d/2-.15),(h-.12)/2,h-.12);}
 if(o.kind==='chair'){box(0,0,h*.46,w,d,.1);box(0,d/2-.05,h*.75,w,.1,h*.5);for(const x of [-1,1])for(const y of [-1,1])leg(x*(w/2-.08),y*(d/2-.08),h*.22,h*.44);}
 if(o.kind==='shelf'){for(const x of [-1,1])box(x*(w/2-.04),0,h/2,.08,d,h);for(let i=0;i<5;i++){box(0,0,.08+i*(h-.16)/4,w,d,.07);if(i<4)for(let j=0;j<6;j++)box(-w/2+.18+j*.2,0,.25+i*(h-.16)/4,.12,d*.65,.3,['#7d927e','#c9b191','#6d7d8b'][j%3]);}}
 if(o.kind==='sofa'){box(0,0,h*.35,w,d,h*.4);box(0,d*.4,h*.65,w,d*.2,h*.7);for(const x of [-1,1])box(x*(w/2-.1),0,h*.5,.2,d,h*.65);for(const x of [-1,1])leg(x*w*.4,0,.1,.2);}
 if(o.kind==='plant'){const pot=new T.Mesh(new T.CylinderGeometry(w*.28,w*.2,h*.3,16),material('#d0b096'));pot.rotation.x=Math.PI/2;pot.position.z=h*.15;g.add(pot);for(let i=0;i<5;i++){const leaf=new T.Mesh(new T.SphereGeometry(w*.3,12,12),material(o.color));leaf.scale.set(1,.8,1.6);leaf.position.set(Math.sin(i*2)*w*.2,Math.cos(i*2)*d*.2,h*.52+i*.07);leaf.castShadow=true;g.add(leaf);}}
 if(o.kind==='lamp'){box(0,0,.03,w,d,.06,'#48463d');box(0,0,h*.45,.04,.04,h*.9,'#665c48');const shade=new T.Mesh(new T.ConeGeometry(w*.65,h*.22,24,1,true),material(o.color));shade.rotation.x=Math.PI/2;shade.position.z=h*.87;g.add(shade);}
 g.position.fromArray(o.position);g.rotation.z=o.rotation*Math.PI/180;g.userData.id=o.id;return g;
}
export default function Viewport({world,selected,onSelect,focus,top,grid}:{world:World;selected:string|null;onSelect:(id:string|null)=>void;focus:number;top:boolean;grid:boolean}){
 const host=useRef<HTMLDivElement>(null); const runtime=useRef<{camera:T.PerspectiveCamera;controls:OrbitControls}|null>(null);const [error,setError]=useState('');
 useEffect(()=>{
  const el=host.current!;let renderer:T.WebGLRenderer;try{renderer=new T.WebGLRenderer({antialias:true});}catch{setError('无法启动 WebGL。请在支持硬件加速的浏览器中打开；场景编辑与导出仍可使用。');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.setClearColor('#e9e8e2');el.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.up.set(0,0,1);const camera=new T.PerspectiveCamera(42,1,.1,200);camera.up.set(0,0,1);camera.position.set(12,-15,13);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,0,.5);controls.maxPolarAngle=Math.PI/2-.03;controls.minDistance=2;controls.maxDistance=65;runtime.current={camera,controls};
  scene.add(new T.HemisphereLight('#fff9ed','#9daca0',2.5));const sun=new T.DirectionalLight('#fff4da',3);sun.position.set(-6,-5,14);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.normalBias=.04;scene.add(sun);
  const [w,d]=world.dimensions;const floor=new T.Mesh(new T.BoxGeometry(w,d,.16),material('#dad8cc'));floor.position.z=-.1;floor.receiveShadow=true;scene.add(floor);
  for(let y=-d/2;y<=d/2;y+=.5){const line=new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-w/2,y,0),new T.Vector3(w/2,y,0)]),new T.LineBasicMaterial({color:'#bcbeb1',transparent:true,opacity:.3}));scene.add(line);}
  if(grid){const helper=new T.GridHelper(Math.max(w,d),Math.round(Math.max(w,d)), '#96a79d','#bcc5ba');helper.rotation.x=Math.PI/2;helper.position.z=.005;scene.add(helper);scene.add(new T.AxesHelper(2));}
  for(const [x,y,a,b] of [[0,d/2,w,.13],[-w/2,0,.13,d]]){const wall=new T.Mesh(new T.BoxGeometry(a,b,.65),material('#ebe9de'));wall.position.set(x,y,.28);wall.receiveShadow=true;scene.add(wall);}
  const models=world.objects.map(o=>{const m=model(o);scene.add(m);if(o.id===selected){const helper=new T.BoxHelper(m,'#57836c');scene.add(helper);}return m;});
  const ray=new T.Raycaster();let down=[0,0];const pointerDown=(e:PointerEvent)=>{down=[e.clientX,e.clientY];};const click=(e:PointerEvent)=>{if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=el.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hit=ray.intersectObjects(models,true)[0];let o:T.Object3D|undefined=hit?.object;while(o&&!o.userData.id)o=o.parent??undefined;onSelect(o?.userData.id??null);};
  renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',click);
  const resize=new ResizeObserver(()=>{camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);});resize.observe(el);
  renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
  return()=>{resize.disconnect();renderer.setAnimationLoop(null);controls.dispose();scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});renderer.dispose();el.removeChild(renderer.domElement);runtime.current=null;};
 },[world,selected,grid]);
 useEffect(()=>{const r=runtime.current;if(!r)return;const obj=world.objects.find(o=>o.id===selected);const p=obj?new T.Vector3(...obj.position):new T.Vector3();r.controls.target.copy(p);r.camera.position.copy(p).add(top?new T.Vector3(0,-.01,18):new T.Vector3(12,-15,13));r.controls.update();},[focus,top,world,selected]);
 return <div className="canvas-host" ref={host}>{error&&<div className="webgl-error">{error}</div>}</div>;
}
