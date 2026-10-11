import { z } from 'zod';

export const fraudInputSchema = z.object({
  transactionAmount: z
    .number({
      required_error: 'transactionAmount is required',
      invalid_type_error: 'transactionAmount must be a number',
    })
    .positive('transactionAmount must be greater than 0'),
  userAverageAmount: z
    .number()
    .nonnegative('userAverageAmount cannot be negative')
    .optional(),
  userTransactionsLastHour: z
    .number()
    .int('userTransactionsLastHour must be an integer')
    .nonnegative('userTransactionsLastHour cannot be negative')
    .optional(),
  isNewDevice: z.boolean().optional(),
  locationMismatch: z.boolean().optional(),
  transactionHourUtc: z
    .number()
    .int('transactionHourUtc must be an integer')
    .min(0, 'transactionHourUtc must be between 0 and 23')
    .max(23, 'transactionHourUtc must be between 0 and 23')
    .optional(),
  rapidCrossBorderTransfers: z.boolean().optional(),
});

export type FraudInputDto = z.infer<typeof fraudInputSchema>;
