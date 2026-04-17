/**
 * pricing.js — Shared model pricing utilities
 */

const fs = require('fs');
const path = require('path');

const PRICING_PATH = path.join(__dirname, '..', 'model-pricing.json');
const PRICING_DATA = JSON.parse(fs.readFileSync(PRICING_PATH, 'utf8'));
const MODEL_PRICING = { ...PRICING_DATA.models };
for (const [alias, target] of Object.entries(PRICING_DATA.aliases)) {
  MODEL_PRICING[alias] = MODEL_PRICING[target];
}
const DEFAULT_PRICING = MODEL_PRICING[PRICING_DATA.default];

function getRates(model) {
  return MODEL_PRICING[model] || DEFAULT_PRICING;
}

class UnknownModelError extends Error {
  constructor(model) {
    super(`UNKNOWN_MODEL:${model}`);
    this.name = 'UnknownModelError';
    this.model = model;
  }
}

function calcCost(input, cc5m, cc1h, cacheRead, output, model) {
  if (model === 'unknown' || model === '<synthetic>' || !model) {
    return 0;
  }
  const r = MODEL_PRICING[model];
  if (!r) {
    throw new UnknownModelError(model);
  }
  return (
    (input * r.input +
      cc5m * r.cacheCreate5m +
      cc1h * r.cacheCreate1h +
      cacheRead * r.cacheRead +
      output * r.output) /
    1_000_000
  );
}

module.exports = { PRICING_DATA, MODEL_PRICING, DEFAULT_PRICING, getRates, calcCost, UnknownModelError };
