import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generate, initialPrompt, distance, parseWorld } from './scene';
test('generates dimensions, counts and relative chair layout',()=>{const w=generate(initialPrompt);assert.deepEqual(w.dimensions,[10,8]);assert.equal(w.objects.length,8);const chairs=w.objects.filter(o=>o.kind==='chair');assert.equal(chairs.length,2);assert.ok(chairs.every(o=>o.position[1]>0));assert.ok(distance(chairs[0],chairs[1])>.9);});
test('round trips the scene and rejects invalid imported objects',()=>{const w=generate(initialPrompt);assert.deepEqual(parseWorld(JSON.stringify(w)),w);const bad=structuredClone(w);bad.objects[0].size[0]=-1;assert.throws(()=>parseWorld(JSON.stringify(bad)));const duplicate=structuredClone(w);duplicate.objects[1].id=duplicate.objects[0].id;assert.throws(()=>parseWorld(JSON.stringify(duplicate)));});
test('bounds generation and respects west positioning',()=>{const w=generate('生成 100×2 米的房间，西侧放三把椅子');assert.deepEqual(w.dimensions,[40,4]);assert.equal(w.objects.length,3);assert.ok(w.objects.every(o=>o.position[0]<0));assert.equal(generate('蓝天白云').objects.length,0);});
