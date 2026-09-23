import { z } from 'zod';

/** Validation aux frontières. La même règle sert au formulaire et à la route. */
export const loginSchema = z.object({
  username: z.string().min(1, 'Identifiant requis').max(64),
  password: z.string().min(1, 'Mot de passe requis').max(256),
});

export type LoginValues = z.infer<typeof loginSchema>;
