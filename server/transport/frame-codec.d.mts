export interface FrameProtocol {
  startByte: number;
  frameSize: number;
  endByte?: number;
}

export function validateFrame(
  frame: Uint8Array,
  protocol: FrameProtocol
): null | 'size' | 'start' | 'end';

export function extractFrames(
  buffer: Uint8Array,
  protocol: FrameProtocol,
  onFrame: (frame: Uint8Array) => void
): Uint8Array;

export function createOnceLogger(prefix: string): (message: string, level?: 'error' | 'warn') => void;
export function backoffDelay(attempt: number, baseMs?: number, maxMs?: number): number;
