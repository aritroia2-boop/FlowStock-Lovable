import { Ingredient } from './supabase';

/**
 * Romanian diacritics normalization
 */
function removeDiacritics(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ă/gi, 'a')
    .replace(/â/gi, 'a')
    .replace(/î/gi, 'i')
    .replace(/ș/gi, 's')
    .replace(/ț/gi, 't');
}

const ROMANIAN_SYNONYMS: Record<string, string[]> = {
  cascaval: ['cascaval', 'branza tare'],
  mozzarella: ['mozzarella', 'branza pizza'],
  faina: ['faina', 'faina alba', 'faina 000'],
  smantana: ['smantana', 'frisca'],
  sunca: ['sunca', 'jambon'],
  rosii: ['rosii', 'tomate', 'tomato'],
  ardei: ['ardei', 'pepper', 'gogosar', 'gogosari'],
  ceapa: ['ceapa', 'onion'],
  usturoi: ['usturoi', 'garlic'],
  ulei: ['ulei', 'oil'],
  sare: ['sare', 'salt'],
  piper: ['piper', 'pepper'],
  orez: ['orez', 'rice'],
  paste: ['paste', 'pasta', 'macaroane'],
  lapte: ['lapte', 'milk'],
  ou: ['ou', 'oua', 'egg'],
  unt: ['unt', 'butter'],
};

function getSynonymKey(word: string): string {
  const n = word.toLowerCase().trim();
  for (const [key, syns] of Object.entries(ROMANIAN_SYNONYMS)) {
    if (syns.includes(n)) return key;
  }
  return n;
}

function levenshteinDistance(s1: string, s2: string): number {
  const m: number[][] = [];
  for (let i = 0; i <= s2.length; i++) m[i] = [i];
  for (let j = 0; j <= s1.length; j++) m[0][j] = j;
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      m[i][j] = s2[i - 1] === s1[j - 1]
        ? m[i - 1][j - 1]
        : Math.min(m[i - 1][j - 1] + 1, m[i][j - 1] + 1, m[i - 1][j] + 1);
    }
  }
  return m[s2.length][s1.length];
}

