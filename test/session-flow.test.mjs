import test from 'node:test';
import assert from 'node:assert/strict';
import {returnDestination,clearConnection} from '../server/session-flow.mjs';
test('return destination only permits a fixed local app',()=>{
  assert.equal(returnDestination('app'),'http://127.0.0.1:4320/');
  for(const value of ['https://other.example','//other.example',null,'APP'])assert.equal(returnDestination(value),'/');
});
test('disconnect clears authentication and displayed balance, preserving CSRF',()=>{
  const s={accessToken:'test-token',expiresAt:123,lastResult:{credits:100},sessionId:'mcp',protocolVersion:'test',initialized:true,lastRefresh:123,status:'ok',csrf:'unchanged'};
  clearConnection(s);
  for(const key of ['accessToken','lastResult','sessionId','protocolVersion'])assert.equal(s[key],null);
  assert.equal(s.expiresAt,0);assert.equal(s.lastRefresh,0);assert.equal(s.initialized,false);assert.equal(s.csrf,'unchanged');
});
