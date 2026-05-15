// Default app currency
export const DEFAULT_CURRENCY = 'RON';

const KNOWN_CURRENCIES = new Set([
  'RON', 'EUR', 'USD', 'GBP', 'MDL', 'CHF', 'PLN', 'HUF', 'BGN', 'CZK',
]);

export function normalizeCurrency(input?: string | null): string {
  if (!input) return DEFAULT_CURRENCY;
  const v = input.trim().toUpperCase();
  if (v === 'LEI') return 'RON';
  if (v === '€') return 'EUR';
  if (v === '$') return 'USD';
  if (v === '£') return 'GBP';
  return KNOWN_CURRENCIES.has(v) ? v : DEFAULT_CURRENCY;
}

/** Format a numeric amount with its currency, e.g. "1.250,00 RON". */
export function formatMoney(
  amount: number | null | undefined,
  currency: string = DEFAULT_CURRENCY,
  opts: { maximumFractionDigits?: number; minimumFractionDigits?: number } = {}
): string {
  const value = Number.isFinite(amount as number) ? (amount as number) : 0;
  const cur = normalizeCurrency(currency);
  try {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: opts.minimumFractionDigits ?? 2,
      maximumFractionDigits: opts.maximumFractionDigits ?? 2,
      currencyDisplay: 'code',
    }).format(value);
  } catch {
    return `${value.toFixed(opts.maximumFractionDigits ?? 2)} ${cur}`;
  }
}

/** Format a per-unit price like "12,50 RON/kg". */
export function formatUnitPrice(
  amount: number | null | undefined,
  unit: string,
  currency: string = DEFAULT_CURRENCY
): string {
  return `${formatMoney(amount, currency)}/${unit}`;
}
