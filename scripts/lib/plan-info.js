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

module.exports = { PLAN_INFO, VALID_PLANS };
