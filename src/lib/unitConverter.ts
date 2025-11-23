export const normalizeToBaseUnit = (quantity: number, unit: string): { value: number; baseUnit: string } => {
  const lowerUnit = unit.toLowerCase();

  if (lowerUnit === 'l' || lowerUnit === 'liters' || lowerUnit === 'liter') {
    return { value: quantity * 1000, baseUnit: 'ml' };
  }

  if (lowerUnit === 'ml' || lowerUnit === 'milliliters' || lowerUnit === 'milliliter') {
    return { value: quantity, baseUnit: 'ml' };
  }

  if (lowerUnit === 'kg' || lowerUnit === 'kilograms' || lowerUnit === 'kilogram') {
    return { value: quantity * 1000, baseUnit: 'g' };
  }

  if (lowerUnit === 'g' || lowerUnit === 'grams' || lowerUnit === 'gram') {
    return { value: quantity, baseUnit: 'g' };
  }

  return { value: quantity, baseUnit: unit };
};

export const compareQuantities = (
  required: number,
  requiredUnit: string,
  available: number,
  availableUnit: string
): { hasEnough: boolean; requiredNormalized: number; availableNormalized: number; baseUnit: string } => {
  const normalizedRequired = normalizeToBaseUnit(required, requiredUnit);
  const normalizedAvailable = normalizeToBaseUnit(available, availableUnit);

  if (normalizedRequired.baseUnit !== normalizedAvailable.baseUnit) {
    return {
      hasEnough: false,
      requiredNormalized: required,
      availableNormalized: available,
      baseUnit: requiredUnit
    };
  }

  return {
    hasEnough: normalizedAvailable.value >= normalizedRequired.value,
    requiredNormalized: normalizedRequired.value,
    availableNormalized: normalizedAvailable.value,
    baseUnit: normalizedRequired.baseUnit
  };
};

export const formatQuantity = (value: number, unit: string): string => {
  const lowerUnit = unit.toLowerCase();

  if (lowerUnit === 'ml') {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} L`;
    }
    return `${value} ml`;
  }

  if (lowerUnit === 'g') {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} kg`;
    }
    return `${value} g`;
  }

  return `${value} ${unit}`;
};

/**
 * Calculate the cost of an ingredient based on quantity used and price per unit
 * Handles unit conversions (e.g., recipe uses 200g, inventory is priced per kg)
 */
export const calculateIngredientCost = (
  quantityUsed: number,
  unitUsed: string,
  pricePerUnit: number,
  priceUnit: string
): number => {
  // Normalize both quantities to base units
  const normalizedUsed = normalizeToBaseUnit(quantityUsed, unitUsed);
  const normalizedPrice = normalizeToBaseUnit(1, priceUnit);

  // If units are incompatible, return 0 (should not happen with proper validation)
  if (normalizedUsed.baseUnit !== normalizedPrice.baseUnit) {
    console.warn(`Unit mismatch: ${unitUsed} vs ${priceUnit}`);
    return 0;
  }

  // Calculate cost: (quantity_used / unit_conversion) * price_per_unit
  const cost = (normalizedUsed.value / normalizedPrice.value) * pricePerUnit;
  
  return Math.round(cost * 100) / 100; // Round to 2 decimals
};

/**
 * Format price display: "4.50 lei/kg" or "1.50 lei/buc"
 */
export const formatPrice = (price: number, unit: string): string => {
  return `${price.toFixed(2)} lei/${unit}`;
};
