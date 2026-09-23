import { expect, test } from '@playwright/test';

test("la sonde de santé répond et décrit la source matérielle", async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.status).toBe('ok');
  // `fresh` peut être faux sans matériel branché — ce qui compte est que le
  // champ existe : l'absence de source doit être visible, pas silencieuse.
  expect(body.source).toHaveProperty('fresh');
});

test("la page d'accueil affiche l'état de la source", async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Source matérielle')).toBeVisible();
});
