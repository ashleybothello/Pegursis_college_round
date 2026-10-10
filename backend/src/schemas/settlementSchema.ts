import { z } from 'zod';

export const settlementInputSchema = z.object({
  grossAmount: z
    .number({
      required_error: 'grossAmount is required',
      invalid_type_error: 'grossAmount must be an integer representing minor units (e.g. cents)',
    })
    .int('grossAmount must be an integer (minor currency units)')
    .positive('grossAmount must be greater than 0'),
  feeBasisPoints: z
    .number()
    .int('feeBasisPoints must be an integer')
    .min(0, 'feeBasisPoints cannot be negative')
    .max(10000, 'feeBasisPoints cannot exceed 10000 (100%)')
    .optional()
    .default(250), // Default 2.50%
  fixedFeeMinorUnits: z
    .number()
    .int('fixedFeeMinorUnits must be an integer')
    .min(0, 'fixedFeeMinorUnits cannot be negative')
    .optional()
    .default(30), // Default $0.30
  currency: z
    .string()
    .min(3, 'currency code must be 3 characters')
    .max(3, 'currency code must be 3 characters')
    .toUpperCase()
    .optional()
    .default('USD'),
});

export type SettlementInputDto = z.infer<typeof settlementInputSchema>;
