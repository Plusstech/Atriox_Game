import type { SpawnGroup, WaveDef } from '../../data/waves';

export type RunPhase =
  | 'tutorial'
  | 'wave'
  | 'waveCleared'
  | 'reward'
  | 'bossIntro'
  | 'boss'
  | 'victory'
  | 'defeat';

export type DirectorEvent =
  | { type: 'waveStart'; index: number; wave: WaveDef }
  | { type: 'spawnGroup'; group: SpawnGroup }
  | { type: 'waveCleared'; index: number }
  | { type: 'bossIntro' }
  | { type: 'bossStart' }
  | { type: 'victory' }
  | { type: 'defeat' };

/** Fluxo da partida: tutorial → ondas → recompensas → chefe → resultado. Lógica pura. */
export class WaveDirector {
  phase: RunPhase = 'tutorial';
  waveIndex = -1;
  private groupIndex = 0;
  /** maior onda alcançada (1-based; chefe conta como waves.length + 1) */
  highestWave = 0;

  constructor(private readonly waves: WaveDef[]) {}

  get totalWaves(): number {
    return this.waves.length;
  }

  get currentWave(): WaveDef | undefined {
    return this.waves[this.waveIndex];
  }

  get over(): boolean {
    return this.phase === 'victory' || this.phase === 'defeat';
  }

  get remainingGroups(): number {
    const w = this.currentWave;
    return w ? w.groups.length - this.groupIndex : 0;
  }

  startNextWave(): DirectorEvent[] {
    if (this.over) return [];
    if (this.phase !== 'tutorial' && this.phase !== 'reward') return [];
    if (this.waveIndex + 1 >= this.waves.length) {
      this.phase = 'bossIntro';
      this.highestWave = Math.max(this.highestWave, this.waves.length + 1);
      return [{ type: 'bossIntro' }];
    }
    this.waveIndex++;
    this.groupIndex = 0;
    this.phase = 'wave';
    this.highestWave = Math.max(this.highestWave, this.waveIndex + 1);
    return [{ type: 'waveStart', index: this.waveIndex, wave: this.waves[this.waveIndex] }];
  }

  /** Chamar todo frame durante ondas. `alive` inclui inimigos ainda surgindo. */
  tick(alive: number): DirectorEvent[] {
    if (this.phase !== 'wave') return [];
    const wave = this.waves[this.waveIndex];
    const ev: DirectorEvent[] = [];
    if (this.groupIndex < wave.groups.length) {
      const g = wave.groups[this.groupIndex];
      if (alive <= g.whenAliveAtMost) {
        this.groupIndex++;
        ev.push({ type: 'spawnGroup', group: g });
      }
    } else if (alive === 0) {
      this.phase = 'waveCleared';
      ev.push({ type: 'waveCleared', index: this.waveIndex });
    }
    return ev;
  }

  /** Jogador interagiu com a recompensa. */
  beginReward(): void {
    if (this.phase === 'waveCleared') this.phase = 'reward';
  }

  bossStart(): DirectorEvent[] {
    if (this.phase !== 'bossIntro') return [];
    this.phase = 'boss';
    return [{ type: 'bossStart' }];
  }

  bossDefeated(): DirectorEvent[] {
    if (this.phase !== 'boss') return [];
    this.phase = 'victory';
    return [{ type: 'victory' }];
  }

  playerDied(): DirectorEvent[] {
    if (this.over) return [];
    this.phase = 'defeat';
    return [{ type: 'defeat' }];
  }
}
