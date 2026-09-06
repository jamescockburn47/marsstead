// Local worksite transactions. Callers select nearby stores; all debits and
// refunds are planned on copies before committing, including the power cost.
import { ITEMS, massOf } from './inventory.js';
import { MACHINE_TYPES } from './machines.js';

function uniqueStores(stores) { return [...new Set(stores.filter(Boolean))]; }

function totals(costs) {
  const result = new Map();
  for (const [id, n] of costs) {
    if (!ITEMS[id] || !Number.isSafeInteger(n) || n < 0) return null;
    result.set(id, (result.get(id) || 0) + n);
  }
  return result;
}

export function poolCount(stores, id) {
  return uniqueStores(stores).reduce((n, s) => n + (s.slots[id] || 0), 0);
}

export function missingCosts(stores, costs) {
  const required = totals(costs);
  if (!required) return null;
  return [...required].map(([id, n]) => [id, Math.max(0, n - poolCount(stores, id))])
    .filter(([, n]) => n > 0);
}

export function payCosts(stores, costs, power = null, kwh = 0) {
  const missing = missingCosts(stores, costs);
  if (!missing || missing.length || !Number.isFinite(kwh) || kwh < 0
    || (kwh > 0 && (!power || !Number.isFinite(power.charge) || power.charge < kwh))) return null;
  const sources = uniqueStores(stores);
  for (const [id, required] of totals(costs)) {
    let left = required;
    for (const store of sources) {
      const take = Math.min(left, store.slots[id] || 0);
      if (take) {
        store.slots[id] -= take;
        if (!store.slots[id]) delete store.slots[id];
        left -= take;
      }
    }
  }
  if (kwh > 0) power.charge = +(power.charge - kwh).toFixed(6);
  return costs.map(([id, n]) => [id, n]);
}

export function depositCosts(stores, costs) {
  const required = totals(costs);
  if (!required) return false;
  const targets = uniqueStores(stores);
  const copies = targets.map((s) => ({ capacity: s.capacity, slots: { ...s.slots } }));
  // Heavy units first, into the tightest available fit. No original store
  // changes if any unit cannot fit; an item is never split to evade its mass.
  const ordered = [...required].sort(([a], [b]) => ITEMS[b].kg - ITEMS[a].kg);
  for (const [id, n] of ordered) {
    for (let i = 0; i < n; i++) {
      const fits = copies.map((s, index) => ({ index, free: s.capacity - massOf(s) }))
        .filter((s) => s.free + 1e-9 >= ITEMS[id].kg).sort((a, b) => a.free - b.free);
      if (!fits.length) return false;
      const chosen = copies[fits[0].index];
      chosen.slots[id] = (chosen.slots[id] || 0) + 1;
    }
  }
  targets.forEach((s, i) => { s.slots = copies[i].slots; });
  return true;
}

export function machineRefundCosts(machine) {
  const type = MACHINE_TYPES[machine.type];
  if (!type) return null;
  // Legacy saves predate payment provenance; their declared standard recipe
  // is the migration default. All new builds retain the actual paid recipe.
  const paid = machine.paidCosts ?? type.costs;
  const all = [...paid, ...machine.queue.map((id) => [id, 1]), ...Object.entries(machine.out)];
  const summed = totals(all);
  return summed ? [...summed] : null;
}

export function refundMachine(machine, stores) {
  const costs = machineRefundCosts(machine);
  if (!costs || !depositCosts(stores, costs)) return false;
  machine.queue = [];
  machine.out = {};
  machine.t = 0;
  // A successful refund is a one-shot transaction even before the caller
  // removes the scene object; repeated calls cannot mint the construction.
  machine.paidCosts = [];
  return true;
}
