import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuoteResolver} from '../lib/quote.mjs';
const cfg={quote:{enabled:true}};
const message={selfId:'bot',groupId:'g1',messageId:'m1',sender:{userId:'u1',name:'甲'},elements:[{type:'text',text:'周日九点见'}]};
test('引用缓存与平台查询均返回文字及发言人；不跨群取缓存',async()=>{
  const resolver=createQuoteResolver();resolver.remember(message);
  const cached=await resolver.resolve({...message,replyId:'m1'},cfg);
  assert.equal(cached.text,'周日九点见');assert.equal(cached.userId,'u1');
  let calls=0;
  const other=await resolver.resolve({...message,groupId:'g2',replyId:'m1',contact:{peer:'g2'},bot:{getMsg:async(contact,id)=>{calls++;assert.equal(contact.peer,'g2');assert.equal(id,'m1');return {...message,elements:[{type:'text',text:'另一个群'}]};}}},cfg);
  assert.equal(calls,1);assert.equal(other.text,'另一个群');
  const unavailable=await resolver.resolve({...message,replyId:'unknown',bot:{getMsg:async()=>{throw Error('missing');}}},cfg);
  assert(unavailable.unavailable);
  assert.equal(await resolver.resolve({...message,replyId:'m1'},{quote:{enabled:false}}),null);
});
