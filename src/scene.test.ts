import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, initialPrompt, distance, parseWorld } from './scene';
test('generates dimensions, counts and relative chair layout',()=>{const w=generate(initialPrompt);assert.deepEqual(w.dimensions,[10,8]);assert.equal(w.objects.length,8);const chairs=w.objects.filter(o=>o.kind==='chair');assert.equal(chairs.length,2);assert.ok(chairs.every(o=>o.position[1]>0));assert.ok(distance(chairs[0],chairs[1])>.9);});
test('round trips the scene and rejects invalid imported objects',()=>{const w=generate(initialPrompt);assert.deepEqual(parseWorld(JSON.stringify(w)),w);const bad=structuredClone(w);bad.objects[0].size[0]=-1;assert.throws(()=>parseWorld(JSON.stringify(bad)));const duplicate=structuredClone(w);duplicate.objects[1].id=duplicate.objects[0].id;assert.throws(()=>parseWorld(JSON.stringify(duplicate)));});
test('bounds generation and respects west positioning',()=>{const w=generate('生成 100×2 米的房间，西侧放三把椅子');assert.deepEqual(w.dimensions,[40,4]);assert.equal(w.objects.length,3);assert.ok(w.objects.every(o=>o.position[0]<0));assert.equal(generate('蓝天白云').objects.length,0);});

test('lakeside template round trips with all supported outdoor assets',async()=>{
 const {generateLakeside}=await import('./scene');const w=generateLakeside();
 assert.equal(w.environment,'outdoor');assert.deepEqual(w.dimensions,[120,100]);assert.deepEqual(parseWorld(JSON.stringify(w)),w);
 for(const kind of ['lake','island','path','bridge','pavilion','tree','bench','sign','rock'])assert.ok(w.objects.some(o=>o.kind===kind),kind);
 const ring=w.objects.find(o=>o.shape==='ring')!;const lake=w.objects.find(o=>o.kind==='lake')!;assert.ok(ring.size[0]*.86>lake.size[0]);assert.ok(ring.size[1]*.86>lake.size[1]);
 const bridge=w.objects.find(o=>o.kind==='bridge')!;const island=w.objects.find(o=>o.kind==='island')!;
 assert.equal(bridge.position[0]-bridge.size[0]/2,island.size[0]/2);assert.ok(bridge.position[0]+bridge.size[0]/2>=ring.size[0]/2*.86);
 const deck=bridge.position[2]+bridge.size[2]*.28;assert.ok(deck>lake.position[2]+lake.size[2]);
});
test('outdoor generation scales footprints within supported field and preserves indoor limits',()=>{
 const w=generate('生成一个 200×160 米的湖畔景区');assert.deepEqual(w.dimensions,[200,160]);
 assert.deepEqual(parseWorld(JSON.stringify(w)),w);
 for(const o of w.objects){assert.ok(Math.abs(o.position[0])+o.size[0]/2<=100,o.name);assert.ok(Math.abs(o.position[1])+o.size[1]/2<=80,o.name);}
 const invalid={...w,environment:'indoor'};assert.throws(()=>parseWorld(JSON.stringify(invalid)));
 const bad=structuredClone(w);bad.objects[0].shape='ring';assert.throws(()=>parseWorld(JSON.stringify(bad)));
 const renamed=structuredClone(w);renamed.objects.find(o=>o.shape==='ring')!.name='新的步道名称';assert.equal(parseWorld(JSON.stringify(renamed)).objects.find(o=>o.shape==='ring')!.shape,'ring');
});
