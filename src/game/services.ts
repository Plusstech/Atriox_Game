import { SaveSystem } from './systems/SaveSystem';

/** Serviços globais (singletons simples, sem estado de cena). */
export const save = new SaveSystem();

export function shakeScale(): number {
  return save.data.settings.reduceShake ? 0.2 : 1;
}

export function flashAllowed(): boolean {
  return !save.data.settings.reduceFlash;
}

export function particleScale(): number {
  return save.data.settings.graphics === 'low' ? 0.45 : 1;
}
