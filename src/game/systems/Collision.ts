import { clamp, length } from '../combat/geometry';

export interface CircleObstacle {
  x: number;
  y: number;
  r: number;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolve a posição de um corpo circular contra os limites da arena e
 * obstáculos circulares (pilares, braseiros). Sem física genérica: previsível e barato.
 */
export function resolveCircle(
  px: number,
  py: number,
  r: number,
  bounds: Bounds,
  obstacles: readonly CircleObstacle[]
): { x: number; y: number; blocked: boolean } {
  let x = px;
  let y = py;
  let blocked = false;
  for (let pass = 0; pass < 2; pass++) {
    for (const o of obstacles) {
      const dx = x - o.x;
      const dy = y - o.y;
      const d = length(dx, dy);
      const min = o.r + r;
      if (d < min) {
        blocked = true;
        if (d < 1e-4) {
          x = o.x + min;
        } else {
          x = o.x + (dx / d) * min;
          y = o.y + (dy / d) * min;
        }
      }
    }
  }
  const cx = clamp(x, bounds.x + r, bounds.x + bounds.w - r);
  const cy = clamp(y, bounds.y + r, bounds.y + bounds.h - r);
  if (cx !== x || cy !== y) blocked = true;
  return { x: cx, y: cy, blocked };
}

/** Teste rápido de ponto contra obstáculos/limites (projéteis). */
export function pointBlocked(px: number, py: number, bounds: Bounds, obstacles: readonly CircleObstacle[]): boolean {
  if (px < bounds.x || px > bounds.x + bounds.w || py < bounds.y - 40 || py > bounds.y + bounds.h) return true;
  for (const o of obstacles) if (length(px - o.x, py - o.y) < o.r) return true;
  return false;
}
