/**
 * plan-info.js — Shared plan metadata
 */

const PLAN_INFO = {
  pro: { key: 'pro', name: 'Pro', price: '$20/mo', priceNum: 20, label: 'Pro ($20/mo)', type: 'flat' },
  max100: { key: 'max100', name: 'Max 5x', price: '$100/mo', priceNum: 100, label: 'Max 5x ($100/mo)', type: 'flat' },
  max200: { key: 'max200', name: 'Max 20x', price: '$200/mo', priceNum: 200, label: 'Max 20x ($200/mo)', type: 'flat' },
  team: { key: 'team', name: 'Team Standard', price: '$20/seat/mo', priceNum: 20, label: 'Team Standard ($20/seat/mo)', type: 'flat' },
  team_premium: { key: 'team_premium', name: 'Team Premium', price: '$100/seat/mo', priceNum: 100, label: 'Team Premium ($100/seat/mo)', type: 'flat' },
  enterprise: { key: 'enterprise', name: 'Enterprise', price: 'custom', priceNum: null, label: 'Enterprise', type: 'usage' },
  bedrock: { key: 'bedrock', name: 'Amazon Bedrock', price: 'usage-based', priceNum: null, label: 'Amazon Bedrock', type: 'usage' },
  foundry: { key: 'foundry', name: 'Microsoft Foundry', price: 'usage-based', priceNum: null, label: 'Microsoft Foundry', type: 'usage' },
  vertex: { key: 'vertex', name: 'Google Vertex AI', price: 'usage-based', priceNum: null, label: 'Google Vertex AI', type: 'usage' },
};

const VALID_PLANS = Object.keys(PLAN_INFO);

// ── Codex plans ───────────────────────────────────────────────────
// Order and vocabulary verified against codex-rs/protocol/src/account.rs.
// "unknown" is the catch-all bucket for a plan_type Codex sends that this
// list has not been taught yet — the raw string is preserved on the entry
// (see normalizeCodexPlan), never collapsed to the literal word "unknown".
const CODEX_PLAN_ORDER = [
  'free', 'go', 'plus', 'pro', 'prolite', 'team',
  'self_serve_business_usage_based', 'business',
  'enterprise_cbp_usage_based', 'enterprise', 'edu', 'unknown',
];

const CODEX_PLAN_INFO = {
  free: { key: 'free', name: 'Free', label: 'Free' },
  go: { key: 'go', name: 'Go', label: 'Go' },
  plus: { key: 'plus', name: 'Plus', label: 'Plus' },
  pro: { key: 'pro', name: 'Pro', label: 'Pro' },
  prolite: { key: 'prolite', name: 'Pro Lite', label: 'Pro Lite' },
  team: { key: 'team', name: 'Team', label: 'Team' },
  self_serve_business_usage_based: { key: 'self_serve_business_usage_based', name: 'Business (usage-based, self-serve)', label: 'Business (usage-based, self-serve)' },
  business: { key: 'business', name: 'Business', label: 'Business' },
  enterprise_cbp_usage_based: { key: 'enterprise_cbp_usage_based', name: 'Enterprise (usage-based)', label: 'Enterprise (usage-based)' },
  enterprise: { key: 'enterprise', name: 'Enterprise', label: 'Enterprise' },
  edu: { key: 'edu', name: 'Edu', label: 'Edu' },
  unknown: { key: 'unknown', name: 'Unknown', label: 'Unknown' },
};

// UI numbering mirrors CODEX_PLAN_ORDER 1:1 (1=free .. 11=edu). "unknown" has
// no UI slot — it is never something a user picks, only something a plan_type
// we don't recognize falls into.
const CODEX_UI_CHOICE_MAP = {};
CODEX_PLAN_ORDER.filter((k) => k !== 'unknown').forEach((key, i) => {
  CODEX_UI_CHOICE_MAP[String(i + 1)] = key;
});

/**
 * Normalize a raw Codex `plan_type` string into { key, raw }.
 * `key` is one of CODEX_PLAN_ORDER; `raw` preserves exactly what Codex sent,
 * even when key === 'unknown' — an unrecognized plan_type must still be
 * displayable, not silently mapped to the literal string "unknown".
 */
function normalizeCodexPlan(planType) {
  if (planType && CODEX_PLAN_ORDER.includes(planType)) {
    return { key: planType, raw: planType };
  }
  return { key: 'unknown', raw: planType != null ? String(planType) : null };
}

/**
 * Resolve a user-facing plan selector — either a UI number ("2") or a plan
 * key typed directly ("go") — into a canonical CODEX_PLAN_ORDER key.
 * Returns null when the input matches neither form.
 */
function resolveCodexPlanChoice(input) {
  if (input == null) return null;
  const s = String(input).trim().toLowerCase();
  if (CODEX_UI_CHOICE_MAP[s]) return CODEX_UI_CHOICE_MAP[s];
  if (CODEX_PLAN_ORDER.includes(s) && s !== 'unknown') return s;
  return null;
}

module.exports = {
  PLAN_INFO, VALID_PLANS,
  CODEX_PLAN_ORDER, CODEX_PLAN_INFO, CODEX_UI_CHOICE_MAP,
  normalizeCodexPlan, resolveCodexPlanChoice,
};
