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
