import { z } from 'zod';
import { creditInputSchema } from './creditSchema.js';

export const verificationSubmissionSchema = creditInputSchema.extend({
  salt: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'salt must be a 32-byte hex string (0x prefix followed by 64 hex characters)')
    .optional(),
});

export type VerificationSubmissionDto = z.infer<typeof verificationSubmissionSchema>;
