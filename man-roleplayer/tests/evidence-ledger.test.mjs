import test from 'node:test'
import assert from 'node:assert/strict'
import { EvidenceLedger } from '../lib/evidence-ledger.js'
test('ledger grants only current persona and turn, then clears', () => {
  const l = new EvidenceLedger('alpha', 't1')
  assert.equal(l.grant({ evidenceId: 'a', kind: 'anecdote', personaId: 'alpha', turnId: 't1' }), true)
  assert.equal(l.grant({ evidenceId: 'b', kind: 'quote', personaId: 'beta', turnId: 't1' }), false)
  assert.equal(l.grant({ evidenceId: 'c', kind: 'quote', personaId: 'alpha', turnId: 't0' }), false)
  assert.equal(l.hasCurrentGrant('a', 'anecdote'), true); l.clear(); assert.equal(l.hasCurrentGrant('a'), false)
})
