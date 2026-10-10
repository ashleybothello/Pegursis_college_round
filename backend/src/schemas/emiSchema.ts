import { z } from 'zod';

export const emiInputSchema = z.object({
  principal: z
    .number({
      required_error: 'principal is required',
      invalid_type_error: 'principal must be a number',
    })
    .positive('principal must be greater than 0')
    .finite('principal must be finite'),
  annualInterestRate: z
    .number({
      required_error: 'annualInterestRate is required',
      invalid_type_error: 'annualInterestRate must be a number',
    })
    .min(0, 'annualInterestRate cannot be negative')
    .max(100, 'annualInterestRate cannot exceed 100%')
    .finite('annualInterestRate must be finite'),
  tenureMonths: z
    .number({
      required_error: 'tenureMonths is required',
      invalid_type_error: 'tenureMonths must be a number',
    })
    .int('tenureMonths must be an integer')
    .min(1, 'tenureMonths must be at least 1 month')
    .max(480, 'tenureMonths cannot exceed 480 months (40 years)'),
});

export type EmiInputDto = z.infer<typeof emiInputSchema>;
