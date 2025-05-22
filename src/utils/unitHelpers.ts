import { Unit } from '../types';

// Define broad measurement kinds for grouping units
export type MeasureKind = 'weight' | 'volume' | 'count';

// Very light-weight categorisation helper. Extend as needed.
export const unitKind = (unit: Unit | null | undefined): MeasureKind | null => {
  if (!unit) return null;

  // Prefer the measurement_type column coming from DB, if present
  const mType = (unit as any).measurement_type as string | undefined;

  return mType as MeasureKind;
  
};

// Simple conversion factors to a base unit (grams for weight, millilitres for volume)
const WEIGHT_FACTORS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
};

const VOLUME_FACTORS: Record<string, number> = {
  ml: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  litre: 1000,
  litres: 1000,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  cup: 236.588,
  cups: 236.588,
  pt: 473.176,
  pint: 473.176,
  pints: 473.176,
  qt: 946.353,
  quart: 946.353,
  quarts: 946.353,
  gal: 3785.41,
  gallon: 3785.41,
  gallons: 3785.41,
  "fl oz": 29.5735,
  floz: 29.5735,
  "fluid ounce": 29.5735,
  "fluid ounces": 29.5735,
};

/**
 * Convert an amount between two units of the same measurement kind.
 * If units are incompatible or missing a factor, the original amount is returned.
 */
export const convertAmount = (
  amount: number,
  fromUnitRaw: string | undefined,
  toUnitRaw: string | undefined,
): number => {
  if (!fromUnitRaw || !toUnitRaw || fromUnitRaw.toLowerCase() === toUnitRaw.toLowerCase()) {
    return amount;
  }

  const from = fromUnitRaw.toLowerCase();
  const to = toUnitRaw.toLowerCase();

  // Decide which map to use based on presence in maps
  if (WEIGHT_FACTORS[from] !== undefined && WEIGHT_FACTORS[to] !== undefined) {
    const base = amount * WEIGHT_FACTORS[from];
    return base / WEIGHT_FACTORS[to];
  }

  if (VOLUME_FACTORS[from] !== undefined && VOLUME_FACTORS[to] !== undefined) {
    const base = amount * VOLUME_FACTORS[from];
    return base / VOLUME_FACTORS[to];
  }

  // count or unsupported -> no conversion
  return amount;
};

// ---------------- Normalization Helper -----------------

/**
 * Given an amount and unit abbreviation, return a more readable pair by
 * scaling up or down within the same measurement system (metric/imperial).
 * Logic mirrors the thresholds used in formatQuantityAuto, but returns raw
 * numeric amount + unit string so callers can store / display with the
 * updated base unit.
 */
export const normalizeAmountAndUnit = (
  amount: number,
  unitAbbr: string | undefined | null,
): { amount: number; unitAbbr: string } => {
  if (amount === null || amount === undefined || !unitAbbr) {
    return { amount, unitAbbr: unitAbbr || '' } as any;
  }

  const lower = unitAbbr.toLowerCase();

  const epsilon = 1e-9;

  // Weight – metric vs imperial handled by the existing threshold pairs
  if (['g', 'gram', 'grams'].includes(lower)) {
    if (amount >= 1000 - epsilon) {
      return { amount: amount / 1000, unitAbbr: 'kg' };
    }
  } else if (['kg', 'kilogram', 'kilograms'].includes(lower)) {
    if (amount < 1 - epsilon) {
      return { amount: amount * 1000, unitAbbr: 'g' };
    }
  } else if (['oz', 'ounce', 'ounces'].includes(lower)) {
    if (amount >= 16 - epsilon) {
      return { amount: amount / 16, unitAbbr: 'lb' };
    }
  } else if (['lb', 'lbs', 'pound', 'pounds'].includes(lower)) {
    if (amount < 1 - epsilon) {
      return { amount: amount * 16, unitAbbr: 'oz' };
    }
  } else if (['ml', 'millilitre', 'millilitres'].includes(lower)) {
    if (amount >= 1000 - epsilon) {
      return { amount: amount / 1000, unitAbbr: 'l' };
    }
  } else if (['l', 'litre', 'litres'].includes(lower)) {
    if (amount < 1 - epsilon) {
      return { amount: amount * 1000, unitAbbr: 'ml' };
    }
  } else if (['fl oz', 'floz', 'fluid ounce', 'fluid ounces'].includes(lower)) {
    if (amount >= 128 - epsilon) {
      return { amount: amount / 128, unitAbbr: 'gal' };
    }
  } else if (['gal', 'gallon', 'gallons'].includes(lower)) {
    if (amount < 1 - epsilon) {
      return { amount: amount * 128, unitAbbr: 'fl oz' };
    }
  }

  // No change needed
  return { amount, unitAbbr };
};
