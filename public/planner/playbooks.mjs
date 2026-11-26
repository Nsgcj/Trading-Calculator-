import { SESSION_PLAYBOOKS } from './open-playbooks.mjs';
import { EQUITY_HEDGE_PLAYBOOK } from './hedge-playbook.mjs';
import { MOMENTUM_PLAYBOOKS } from './momentum-playbooks.mjs';
import { DESK_PLAYBOOKS, SWING_PLAYBOOKS, SCALP_PLAYBOOKS } from './desk-playbooks.mjs';

const sessionGuides = SESSION_PLAYBOOKS.flatMap(playbook =>
  playbook.id === 'equities-open' ? [playbook, EQUITY_HEDGE_PLAYBOOK] : [playbook],
);

export const PLAYBOOK_GROUPS = [
  { id: 'session', label: 'Session guides', playbooks: sessionGuides },
  { id: 'momentum', label: 'Momentum trades', playbooks: MOMENTUM_PLAYBOOKS },
  { id: 'desk', label: 'Desk procedures', playbooks: DESK_PLAYBOOKS },
  { id: 'swing', label: 'Swing trades', playbooks: SWING_PLAYBOOKS },
  { id: 'scalp', label: 'Scalps', playbooks: SCALP_PLAYBOOKS },
];
export const PLAYBOOKS = PLAYBOOK_GROUPS.flatMap(group => group.playbooks);

const asia = ['asian-open'];
const london = ['london-open'];
const macro = ['ny-macro-open'];
const equities = ['equities-open', 'equity-hedge'];
const equityPrep = [...equities, 'stock-in-play'];
const momentum = ['structural-momentum', 'order-flow-momentum'];
const morning = ['morning-continuation'];
const afternoon = ['afternoon-continuation'];
const close = ['power-hour', 'structural-momentum'];

const playbooksByWindow = new Map([
  ['asian-kill-zone', asia], ['asian-expansion', asia], ['sydney', asia], ['tokyo', asia],
  ['london-kill-zone', london], ['european-open', london], ['london', london],
  ['ny-macro', macro], ['macro-premarket', macro], ['new-york', macro],
  ['ny-equity-prep', equityPrep], ['ny-equity-window', equities], ['cash-open-overlap', equityPrep],
  ['us-equities', equityPrep],
  ['Prepare the equity open', equityPrep],
  ['Observe price discovery', ['equities-open']],
  ['Identify displacement and structure', ['equities-open']],
  ['Confirmed entries and retests', [...equities, ...momentum]],
  ['Continuation and position management', [...morning, ...momentum]],
  ['afternoon-continuation', [...afternoon, ...momentum]], ['afternoon-energy', afternoon],
  ['ny-close', close], ['power-hour', close],
]);

const playbooksById = new Map(PLAYBOOKS.map(playbook => [playbook.id, playbook]));

export function getPlaybooksForWindow(windowId) {
  return (playbooksByWindow.get(windowId) ?? []).map(id => playbooksById.get(id));
}
