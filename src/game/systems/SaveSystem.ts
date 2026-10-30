/**
 * Persistência local (localStorage). Trata ausência, bloqueio (modo privado)
 * e dados corrompidos sem quebrar o jogo: sempre devolve um SaveData válido.
 */
export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  reduceShake: boolean;
  reduceFlash: boolean;
  damageNumbers: boolean;
  /** 'high' = todas as partículas; 'low' = menos partículas e brilhos */
  graphics: 'high' | 'low';
}

export interface Records {
  attempts: number;
  bossVictories: number;
  highestWave: number;
  /** melhor tempo de vitória em ms (null = nunca venceu) */
  bestTime: number | null;
}

export interface Unlocks {
  /** Bênção da Glória (recompensa final, concedida uma única vez) */
  blessingOfGlory: boolean;
  caimDefeats: number;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  records: Records;
  unlocks: Unlocks;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'atriox-cinder.save.v1';

export function defaultSave(): SaveData {
  return {
    version: 1,
    settings: {
      masterVolume: 0.8,
      musicVolume: 0.5,
      sfxVolume: 0.9,
      reduceShake: false,
      reduceFlash: false,
      damageNumbers: true,
      graphics: 'high'
    },
    records: { attempts: 0, bossVictories: 0, highestWave: 0, bestTime: null },
    unlocks: { blessingOfGlory: false, caimDefeats: 0 }
  };
}

const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

/** Valida campo a campo; valores inválidos voltam ao padrão. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as { settings?: Record<string, unknown>; records?: Record<string, unknown>; unlocks?: Record<string, unknown> };
  const s = r.settings ?? {};
  const rec = r.records ?? {};
  const un = r.unlocks ?? {};
  return {
    version: 1,
    settings: {
      masterVolume: num(s.masterVolume, d.settings.masterVolume, 0, 1),
      musicVolume: num(s.musicVolume, d.settings.musicVolume, 0, 1),
      sfxVolume: num(s.sfxVolume, d.settings.sfxVolume, 0, 1),
      reduceShake: bool(s.reduceShake, d.settings.reduceShake),
      reduceFlash: bool(s.reduceFlash, d.settings.reduceFlash),
      damageNumbers: bool(s.damageNumbers, d.settings.damageNumbers),
      graphics: s.graphics === 'low' ? 'low' : 'high'
    },
    records: {
      attempts: Math.floor(num(rec.attempts, 0, 0)),
      bossVictories: Math.floor(num(rec.bossVictories, 0, 0)),
      highestWave: Math.floor(num(rec.highestWave, 0, 0)),
      bestTime: rec.bestTime === null || rec.bestTime === undefined ? null : num(rec.bestTime, 0, 0) || null
    },
    unlocks: {
      blessingOfGlory: bool(un.blessingOfGlory, false),
      caimDefeats: Math.floor(num(un.caimDefeats, 0, 0))
    }
  };
}

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k)
  };
}

function detectStorage(): StorageLike {
  try {
    const ls = globalThis.localStorage;
    const probe = '__atriox_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage();
  }
}

export class SaveSystem {
  data: SaveData;
  /** true se o armazenamento persistente não está disponível */
  readonly volatile: boolean;
  lastError: string | null = null;
  private readonly storage: StorageLike;

  constructor(storage?: StorageLike) {
    this.storage = storage ?? detectStorage();
    this.volatile = !storage && !(this.storage === globalThis.localStorage);
    this.data = this.load();
  }

  load(): SaveData {
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      return sanitize(JSON.parse(raw));
    } catch (e) {
      this.lastError = `Save corrompido descartado: ${(e as Error).message}`;
      return defaultSave();
    }
  }

  save(): boolean {
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch (e) {
      this.lastError = `Falha ao salvar: ${(e as Error).message}`;
      return false;
    }
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = sanitize({ ...this.data, settings: { ...this.data.settings, ...patch } }).settings;
    this.save();
  }

  recordAttempt(): void {
    this.data.records.attempts++;
    this.save();
  }

  recordRun(result: { victory: boolean; timeMs: number; highestWave: number }): { newBest: boolean } {
    const r = this.data.records;
    r.highestWave = Math.max(r.highestWave, result.highestWave);
    let newBest = false;
    if (result.victory) {
      r.bossVictories++;
      if (r.bestTime === null || result.timeMs < r.bestTime) {
        r.bestTime = Math.round(result.timeMs);
        newBest = true;
      }
    }
    this.save();
    return { newBest };
  }

  /** Concede a Bênção da Glória. Retorna false se já estava concedida (nunca duplica). */
  grantBlessingOfGlory(): boolean {
    this.data.unlocks.caimDefeats++;
    const fresh = !this.data.unlocks.blessingOfGlory;
    this.data.unlocks.blessingOfGlory = true;
    this.save();
    return fresh;
  }

  reset(): void {
    this.data = defaultSave();
    this.save();
  }
}
