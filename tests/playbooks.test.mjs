import assert from 'node:assert/strict';
import test from 'node:test';
import { PLAYBOOK_GROUPS, PLAYBOOKS } from '../public/planner/playbooks.mjs';

test('playbook categories have unique article anchors and valid related guide links', () => {
  const ids = new Set(PLAYBOOKS.map(playbook => playbook.id));
  assert.equal(ids.size, PLAYBOOKS.length);
  assert.deepEqual(PLAYBOOK_GROUPS.map(group => group.id), ['session', 'momentum', 'desk', 'swing', 'scalp']);
  assert.ok(PLAYBOOK_GROUPS.every(group => group.playbooks.length > 0));
  for (const playbook of PLAYBOOKS) {
    for (const tool of playbook.tools ?? []) {
      if (tool.href.startsWith('#playbook-')) assert.ok(ids.has(tool.href.slice('#playbook-'.length)), tool.href);
    }
  }
});

test('the momentum guides retain all twelve mechanics and gate the opening drive', () => {
  const momentum = PLAYBOOK_GROUPS.find(group => group.id === 'momentum').playbooks;
  assert.deepEqual(momentum.map(playbook => playbook.setups.length), [6, 6]);
  assert.deepEqual(momentum.flatMap(playbook => playbook.setups.map(setup => setup.name)), [
    'Breakout', 'Breakout and Retest', 'Pullback Continuation', 'Consolidation Continuation', 'Trend Continuation', 'Reclaim',
    'Opening Drive', 'Momentum Ignition', 'Squeeze', 'Sympathy Momentum', 'Failed Break into Opposite Momentum',
    'Exhaustion into Momentum Reversal',
  ]);
  const opening = momentum[1].setups[0];
  assert.match(opening.context, /Observe.*9:30–9:40 a\.m\. ET/);
  assert.match(opening.entry, /wait until 9:45 a\.m\. ET/);
});
