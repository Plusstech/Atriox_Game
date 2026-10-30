import type { SpawnGroup } from '../../data/waves';
import type { RoomDef, RewardKind } from '../../data/rooms';

/**
 * Sequência de salas da partida (lógica pura).
 *
 * prep → [porta] → sala → recompensa → [porta] → … → chefe → vitória.
 * Fases dentro de uma sala: intro → combat → cleared (recompensa disponível)
 * → doors (portas abertas) → (transição) → próxima sala.
 */
/** 'prep' = sala em espera (antes do combate começar) */
export type RoomPhase = 'prep' | 'combat' | 'boss' | 'cleared' | 'reward' | 'doors' | 'victory' | 'defeat';

export type RunEvent =
  | { type: 'enterRoom'; index: number; room: RoomDef; reward: RewardKind | null }
  | { type: 'spawnGroup'; group: SpawnGroup }
  | { type: 'roomCleared'; index: number }
  | { type: 'doorsOpen'; options: RewardKind[] }
  | { type: 'victory' }
  | { type: 'defeat' };

export class RunDirector {
  index = -1;
  phase: RoomPhase = 'prep';
  /** recompensa prometida pela porta escolhida para a sala atual */
  roomReward: RewardKind | null = null;
  private groupIndex = 0;
  doorOptions: RewardKind[] = [];
  roomsCleared = 0;

  constructor(
    readonly rooms: RoomDef[],
    private readonly rng: () => number = Math.random
  ) {}

  get room(): RoomDef | undefined {
    return this.rooms[this.index];
  }

  get over(): boolean {
    return this.phase === 'victory' || this.phase === 'defeat';
  }

  get isLastRoom(): boolean {
    return this.index >= this.rooms.length - 1;
  }

  /** Entra na primeira sala (preparação). */
  begin(): RunEvent[] {
    return this.enter(0, null);
  }

  /** Inicia o combate da sala (a preparação começa ao interagir com o altar). */
  startCombat(): RunEvent[] {
    const r = this.room;
    if (!r || this.over) return [];
    if (r.kind === 'prep') {
      // a "provação" da preparação é apenas abrir as portas
      this.phase = 'cleared';
      return this.openDoors();
    }
    this.phase = r.kind === 'boss' ? 'boss' : 'combat';
    this.groupIndex = 0;
    return [];
  }

  /** Chamar todo quadro durante combate comum. `alive` inclui inimigos surgindo. */
  tick(alive: number): RunEvent[] {
    const r = this.room;
    if (!r || this.phase !== 'combat') return [];
    const groups = r.waves ?? [];
    if (this.groupIndex < groups.length) {
      if (alive <= groups[this.groupIndex].whenAliveAtMost) {
        return [{ type: 'spawnGroup', group: groups[this.groupIndex++] }];
      }
      return [];
    }
    if (alive === 0) return this.clearRoom();
    return [];
  }

  /** Chefe derrotado (sala de chefe). */
  bossDefeated(): RunEvent[] {
    if (this.phase !== 'boss') return [];
    if (this.isLastRoom) {
      this.phase = 'victory';
      this.roomsCleared++;
      return [{ type: 'victory' }];
    }
    return this.clearRoom();
  }

  private clearRoom(): RunEvent[] {
    this.phase = 'cleared';
    this.roomsCleared++;
    return [{ type: 'roomCleared', index: this.index }];
  }

  /** O jogador coletou (ou não havia) a recompensa da sala. */
  rewardTaken(): RunEvent[] {
    if (this.phase !== 'cleared' && this.phase !== 'reward') return [];
    return this.openDoors();
  }

  beginReward(): void {
    if (this.phase === 'cleared') this.phase = 'reward';
  }

  private openDoors(): RunEvent[] {
    if (this.isLastRoom) return [];
    this.phase = 'doors';
    const next = this.rooms[this.index + 1];
    const pool = [...next.rewardPool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    this.doorOptions = pool.slice(0, Math.min(next.doors, pool.length));
    return [{ type: 'doorsOpen', options: [...this.doorOptions] }];
  }

  /** Escolhe uma porta (índice nas opções) e entra na próxima sala. */
  chooseDoor(i: number): RunEvent[] {
    if (this.phase !== 'doors' || i < 0 || i >= this.doorOptions.length) return [];
    return this.enter(this.index + 1, this.doorOptions[i]);
  }

  private enter(i: number, reward: RewardKind | null): RunEvent[] {
    this.index = i;
    this.roomReward = reward;
    this.groupIndex = 0;
    this.doorOptions = [];
    const r = this.rooms[i];
    // toda sala começa "em espera" (entrada, tutorial ou introdução do chefe); startCombat() inicia
    this.phase = 'prep';
    return [{ type: 'enterRoom', index: i, room: r, reward }];
  }

  playerDied(): RunEvent[] {
    if (this.over) return [];
    this.phase = 'defeat';
    return [{ type: 'defeat' }];
  }
}
