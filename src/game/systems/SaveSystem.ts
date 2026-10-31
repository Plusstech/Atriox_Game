import {
  APOLLON_BLESSINGS,
  blessingDef,
  grantEligible,
  pickOffers,
  type ApollonBlessingId,
  type BlessingLevels,
  type SelunFeats
} from '../../data/selun';

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
  eternityBest: number;
  eternityLast: number;
  eternitySurvived: boolean;
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

/** Derrota para Sêlun aguardando a escolha da bênção (sobrevive a recarregar a página). */
export interface SelunPending {
  attemptId: string;
  /** morte elegível a nível permanente (>= 20 s ativos ou >= 1 quebra) */
  eligible: boolean;
  /** opções congeladas: recarregar reabre a MESMA escolha */
  options: ApollonBlessingId[];
  feats: SelunFeats;
  firstDefeat: boolean;
}

export interface SelunSave {
  schema: 1;
  blessings: BlessingLevels;
  records: { bestActiveMs: number; bestBreaks: number; bestRecompositions: number; bestPerfectDodges: number; bestPhase: number; defeats: number };
  seenIntro: boolean;
  /** tentativa aberta (encontro iniciado e ainda não resolvido) */
  attemptId: string | null;
  /** última tentativa que já recebeu prêmio (nunca concede duas vezes) */
  lastGrantedAttempt: string | null;
  pending: SelunPending | null;
  /** Brasa de Apollon para a próxima tentativa (não acumula) */
  ember: boolean;
  /** Provação da Eternidade liberada (vitória sobre Caim): o refúgio pode reabrir o Infinito */
  eternityUnlocked: boolean;
}

export interface SaveData {
  version: 1;
  settings: Settings;
  records: Records;
  unlocks: Unlocks;
  selun: SelunSave;
}

export function defaultSelun(): SelunSave {
  return {
    schema: 1,
    blessings: {},
    records: { bestActiveMs: 0, bestBreaks: 0, bestRecompositions: 0, bestPerfectDodges: 0, bestPhase: 0, defeats: 0 },
    seenIntro: false,
    attemptId: null,
    lastGrantedAttempt: null,
    pending: null,
    ember: false,
    eternityUnlocked: false
  };
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
    records: { eternityBest:0,eternityLast:0,eternitySurvived:false, attempts: 0, bossVictories: 0, highestWave: 0, bestTime: null },
    unlocks: { blessingOfGlory: false, caimDefeats: 0 },
    selun: defaultSelun()
  };
}

const num = (v: unknown, d: number, min = -Infinity, max = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

const IDS = new Set<string>(APOLLON_BLESSINGS.map((b) => b.id));
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 && v.length < 80 ? v : null);

/** Bloco do Sêlun: saves antigos (sem o bloco) recebem os padrões; IDs desconhecidos são descartados. */
function sanitizeSelun(raw: unknown): SelunSave {
  const d = defaultSelun();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const levels: BlessingLevels = {};
  const b = (r.blessings ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(b)) if (IDS.has(k)) levels[k as ApollonBlessingId] = Math.floor(num(v, 0, 0, blessingDef(k)!.max));
  const rec = (r.records ?? {}) as Record<string, unknown>;
  const feats = (x: unknown): SelunFeats => {
    const f = (x ?? {}) as Record<string, unknown>;
    return {
      activeMs: num(f.activeMs, 0, 0),
      breaks: Math.floor(num(f.breaks, 0, 0)),
      recompositions: Math.floor(num(f.recompositions, 0, 0)),
      perfectDodges: Math.floor(num(f.perfectDodges, 0, 0)),
      phase: Math.floor(num(f.phase, 1, 1, 3))
    };
  };
  let pending: SelunPending | null = null;
  const p = r.pending as Record<string, unknown> | null | undefined;
  if (p && typeof p === 'object' && str(p.attemptId)) {
    const options = (Array.isArray(p.options) ? p.options : [])
      .filter((o): o is ApollonBlessingId => typeof o === 'string' && IDS.has(o))
      .slice(0, 3);
    pending = { attemptId: str(p.attemptId)!, eligible: bool(p.eligible, false), options, feats: feats(p.feats), firstDefeat: bool(p.firstDefeat, false) };
  }
  return {
    schema: 1,
    blessings: levels,
    records: {
      bestActiveMs: num(rec.bestActiveMs, 0, 0),
      bestBreaks: Math.floor(num(rec.bestBreaks, 0, 0)),
      bestRecompositions: Math.floor(num(rec.bestRecompositions, 0, 0)),
      bestPerfectDodges: Math.floor(num(rec.bestPerfectDodges, 0, 0)),
      bestPhase: Math.floor(num(rec.bestPhase, 0, 0, 3)),
      defeats: Math.floor(num(rec.defeats, 0, 0))
    },
    seenIntro: bool(r.seenIntro, false),
    attemptId: str(r.attemptId),
    lastGrantedAttempt: str(r.lastGrantedAttempt),
    pending,
    ember: bool(r.ember, false),
    eternityUnlocked: bool(r.eternityUnlocked, false)
  };
}

