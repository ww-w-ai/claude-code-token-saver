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

const _unknownModels = new Set();
function calcCost(input, cc5m, cc1h, cacheRead, output, model) {
  const rates = MODEL_PRICING[model];
  if (!rates && model && model !== 'unknown' && model !== '<synthetic>' && !_unknownModels.has(model)) {
    _unknownModels.add(model);
    const pricingPath = path.join(__dirname, '..', 'model-pricing.json');
    process.stderr.write(
`\u26A0\uFE0F  Unknown model "${model}" \u2014 using default pricing (${PRICING_DATA.default}).

   Paste this into Claude Code to fix:

   Read ${pricingPath} and add "${model}" to the "models" object.
   Match the existing row format: { "input": N, "cacheCreate5m": N, "cacheCreate1h": N, "cacheRead": N, "output": N, "contextWindow": N }
   Look up pricing at ${PRICING_DATA._source}
   Then re-run /usage-view with --force to regenerate caches.

`);
  }
  const r = rates || DEFAULT_PRICING;
  return (
    (input * r.input +
      cc5m * r.cacheCreate5m +
      cc1h * r.cacheCreate1h +
      cacheRead * r.cacheRead +
      output * r.output) /
    1_000_000
  );
}

module.exports = { PRICING_DATA, MODEL_PRICING, DEFAULT_PRICING, getRates, calcCost };
