import { length, normalize, type Vec } from '../combat/geometry';

export interface MovementParams {
  maxSpeed: number;
  /** px/s² ao acelerar na direção do input */
  accel: number;
  /** px/s² ao parar (sem input) */
  decel: number;
}

/**
 * Integra a velocidade em direção ao input normalizado.
 * Diagonais são normalizadas: |v| nunca passa de maxSpeed.
 */
export function stepVelocity(vel: Vec, input: Vec, p: MovementParams, dtMs: number): Vec {
  const dt = dtMs / 1000;
  const dir = normalize(input.x, input.y);
  const hasInput = dir.x !== 0 || dir.y !== 0;
  const target = { x: dir.x * p.maxSpeed, y: dir.y * p.maxSpeed };
  const rate = (hasInput ? p.accel : p.decel) * dt;

  const dx = target.x - vel.x;
  const dy = target.y - vel.y;
  const d = length(dx, dy);
  if (d <= rate || d < 1e-6) return target;
  return { x: vel.x + (dx / d) * rate, y: vel.y + (dy / d) * rate };
}

/** Lê um vetor de input a partir de 4 direções booleanas. */
export function inputVector(left: boolean, right: boolean, up: boolean, down: boolean): Vec {
  return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
}
