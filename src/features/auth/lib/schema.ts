import { z } from 'zod';

/** Validation aux frontières. La même règle sert au formulaire et à la route. */
export const loginSchema = z.object({
  username: z.string().min(1, 'Identifiant requis').max(64),
  password: z.string().min(1, 'Mot de passe requis').max(256),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const PASSWORD_MIN_LENGTH = 12;

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'Mot de passe actuel requis').max(256),
    next: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Au moins ${PASSWORD_MIN_LENGTH} caractères`)
      .max(256),
    confirm: z.string(),
  })
  .refine((values) => values.next === values.confirm, {
    message: 'Les deux saisies ne correspondent pas',
    path: ['confirm'],
  })
  .refine((values) => values.next !== values.current, {
    message: "Le nouveau mot de passe doit être différent de l'actuel",
    path: ['next'],
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
