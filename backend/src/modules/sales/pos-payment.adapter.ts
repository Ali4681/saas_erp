/** Manual POS tender adapter — card/network charge is not wired yet. */

export type PosPaymentChargeInput = {
  companyId: string;
  amount: number;
  currency?: string;
  reference?: string;
};

export const posPaymentAdapter = {
  provider: 'manual' as const,
  charge(_input: PosPaymentChargeInput): never {
    throw new Error('POS payment provider not configured');
  },
};

export const POS_PAYMENT_PROVIDER_BOOTSTRAP = {
  mode: 'manual' as const,
  message: 'Card/network charge is not configured; use manual tender split.',
};
