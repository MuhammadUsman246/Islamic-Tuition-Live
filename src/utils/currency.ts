import { AllowedCurrency } from '../types';

export const ALLOWED_CURRENCIES: { code: AllowedCurrency; symbol: string; label: string }[] = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
  { code: 'PKR', symbol: 'Rs', label: 'PKR (Rs)' },
];

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  CAD: 'C$',
  GBP: '£',
  PKR: 'Rs',
  EUR: '€',
  AUD: 'A$'
};

export function getCurrencySymbol(curr?: string): string {
  if (!curr) return '$';
  return CURRENCY_SYMBOLS[curr] || '$';
}

export function formatFeeAmount(amount: number, curr?: string): string {
  const sym = getCurrencySymbol(curr);
  return `${sym}${amount.toLocaleString()}`;
}
