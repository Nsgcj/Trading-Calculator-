import { SESSION_PLAYBOOKS } from './open-playbooks.mjs';
import { EQUITY_HEDGE_PLAYBOOK } from './hedge-playbook.mjs';

export const PLAYBOOKS = SESSION_PLAYBOOKS.flatMap(playbook =>
  playbook.id === 'equities-open' ? [playbook, EQUITY_HEDGE_PLAYBOOK] : [playbook],
);

const asia = ['asian-open'];
const london = ['london-open'];
const macro = ['ny-macro-open'];
const equities = ['equities-open', 'equity-hedge'];
const morning = ['morning-continuation'];
const afternoon = ['afternoon-continuation'];
const close = ['power-hour'];

const playbooksByWindow = new Map([
  ['asian-kill-zone', asia], ['asian-expansion', asia], ['sydney', asia], ['tokyo', asia],
  ['london-kill-zone', london], ['european-open', london], ['london', london],
  ['ny-macro', macro], ['macro-premarket', macro], ['new-york', macro],
  ['ny-equity-prep', equities], ['ny-equity-window', equities], ['cash-open-overlap', equities],
  ['us-equities', equities],
  ['Prepare the equity open', equities],
  ['Observe price discovery', ['equities-open']],
  ['Identify displacement and structure', ['equities-open']],
  ['Confirmed entries and retests', equities],
  ['Continuation and position management', morning],
  ['afternoon-continuation', afternoon], ['afternoon-energy', afternoon],
  ['ny-close', close], ['power-hour', close],
]);

const playbooksById = new Map(PLAYBOOKS.map(playbook => [playbook.id, playbook]));

export function getPlaybooksForWindow(windowId) {
  return (playbooksByWindow.get(windowId) ?? []).map(id => playbooksById.get(id));
}
