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

/**
 * Romanian food synonyms dictionary
 */
const ROMANIAN_SYNONYMS: Record<string, string[]> = {
  'cascaval': ['cascaval', 'branza tare', 'brânză tare'],
  'mozzarella': ['mozzarella', 'branza pizza', 'brânză pizza'],
  'faina': ['faina', 'faina alba', 'făină', 'făină albă', 'faina 000'],
  'smantana': ['smantana', 'smântână', 'frisca', 'frișcă'],
  'sunca': ['sunca', 'suncă', 'jambon'],
  'piept de pui': ['piept pui', 'piept de pui', 'pui piept'],
  'rosii': ['rosii', 'roșii', 'tomate', 'tomato'],
  'ardei': ['ardei', 'pepper', 'gogosar', 'gogosari'],
  'ceapa': ['ceapa', 'ceapă', 'onion'],
  'usturoi': ['usturoi', 'garlic'],
  'ulei': ['ulei', 'oil', 'ulei vegetal'],
  'sare': ['sare', 'salt'],
  'piper': ['piper', 'pepper', 'piper negru'],
  'orez': ['orez', 'rice'],
  'paste': ['paste', 'pasta', 'macaroane'],
  'lapte': ['lapte', 'milk'],
  'ou': ['ou', 'oua', 'ouă', 'egg'],
  'unt': ['unt', 'butter', 'margarina', 'margarină'],
};

/**
 * Get all synonym variations for a word
 */
function getSynonyms(word: string): string[] {
  const normalized = word.toLowerCase().trim();
  for (const [key, synonyms] of Object.entries(ROMANIAN_SYNONYMS)) {
    if (synonyms.includes(normalized)) {
      return synonyms;
    }
  }
  return [normalized];
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score (0-1) between two strings
 */
function similarityScore(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate word overlap score between two strings
 */
function wordOverlapScore(str1: string, str2: string): number {
  const words1 = str1.split(/\s+/).filter(w => w.length > 2);
  const words2 = str2.split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;

  const commonWords = words1.filter(w1 => 
    words2.some(w2 => similarityScore(w1, w2) > 0.8)
  );

  return commonWords.length / Math.max(words1.length, words2.length);
}

/**
 * Check if one string contains the other or shares significant words
 */
function containmentScore(str1: string, str2: string): number {
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.9;
  }
  
  // Check word-level containment
  const words1 = str1.split(/\s+/).filter(w => w.length > 2);
  const words2 = str2.split(/\s+/).filter(w => w.length > 2);
  
  const shorter = words1.length < words2.length ? words1 : words2;
  const longer = words1.length < words2.length ? words2 : words1;
  
  const contained = shorter.filter(w => longer.some(lw => lw.includes(w) || w.includes(lw)));
  
  if (contained.length > 0) {
    return 0.8 * (contained.length / shorter.length);
  }
  
  return 0;
}

/**
 * Normalize ingredient name for comparison
 */
function normalizeIngredientName(name: string): string {
  return removeDiacritics(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[0-9]+%/g, '') // Remove percentages
    .replace(/[0-9]+\s*(g|kg|ml|l|buc)/gi, '') // Remove quantities
    .replace(/[^a-z0-9\s]/gi, '') // Remove special characters
    .trim();
}

/**
 * Calculate hybrid match score combining multiple algorithms
 */
function calculateMatchScore(extractedName: string, inventoryName: string): number {
  const normalizedExtracted = normalizeIngredientName(extractedName);
  const normalizedInventory = normalizeIngredientName(inventoryName);

  // Exact match
  if (normalizedExtracted === normalizedInventory) {
    return 1.0;
  }

  // Check synonyms
  const extractedSynonyms = getSynonyms(normalizedExtracted);
  const inventorySynonyms = getSynonyms(normalizedInventory);
  
  for (const eSyn of extractedSynonyms) {
    for (const iSyn of inventorySynonyms) {
      if (eSyn === iSyn) {
        return 0.95;
      }
    }
  }

  // Containment check
  const containment = containmentScore(normalizedExtracted, normalizedInventory);
  if (containment > 0.85) {
    return containment;
  }

  // Word overlap
  const overlap = wordOverlapScore(normalizedExtracted, normalizedInventory);
  
  // Levenshtein similarity
  const levenshtein = similarityScore(normalizedExtracted, normalizedInventory);

  // Hybrid score: prioritize word overlap for multi-word matches
  const hybridScore = Math.max(
    levenshtein * 0.6 + overlap * 0.4,
    overlap * 0.7 + levenshtein * 0.3,
    containment
  );

  return hybridScore;
}

/**
 * Find the best matching ingredient from inventory
 */
export function findBestMatch(
  extractedName: string,
  inventoryIngredients: Ingredient[],
  threshold: number = 0.75
): { 
  matches: Array<{ ingredient: Ingredient; confidence: number }>;
  bestMatch: Ingredient | null; 
  confidence: number; 
  needsConfirmation: boolean;
} {
  
  const matches: Array<{ ingredient: Ingredient; confidence: number }> = [];

  for (const ingredient of inventoryIngredients) {
    const score = calculateMatchScore(extractedName, ingredient.name);
    
    if (score >= threshold) {
      matches.push({ ingredient, confidence: score });
    }
  }

  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);

  // Get best match
  const bestMatch = matches[0] || null;

  // Determine if confirmation is needed
  let needsConfirmation = false;
  if (!bestMatch) {
    needsConfirmation = true;
  } else if (bestMatch.confidence < 0.9) {
    needsConfirmation = true;
  } else if (matches.length > 1 && matches[1].confidence > bestMatch.confidence - 0.1) {
    // Multiple similar matches
    needsConfirmation = true;
  }

  return {
    matches: matches.slice(0, 3), // Return top 3 matches
    bestMatch: bestMatch?.ingredient || null,
    confidence: bestMatch?.confidence || 0,
    needsConfirmation
  };
}

/**
 * Match all extracted ingredients with inventory
 */
export function matchIngredients(
  extractedItems: Array<{ name: string; quantity: number; unit: string; price_per_unit?: number }>,
  inventoryIngredients: Ingredient[]
) {
  return extractedItems.map(item => {
    const matchResult = findBestMatch(item.name, inventoryIngredients);
    
    return {
      extractedName: item.name,
      quantity: item.quantity,
      unit: item.unit,
      price_per_unit: item.price_per_unit || 0,
      matchedIngredient: matchResult.bestMatch,
      alternativeMatches: matchResult.matches.slice(1), // Exclude best match
      confidence: matchResult.confidence,
      needsConfirmation: matchResult.needsConfirmation,
      isNewIngredient: matchResult.bestMatch === null
    };
  });
}
