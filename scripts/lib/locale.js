/**
 * locale.js — Shared locale resolution
 */

const SUPPORTED_LOCALES = ['en','ko','ja','zh','es','fr','de','pt','it','ru','ar','hi','bn','id','ms','th','vi','tr','pl','nl','he','sv','no'];

function resolveLocale(requested) {
  if (requested && SUPPORTED_LOCALES.includes(requested)) return requested;
  const lang = (process.env.LANG || '').split('.')[0].split('_')[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(lang) ? lang : 'en';
}

module.exports = { SUPPORTED_LOCALES, resolveLocale };
