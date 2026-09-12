import test from 'node:test'
import assert from 'node:assert/strict'
import { FINAL_ACTOR_TOOL_NAMES } from '../lib/actor-tool-contract.js'
test('native actor final whitelist is product-scoped and excludes host tools', () => {
  assert.deepEqual(FINAL_ACTOR_TOOL_NAMES, ['retrieve_anecdotes', 'fetch_anecdote', 'retrieve_quotes', 'fetch_quote', 'web_search', 'submit_actor_reply'])
  assert.equal(FINAL_ACTOR_TOOL_NAMES.some((x) => /shell|terminal|file|code|web_fetch/i.test(x)), false)
})
