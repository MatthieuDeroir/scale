import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { activeCapabilityIds } from '../src/.generated/capabilities';
import { hashPassword } from '../src/features/auth/lib/login';

const prisma = new PrismaClient();

/**
 * Le compte initial ne porte JAMAIS un mot de passe en dur. Il est tiré au
 * sort, affiché une seule fois, et doit être changé. Un identifiant par défaut
 * partagé sur tout un parc est le constat qui revient dans chaque audit — il ne
 * doit pas naître dans le socle.
 */
async function main() {
  if (!(activeCapabilityIds as readonly string[]).includes('auth')) {
    console.log('[Seed] fonctionnalité auth inactive : aucun compte à créer.');
    return;
  }

  if ((await prisma.user.count()) > 0) {
    console.log('[Seed] Comptes déjà présents, rien à faire.');
    return;
  }

  const password = randomBytes(12).toString('base64url');
  await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
      mustChangePassword: true,
    },
  });

  console.log('─'.repeat(60));
  console.log('  Compte administrateur initial');
  console.log('  identifiant  : admin');
  console.log(`  mot de passe : ${password}`);
  console.log('  À changer à la première connexion. Non réaffiché.');
  console.log('─'.repeat(60));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