function similarityScore(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

/** Strip percentages, brands, sizes for the *base name* comparison only */
function baseName(name: string): string {
  return removeDiacritics(name)
    .toLowerCase()
    .replace(/[0-9]+([.,][0-9]+)?\s*%/g, '')
    .replace(/[0-9]+([.,][0-9]+)?\s*(g|kg|ml|l|buc|gr|gram|grame|litri|litru)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract numeric attributes from a raw text name */
function inferAttributesFromName(name: string): Record<string, any> {
  const attrs: Record<string, any> = {};
  const fat = name.match(/(\d+(?:[.,]\d+)?)\s*%\s*(grasime|fat|gr[aă]sime)?/i);
  if (fat) attrs.fat_pct = parseFloat(fat[1].replace(',', '.'));
  const proteinM = name.match(/(\d+(?:[.,]\d+)?)\s*%\s*(protein|proteine|prot)/i);
  if (proteinM) attrs.protein_pct = parseFloat(proteinM[1].replace(',', '.'));
  const pkg = name.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|gr)\b/i);
  if (pkg) attrs.packaging_size = `${pkg[1]}${pkg[2].toLowerCase()}`;
  return attrs;
}

function mergeAttributes(explicit: Record<string, any> | undefined, name: string): Record<string, any> {
  return { ...inferAttributesFromName(name), ...(explicit || {}) };
}

/**
 * Compare numeric attributes with tolerance.
 * Returns:
 *  - 'match' (1.0)
 *  - 'mismatch' (0)  — hard incompatibility
 *  - 'unknown' (neutral)
 */
function compareNumeric(a: number | undefined, b: number | undefined, tol = 0.2): 'match' | 'mismatch' | 'unknown' {
  if (a == null || b == null) return 'unknown';
  return Math.abs(a - b) <= tol ? 'match' : 'mismatch';
}

function compareString(a: string | undefined, b: string | undefined): 'match' | 'mismatch' | 'unknown' {
  if (!a || !b) return 'unknown';
  const an = removeDiacritics(a).toLowerCase().trim();
  const bn = removeDiacritics(b).toLowerCase().trim();
  if (!an || !bn) return 'unknown';
  return an === bn || an.includes(bn) || bn.includes(an) ? 'match' : 'mismatch';
}

/**
 * Hybrid attribute-aware match score.
 * - Base name similarity (synonyms + Levenshtein) accounts for ~50%
 * - Attribute compatibility acts as a gate: any hard mismatch caps the score at 0.4.
 */
function calculateMatchScore(
  invoiceName: string,
  invoiceAttrs: Record<string, any>,
  candidateName: string,
  candidateAttrs: Record<string, any>
): number {
  const invBase = baseName(invoiceName);
  const candBase = baseName(candidateName);

  // Base name similarity with synonym normalization
  const invKey = getSynonymKey(invBase);
  const candKey = getSynonymKey(candBase);

  let nameScore = 0;
  if (invBase === candBase) nameScore = 1.0;
  else if (invKey === candKey) nameScore = 0.95;
  else nameScore = similarityScore(invBase, candBase);

  // Attribute checks
  const checks = [
    compareNumeric(invoiceAttrs.fat_pct, candidateAttrs.fat_pct, 0.2),
    compareNumeric(invoiceAttrs.protein_pct, candidateAttrs.protein_pct, 0.5),
    compareString(invoiceAttrs.brand, candidateAttrs.brand),
    compareString(invoiceAttrs.packaging_size, candidateAttrs.packaging_size),
    compareString(invoiceAttrs.type, candidateAttrs.type),
  ];

  const hasMismatch = checks.some((c) => c === 'mismatch');
  const matches = checks.filter((c) => c === 'match').length;
  const knowns = checks.filter((c) => c !== 'unknown').length;

  // Hard gate: any attribute mismatch caps score at 0.4
  if (hasMismatch) {
    return Math.min(nameScore, 0.4);
  }

  // Bonus when attributes positively confirm
  const attrBonus = knowns > 0 ? (matches / knowns) * 0.2 : 0;
  const finalScore = Math.min(1, nameScore * 0.85 + attrBonus);
  return finalScore;
}

export function findBestMatch(
  extractedName: string,
  extractedAttrs: Record<string, any>,
  inventoryIngredients: Ingredient[],
  threshold: number = 0.7
) {
  const invoiceAttrs = mergeAttributes(extractedAttrs, extractedName);

  const matches: Array<{ ingredient: Ingredient; confidence: number }> = [];
  for (const ingredient of inventoryIngredients) {
    const candAttrs = mergeAttributes((ingredient as any).attributes, ingredient.name);
    const score = calculateMatchScore(extractedName, invoiceAttrs, ingredient.name, candAttrs);
    if (score >= threshold) matches.push({ ingredient, confidence: score });
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  const bestMatch = matches[0] || null;

  let needsConfirmation = false;
  let isNewIngredient = false;
  if (!bestMatch) {
    needsConfirmation = true;
    isNewIngredient = true;
  } else if (bestMatch.confidence < 0.9) {
    needsConfirmation = true;
  } else if (matches.length > 1 && matches[1].confidence > bestMatch.confidence - 0.1) {
    needsConfirmation = true;
  }

  return {
    matches: matches.slice(0, 3),
    bestMatch: bestMatch?.ingredient || null,
    confidence: bestMatch?.confidence || 0,
    needsConfirmation,
    isNewIngredient,
    attributes: invoiceAttrs,
  };
}

export function matchIngredients(
  extractedItems: Array<{
    name: string;
    quantity: number;
    unit: string;
    price_per_unit?: number;
    attributes?: Record<string, any>;
  }>,
  inventoryIngredients: Ingredient[]
) {
  return extractedItems.map((item) => {
    const result = findBestMatch(item.name, item.attributes || {}, inventoryIngredients);
    return {
      extractedName: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price_per_unit: item.price_per_unit || 0,
      attributes: result.attributes,
      matchedIngredient: result.bestMatch,
      alternativeMatches: result.matches.slice(1),
      confidence: result.confidence,
      needsConfirmation: result.needsConfirmation,
      isNewIngredient: result.isNewIngredient,
    };
  });
}
