/** Geometria pura (sem Phaser) usada por hitboxes, IA e testes. */
export interface Vec {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function normalize(x: number, y: number): Vec {
  const l = length(x, y);
  if (l < 1e-6) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

export function distance(a: Vec, b: Vec): number {
  return length(b.x - a.x, b.y - a.y);
}

/** Menor diferença angular assinada (-PI..PI). */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

export type Shape =
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'sector'; x: number; y: number; radius: number; angle: number; halfArc: number }
  | { kind: 'ring'; x: number; y: number; inner: number; outer: number }
  /** retângulo orientado começando em (x,y) e avançando `length` na direção `angle` */
  | { kind: 'rect'; x: number; y: number; angle: number; length: number; width: number };

/** Testa se a forma intersecta um círculo (hurtbox). */
export function shapeHitsCircle(shape: Shape, cx: number, cy: number, r: number): boolean {
  const dx = cx - shape.x;
  const dy = cy - shape.y;
  const dist = length(dx, dy);
  switch (shape.kind) {
    case 'circle':
      return dist <= shape.radius + r;
    case 'ring':
      return dist >= shape.inner - r && dist <= shape.outer + r;
    case 'sector': {
      if (dist > shape.radius + r) return false;
      if (dist <= r) return true;
      const ang = Math.atan2(dy, dx);
      const tolerance = Math.asin(Math.min(1, r / dist));
      return Math.abs(angleDiff(shape.angle, ang)) <= shape.halfArc + tolerance;
    }
    case 'rect': {
      const ux = Math.cos(shape.angle);
      const uy = Math.sin(shape.angle);
      const along = dx * ux + dy * uy;
      const across = -dx * uy + dy * ux;
      return along >= -r && along <= shape.length + r && Math.abs(across) <= shape.width / 2 + r;
    }
  }
}

/** Ponto dentro de retângulo alinhado aos eixos. */
export function pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}
