import test from 'node:test'; import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ProductController } from '../lib/product-controller.js'; import { ProductConversationList, ManRolesComposer, PersonaSwitcher, CandidateControls, ResultPanel } from '../lib/product-components.js'; import { validateMvpReport } from '../lib/mvp-report.js'
test('Task 9 ProductController uses Product Remote and navigates only after a successful switch', async () => {
  const calls=[]; const opened=[]
  const c=new ProductController({manRolesProduct:{
    send:async(input)=>{calls.push(['send',input]);return {ok:true}},
    switchPersona:async(input)=>{calls.push(['switch',input]);return input.personaId==='beta'?{ok:true,sessionId:'branch-beta'}:{ok:false,code:'unavailable'}},
    feedback:async(input)=>{calls.push(['feedback',input]);return {ok:true}},
  }})
  await c.send({conversationId:'c',messageId:'m-1',text:'raw'})
  await c.switchPersona({conversationId:'c',personaId:'missing',operationId:'switch-1'}, id=>opened.push(id))
  await c.switchPersona({conversationId:'c',personaId:'beta',operationId:'switch-2'}, id=>opened.push(id))
  await c.feedback({conversationId:'c',itemId:'candidate-1',action:'confirm',operationId:'feedback-1'})
  assert.equal(calls.length,4); assert.equal(calls[0][0],'send'); assert.deepEqual(opened,['branch-beta'])
})
test('Task 9 ProductController unwraps DSH Remote envelopes and leaves navigation unchanged on business failure', async () => {
  const opened=[]
  const c=new ProductController({manRolesProduct:{
    send:async()=>({ok:true,value:{ok:true}}),
    switchPersona:async()=>({ok:true,value:{ok:false,code:'branch-unavailable'}}),
    feedback:async()=>({ok:false,error:{message:'transport failed'}}),
  }})
  const switched=await c.switchPersona({conversationId:'c',personaId:'beta',operationId:'op'}, id=>opened.push(id))
  const feedback=await c.feedback({conversationId:'c',itemId:'x',action:'confirm',operationId:'feedback'})
  assert.deepEqual(opened,[]); assert.equal(switched.code,'branch-unavailable'); assert.equal(feedback.code,'transport failed')
})
test('Task 9 components consume structured product state', () => { assert.equal(ProductConversationList([{id:'c'}]).items.length,1); assert.equal(ManRolesComposer({conversationId:'c',draft:'x'}).type,'composer'); assert.equal(PersonaSwitcher('alpha',['alpha','beta']).type,'persona-switcher'); assert.equal(CandidateControls('i').type,'candidate-controls'); assert.equal(ResultPanel({}).type,'result-panel') })
test('candidate feedback UI exposes every product mutation and stable retry identity', () => {
  const source = readFileSync(new URL('../src/client/product-ui.ts', import.meta.url), 'utf8')
  assert.match(source, /const feedbackActions = \['confirm', 'partial-confirm', 'correct', 'reject', 'skip'\]/)
  assert.match(source, /'data-man-roles-feedback': action/)
  assert.match(source, /feedback-\$\{operation\}/)
  assert.match(source, /candidate\.id/)
})
test('Task 10 report rejects network/token mutation', () => { const base={schemaVersion:1,providerNetworkUsed:false,tokenCost:0,scenarios:['dual'],passed:true,trace:{productConversations:1,userRaws:1,branchEvents:1,taskCalls:0,firstAccepted:true,secondAccepted:true,switchedTo:'alpha',retryDidNotAppend:true,deliveryInterrupted:true,cancelLateResultRejected:true,budgetDurable:true,budgetPersonaIsOriginal:true}}; assert.equal(validateMvpReport(base).passed,true); assert.throws(()=>validateMvpReport({...base,providerNetworkUsed:true})); assert.throws(()=>validateMvpReport({...base,tokenCost:1})) })
