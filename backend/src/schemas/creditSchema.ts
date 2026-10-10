import { z } from 'zod';

export const creditInputSchema = z.object({
  incomeIndex: z
    .number({
      required_error: 'incomeIndex is required',
      invalid_type_error: 'incomeIndex must be a number',
    })
    .int('incomeIndex must be an integer')
    .min(0, 'incomeIndex must be between 0 and 100')
    .max(100, 'incomeIndex must be between 0 and 100'),
  repaymentIndex: z
    .number({
      required_error: 'repaymentIndex is required',
      invalid_type_error: 'repaymentIndex must be a number',
    })
    .int('repaymentIndex must be an integer')
    .min(0, 'repaymentIndex must be between 0 and 100')
    .max(100, 'repaymentIndex must be between 0 and 100'),
  historyIndex: z
    .number({
      required_error: 'historyIndex is required',
      invalid_type_error: 'historyIndex must be a number',
    })
    .int('historyIndex must be an integer')
    .min(0, 'historyIndex must be between 0 and 100')
    .max(100, 'historyIndex must be between 0 and 100'),
});

export type CreditInputDto = z.infer<typeof creditInputSchema>;
