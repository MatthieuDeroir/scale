#!/usr/bin/env node
import { randomBytes } from 'node:crypto';

const secret = randomBytes(48).toString('base64url');
console.log(secret);
console.error('\nÀ coller dans .env sous JWT_SECRET. Ne jamais commiter.');
