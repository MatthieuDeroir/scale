import { describe, expect, it, vi } from 'vitest';
import {
  backoffDelay,
  createOnceLogger,
  extractFrames,
  validateFrame,
} from '../transport/frame-codec.mjs';

const PROTOCOL = { startByte: 0xf8, endByte: 0x0d, frameSize: 8 };

function frame(overrides = {}) {
  const bytes = new Uint8Array(PROTOCOL.frameSize).fill(0x20);
  bytes[0] = PROTOCOL.startByte;
  bytes[PROTOCOL.frameSize - 1] = PROTOCOL.endByte;
  for (const [offset, value] of Object.entries(overrides)) bytes[Number(offset)] = value;
  return bytes;
}

function collect(buffer) {
  const frames = [];
  const rest = extractFrames(buffer, PROTOCOL, (f) => frames.push(f));
  return { frames, rest };
}

describe('validateFrame', () => {
  it('accepte une trame conforme', () => {
    expect(validateFrame(frame(), PROTOCOL)).toBeNull();
  });

  it('rejette une mauvaise taille, un mauvais début, un mauvais terminateur', () => {
    expect(validateFrame(new Uint8Array(4), PROTOCOL)).toBe('size');
    expect(validateFrame(frame({ 0: 0x00 }), PROTOCOL)).toBe('start');
    expect(validateFrame(frame({ 7: 0x00 }), PROTOCOL)).toBe('end');
  });

  it('ignore le terminateur quand le protocole n’en déclare pas', () => {
    const sansFin = { startByte: 0xf8, frameSize: 8 };
    expect(validateFrame(frame({ 7: 0x99 }), sansFin)).toBeNull();
  });
});

describe('extractFrames', () => {
  it('extrait une trame complète et ne laisse rien', () => {
    const { frames, rest } = collect(frame({ 1: 0x33 }));
    expect(frames).toHaveLength(1);
    expect(frames[0][1]).toBe(0x33);
    expect(rest).toHaveLength(0);
  });

  it('extrait deux trames concaténées', () => {
    const buffer = new Uint8Array([...frame({ 1: 0x33 }), ...frame({ 1: 0x40 })]);
    const { frames } = collect(buffer);
    expect(frames.map((f) => f[1])).toEqual([0x33, 0x40]);
  });

  it('ignore le bruit avant l’octet de synchronisation', () => {
    const buffer = new Uint8Array([0x01, 0x02, 0x03, ...frame({ 1: 0x33 })]);
    const { frames } = collect(buffer);
    expect(frames).toHaveLength(1);
  });

  it('conserve un reliquat incomplet pour le prochain fragment', () => {
    const complete = frame({ 1: 0x33 });
    const { frames, rest } = collect(complete.subarray(0, 5));
    expect(frames).toHaveLength(0);
    expect(rest).toHaveLength(5);
  });

  it('resynchronise sur une trame tronquée au lieu de la livrer', () => {
    // Terminateur faux : le lecteur historique du G552 aurait livré la trame.
    const corrompue = frame({ 7: 0x00 });
    const buffer = new Uint8Array([...corrompue, ...frame({ 1: 0x40 })]);
    const { frames } = collect(buffer);
    expect(frames).toHaveLength(1);
    expect(frames[0][1]).toBe(0x40);
  });

  it('ne livre jamais une trame dont le terminateur est faux', () => {
    const { frames } = collect(frame({ 7: 0x00 }));
    expect(frames).toHaveLength(0);
  });
});

describe('createOnceLogger', () => {
  it('n’écrit qu’au changement de message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createOnceLogger('[T]');
    log('a');
    log('a');
    log('a');
    const apresRepetitions = spy.mock.calls.length;
    log('b');
    expect(apresRepetitions).toBe(2); // message + mention des répétitions
    expect(spy.mock.calls.length).toBe(4);
    spy.mockRestore();
  });
});

describe('backoffDelay', () => {
  it('croît puis plafonne', () => {
    expect(backoffDelay(0)).toBe(2000);
    expect(backoffDelay(3)).toBe(16000);
    expect(backoffDelay(20)).toBe(60000);
  });
});
