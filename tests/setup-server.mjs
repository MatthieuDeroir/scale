/**
 * Environnement minimal des suites serveur. `config.mjs` refuse de démarrer
 * sans secret — c'est voulu, et les tests doivent en fournir un plutôt que
 * d'assouplir le garde-fou.
 */
process.env.JWT_SECRET ??= 'secret-de-test-suffisamment-long-pour-passer-la-validation';
process.env.SERIAL_PATH ??= '/dev/faux';
process.env.SERIAL_BAUD_RATE ??= '38400';
