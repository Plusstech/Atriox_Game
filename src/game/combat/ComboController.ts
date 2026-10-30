import type { ComboStepDef } from '../../data/attacks';

export type ComboPhase = 'ready' | 'windup' | 'active' | 'recovery';

export type ComboEvent =
  | { type: 'stepStart'; index: number; step: ComboStepDef }
  | { type: 'activeStart'; index: number; step: ComboStepDef }
  | { type: 'activeEnd'; index: number; step: ComboStepDef }
  | { type: 'stepEnd'; index: number; step: ComboStepDef }
  | { type: 'comboReset' };

/**
 * Máquina de estados do combo de 3 golpes.
 *  - Cada clique (press) é um evento único: segurar o botão NÃO repete golpes.
 *  - Clique durante um golpe fica em buffer e dispara o próximo a partir de `chainFrom`.
 *  - Depois do fim de um golpe há `resetAfter` ms para continuar o combo; depois volta ao 1º.
 *  - Dash/magia podem cancelar windup e recovery (nunca a janela ativa).
 */
export class ComboController {
  phase: ComboPhase = 'ready';
  /** golpe em execução (-1 quando parado) */
  index = -1;
  /** próximo golpe a executar quando parado */
  nextIndex = 0;
  elapsed = 0;
  buffered = false;
  private pendingStart = false;
  private sinceEnd = 0;

  constructor(private readonly steps: ComboStepDef[]) {}

  get attacking(): boolean {
    return this.phase !== 'ready';
  }

  get current(): ComboStepDef | undefined {
    return this.index >= 0 ? this.steps[this.index] : undefined;
  }

  /** índice do golpe atual ou do último executado (para HUD) */
  get displayIndex(): number {
    return this.index >= 0 ? this.index : this.nextIndex - 1;
  }

  press(): void {
    if (this.phase === 'ready') this.pendingStart = true;
    else this.buffered = true;
  }

  canCancel(): boolean {
    return this.phase === 'windup' || this.phase === 'recovery';
  }

  /** Cancela o golpe atual (dash/magia). Mantém o progresso do combo. */
  cancel(): boolean {
    if (!this.canCancel()) return false;
    const finished = this.index;
    this.phase = 'ready';
    this.index = -1;
    this.elapsed = 0;
    this.buffered = false;
    this.pendingStart = false;
    this.sinceEnd = 0;
    this.nextIndex = finished + 1 >= this.steps.length ? 0 : finished + 1;
    return true;
  }

  /** Interrupção forçada (ex.: atordoado). Zera o combo. */
  interrupt(): void {
    this.phase = 'ready';
    this.index = -1;
    this.nextIndex = 0;
    this.elapsed = 0;
    this.buffered = false;
    this.pendingStart = false;
  }

  update(dt: number): ComboEvent[] {
    const events: ComboEvent[] = [];
    let remaining = dt;
    // laço protege contra dt grande (ex.: aba em segundo plano)
    for (let guard = 0; guard < 12; guard++) {
      if (this.phase === 'ready') {
        if (this.pendingStart) {
          this.pendingStart = false;
          this.startStep(this.nextIndex, events);
          continue;
        }
        if (this.nextIndex !== 0) {
          this.sinceEnd += remaining;
          const prev = this.steps[this.nextIndex - 1];
          if (prev && this.sinceEnd > prev.resetAfter) {
            this.nextIndex = 0;
            events.push({ type: 'comboReset' });
          }
        }
        remaining = 0;
        break;
      }

      const step = this.steps[this.index];
      const activeAt = step.windup;
      const recoveryAt = step.windup + step.active;
      const endAt = recoveryAt + step.recovery;

      // ponto do próximo limiar a ser cruzado
      let nextMark = endAt;
      if (this.phase === 'windup') nextMark = activeAt;
      else if (this.phase === 'active') nextMark = recoveryAt;
      else if (this.buffered && this.index < this.steps.length - 1) nextMark = Math.min(endAt, Math.max(step.chainFrom, recoveryAt));

      const toMark = nextMark - this.elapsed;
      if (remaining < toMark) {
        this.elapsed += remaining;
        remaining = 0;
        break;
      }
      this.elapsed = nextMark;
      remaining -= Math.max(0, toMark);

      if (this.phase === 'windup') {
        this.phase = 'active';
        events.push({ type: 'activeStart', index: this.index, step });
      } else if (this.phase === 'active') {
        this.phase = 'recovery';
        events.push({ type: 'activeEnd', index: this.index, step });
      } else {
        // recovery: encadeia ou termina
        const chain = this.buffered && this.index < this.steps.length - 1;
        events.push({ type: 'stepEnd', index: this.index, step });
        if (chain) {
          this.startStep(this.index + 1, events);
        } else {
          const finished = this.index;
          const wasBuffered = this.buffered;
          this.phase = 'ready';
          this.index = -1;
          this.elapsed = 0;
          this.buffered = false;
          this.sinceEnd = 0;
          this.nextIndex = finished + 1 >= this.steps.length ? 0 : finished + 1;
          // input dado durante o finalizador reinicia o combo imediatamente
          if (wasBuffered) this.pendingStart = true;
        }
      }
    }
    return events;
  }

  private startStep(i: number, events: ComboEvent[]): void {
    this.index = i;
    this.phase = 'windup';
    this.elapsed = 0;
    this.buffered = false;
    this.sinceEnd = 0;
    events.push({ type: 'stepStart', index: i, step: this.steps[i] });
  }
}