/** Valida campo a campo; valores inválidos voltam ao padrão. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as { settings?: Record<string, unknown>; records?: Record<string, unknown>; unlocks?: Record<string, unknown>; selun?: unknown };
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
      eternityBest: Math.floor(num(rec.eternityBest,0,0)),
      eternityLast: Math.floor(num(rec.eternityLast,0,0)),
      eternitySurvived:bool(rec.eternitySurvived,false),
      attempts: Math.floor(num(rec.attempts, 0, 0)),
      bossVictories: Math.floor(num(rec.bossVictories, 0, 0)),
      highestWave: Math.floor(num(rec.highestWave, 0, 0)),
      bestTime: rec.bestTime === null || rec.bestTime === undefined ? null : num(rec.bestTime, 0, 0) || null
    },
    unlocks: {
      blessingOfGlory: bool(un.blessingOfGlory, false),
      caimDefeats: Math.floor(num(un.caimDefeats, 0, 0))
    },
    selun: migrateSelun(sanitizeSelun(r.selun), rec, un)
  };
}

/** Saves anteriores ao Sêlun: quem já venceu Caim ou entrou na Eternidade tem o Infinito liberado. */
function migrateSelun(sv: SelunSave, rec: Record<string, unknown>, un: Record<string, unknown>): SelunSave {
  if (!sv.eternityUnlocked && (num(rec.eternityBest, 0, 0) > 0 || bool(un.blessingOfGlory, false))) sv.eternityUnlocked = true;
  return sv;
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

  recordEternity(wave:number,survived:boolean):void {
    const r=this.data.records;r.eternityBest=Math.max(r.eternityBest,survived?wave:Math.max(0,wave-1));r.eternityLast=wave;r.eternitySurvived=survived;this.save();
  }

  // ---------------------------------------------------------------- Sêlun / Apollon

  /** Abre uma tentativa (início do encontro). Identificador único por tentativa. */
  selunBeginAttempt(rng: () => number = Math.random): string {
    const id = 't' + Date.now().toString(36) + Math.floor(rng() * 1e9).toString(36);
    this.data.selun.attemptId = id;
    this.save();
    return id;
  }

  selunSeenIntro(): void {
    if (this.data.selun.seenIntro) return;
    this.data.selun.seenIntro = true;
    this.save();
  }

  unlockEternity(): void {
    if (this.data.selun.eternityUnlocked) return;
    this.data.selun.eternityUnlocked = true;
    this.save();
  }

  /**
   * Morte real dentro do encontro ativo. Idempotente: repetir o callback da mesma
   * morte devolve a mesma etapa pendente; tentativa já premiada ou sem encontro
   * aberto não gera nada. Recordes e etapa pendente são gravados juntos.
   */
  selunRecordDeath(attemptId: string, feats: SelunFeats, rng: () => number = Math.random): SelunPending | null {
    const sv = this.data.selun;
    if (sv.pending) return sv.pending.attemptId === attemptId ? sv.pending : null;
    if (!attemptId || sv.attemptId !== attemptId || sv.lastGrantedAttempt === attemptId) return null;
    const eligible = grantEligible(feats);
    const firstDefeat = sv.records.defeats === 0;
    const options = eligible ? pickOffers(sv.blessings, firstDefeat, rng) : [];
    const rec = sv.records;
    rec.defeats++;
    rec.bestActiveMs = Math.max(rec.bestActiveMs, feats.activeMs);
    rec.bestBreaks = Math.max(rec.bestBreaks, feats.breaks);
    rec.bestRecompositions = Math.max(rec.bestRecompositions, feats.recompositions);
    rec.bestPerfectDodges = Math.max(rec.bestPerfectDodges, feats.perfectDodges);
    rec.bestPhase = Math.max(rec.bestPhase, feats.phase);
    sv.pending = { attemptId, eligible, options, feats: { ...feats }, firstDefeat };
    sv.attemptId = null;
    this.save();
    return sv.pending;
  }

  /**
   * Conclui a ressurreição: concede UM prêmio (nível escolhido OU Brasa) e fecha a
   * etapa pendente na mesma gravação. Chamar de novo não concede nada.
   */
  selunConfirm(choice?: ApollonBlessingId): { kind: 'blessing'; id: ApollonBlessingId; level: number } | { kind: 'ember'; complete: boolean } | null {
    const sv = this.data.selun;
    const p = sv.pending;
    if (!p) return null;
    let out: { kind: 'blessing'; id: ApollonBlessingId; level: number } | { kind: 'ember'; complete: boolean };
    if (p.eligible && p.options.length) {
      const id = choice && p.options.includes(choice) ? choice : p.options[0];
      const def = blessingDef(id)!;
      const level = Math.min(def.max, (sv.blessings[id] ?? 0) + 1);
      sv.blessings[id] = level;
      out = { kind: 'blessing', id, level };
    } else {
      sv.ember = true;
      out = { kind: 'ember', complete: p.eligible };
    }
    sv.lastGrantedAttempt = p.attemptId;
    sv.pending = null;
    this.save();
    return out;
  }

  /** Brasa vale para a próxima tentativa e é consumida ao começar (não acumula). */
  consumeEmber(): boolean {
    const had = this.data.selun.ember;
    if (had) {
      this.data.selun.ember = false;
      this.save();
    }
    return had;
  }

  reset(): void {
    this.data = defaultSave();
    this.save();
  }
}
