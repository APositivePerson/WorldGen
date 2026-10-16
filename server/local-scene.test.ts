import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateLakeside} from '../src/scene';
import {readLocalWorld,localSchema} from './local-scene';
const response=(w:unknown)=>({done:true,message:{content:JSON.stringify(w)}});
test('local parser reports outdoor metadata, vectors and IDs without leaking model prose',()=>{
 const w=generateLakeside();assert.deepEqual(readLocalWorld(response(w)),w);
 assert.throws(()=>readLocalWorld(response({...w,environment:undefined})),/environment/);
 const invalid=structuredClone(w);invalid.objects[1].id=invalid.objects[0].id;assert.throws(()=>readLocalWorld(response(invalid)),/id 缺失或重复/);
 assert.throws(()=>readLocalWorld({done:true,done_reason:'length',message:{content:'{"version":'}}),/被截断/);
 assert.throws(()=>readLocalWorld({done:true,message:{content:'private model prose'}}),/完整合法的 JSON/);
 assert.deepEqual(readLocalWorld({done:true,message:{content:'```json\n'+JSON.stringify(w)+'\n```'}}),w);
});
test('local schemas constrain generation but preserve room for existing scene edits',()=>{
 assert.equal(localSchema(true,false).properties.dimensions.items.maximum,500);
 assert.equal(localSchema(false,false).properties.dimensions.items.maximum,40);
 assert.equal(localSchema(true,false).properties.objects.maxItems,24);
 assert.equal(localSchema(true,true).properties.objects.maxItems,200);
});
