/**
 * Conversas antes de cada chefe (estilo RPG antigo).
 * Os textos são ROTEIROS PROPOSTOS PARA O JOGO (PROMPT_MASTER v0.5, §13),
 * não fatos canônicos: não criam parentescos, pactos ou eventos da história.
 * Editáveis aqui sem tocar no código da cena.
 */
export type Speaker = 'atriox' | 'carrasco' | 'toknar' | 'caim';
export type BossDialogueId = 'executioner' | 'toknar' | 'caim';

export interface DialogueLine {
  speaker: Speaker;
  text: string;
  /** retrato (sem o prefixo `portrait_`); padrão: o primeiro do personagem */
  portrait?: string;
}

export interface SpeakerInfo {
  name: string;
  /** retratos disponíveis; o primeiro é o padrão */
  portraits: string[];
  side: 'left' | 'right';
  color: string;
}

export const SPEAKERS: Record<Speaker, SpeakerInfo> = {
  atriox: { name: 'Atriox Cinder', portraits: ['atriox_calm', 'atriox_angry'], side: 'left', color: '#ffd77a' },
  carrasco: { name: 'O Carrasco da Provação', portraits: ['carrasco'], side: 'right', color: '#ff9070' },
  toknar: { name: 'Toknar', portraits: ['toknar_calm', 'toknar_roar'], side: 'right', color: '#a8e070' },
  caim: { name: 'Caim Morvaigne', portraits: ['caim_calm', 'caim_sly'], side: 'right', color: '#e05060' },
};

export const BOSS_DIALOGUES: Record<BossDialogueId, DialogueLine[]> = {
  executioner: [
    { speaker: 'carrasco', text: 'Muitos chegaram até esta câmara. Poucos aprenderam a sair dela.' },
    { speaker: 'atriox', text: 'Então observe com atenção.' },
    { speaker: 'carrasco', text: 'Aprenderá a respeitar o peso desta lâmina.' },
  ],
  toknar: [
    { speaker: 'toknar', text: 'Rhaesis está com fome, Atriox.' },
    { speaker: 'atriox', text: 'Vai ter que me alcançar primeiro.', portrait: 'atriox_angry' },
    { speaker: 'toknar', text: 'Quando ela beber, sua luta termina. A minha recomeça.', portrait: 'toknar_roar' },
  ],
  caim: [
    { speaker: 'caim', text: 'Até aqui você pôde escolher onde pisar.' },
    { speaker: 'atriox', text: 'E ainda posso escolher quem derrubar.', portrait: 'atriox_angry' },
    { speaker: 'caim', text: 'Um passo no meu sangue... e até essa vontade será minha.', portrait: 'caim_sly' },
  ],
};

/** Imagens carregadas no Boot (public/assets/portraits, public/assets/arenas). */
export const PORTRAITS = ['atriox_calm', 'atriox_angry', 'carrasco', 'toknar_calm', 'toknar_roar', 'caim_calm', 'caim_sly'];
export const ARENA_IMAGES = ['arena_toknar', 'arena_caim'];

/** Velocidade da revelação do texto (caracteres por segundo). */
export const DIALOGUE_CPS = 48;

/**
 * Estado puro da conversa (testável sem Phaser):
 * confirmar com o texto incompleto completa a fala; com ele completo, avança.
 */
export class DialogueState {
  index = 0;
  shown = 0;
  done = false;

  constructor(readonly lines: DialogueLine[]) {
    if (!lines.length) this.done = true;
  }

  get line(): DialogueLine | null {
    return this.done ? null : this.lines[this.index];
  }

  get complete(): boolean {
    const l = this.line;
    return !l || this.shown >= l.text.length;
  }

  get visibleText(): string {
    const l = this.line;
    return l ? l.text.slice(0, Math.floor(this.shown)) : '';
  }

  /** Avança a revelação; retorna quantos caracteres novos apareceram. */
  tick(dtMs: number, cps = DIALOGUE_CPS): number {
    const l = this.line;
    if (!l || this.complete) return 0;
    const before = Math.floor(this.shown);
    this.shown = Math.min(l.text.length, this.shown + (dtMs / 1000) * cps);
    return Math.floor(this.shown) - before;
  }

  /** Enter/Espaço/clique. Retorna 'completed' | 'next' | 'end'. */
  confirm(): 'completed' | 'next' | 'end' {
    if (this.done) return 'end';
    if (!this.complete) {
      this.shown = this.line!.text.length;
      return 'completed';
    }
    this.index++;
    this.shown = 0;
    if (this.index >= this.lines.length) {
      this.done = true;
      return 'end';
    }
    return 'next';
  }

  skip(): void {
    this.done = true;
  }
}
