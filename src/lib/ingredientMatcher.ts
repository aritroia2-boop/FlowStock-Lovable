import { Ingredient } from './supabase';

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
 * Normalize ingredient name for comparison
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[0-9]+%/g, '') // Remove percentages (e.g., "Mozzarella 45%")
    .replace(/[0-9]+\s*(g|kg|ml|l|buc)/gi, '') // Remove quantities
    .trim();
}

/**
 * Find the best matching ingredient from inventory
 */
export function findBestMatch(
  extractedName: string,
  inventoryIngredients: Ingredient[],
  threshold: number = 0.7
): { match: Ingredient | null; confidence: number; needsConfirmation: boolean } {
  
  const normalizedExtracted = normalizeIngredientName(extractedName);
  
  let bestMatch: Ingredient | null = null;
  let bestScore = 0;

  for (const ingredient of inventoryIngredients) {
    const normalizedInventory = normalizeIngredientName(ingredient.name);
    
    // Exact match after normalization
    if (normalizedExtracted === normalizedInventory) {
      return {
        match: ingredient,
        confidence: 1.0,
        needsConfirmation: false
      };
    }

    // Check if one contains the other
    if (normalizedExtracted.includes(normalizedInventory) || 
        normalizedInventory.includes(normalizedExtracted)) {
      const score = 0.9;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = ingredient;
      }
    }

    // Calculate fuzzy match score
    const score = similarityScore(normalizedExtracted, normalizedInventory);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = ingredient;
    }
  }

  // Return result based on confidence threshold
  if (bestScore >= 0.9) {
    return {
      match: bestMatch,
      confidence: bestScore,
      needsConfirmation: false
    };
  } else if (bestScore >= threshold) {
    return {
      match: bestMatch,
      confidence: bestScore,
      needsConfirmation: true
    };
  } else {
    return {
      match: null,
      confidence: 0,
      needsConfirmation: true
    };
  }
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
      matchedIngredient: matchResult.match,
      confidence: matchResult.confidence,
      needsConfirmation: matchResult.needsConfirmation,
      isNewIngredient: matchResult.match === null
    };
  });
}
