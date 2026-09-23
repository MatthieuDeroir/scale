import { PrismaClient } from '@prisma/client';

/**
 * Instance Prisma unique.
 *
 * Une route qui fait `new PrismaClient()` ouvre son propre pool : sur une
 * machine embarquée, quelques routes suffisent à épuiser les connexions.
 * Et un client créé dans le module d'une route est intestable — on ne peut
 * plus le pointer vers une base de test.
 *
 * En développement, l'instance survit au rechargement à chaud.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
