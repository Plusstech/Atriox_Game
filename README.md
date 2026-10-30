# Atriox Cinder: Lâmina sem Deus

Roguelite de ação 2D em fantasia sombria para navegador: Phaser 3, TypeScript e Vite. É um vertical slice v0.1 jogável, com combo de 3 golpes, dash, magia, três arquétipos de inimigo, duas ondas, bênçãos e o miniboss **O Carrasco da Provação**, com duas fases.

O build é estático: roda em qualquer hospedagem, como a Hostinger, sem Node.js no servidor.

## Rodar localmente

```bash
npm install
npm run dev        # http://localhost:5173  (F2 abre o painel de desenvolvimento)
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Checa os tipos e gera o site estático em `dist/` |
| `npm run preview` | Serve o `dist/` localmente |
| `npm test` | Testes unitários (Vitest) da lógica de jogo |
| `npm run test:e2e` | Partida completa headless contra o `dist/` (requer `npm run build` antes) |
| `npm run check` | test + build + e2e |
| `npm run sprites` | Reextrai as poses do concept sheet (Python + Pillow/NumPy/SciPy) |

## Deploy

Um push na `main` dispara o GitHub Actions: build, testes e publicação de `dist/` no branch **`deploy`**. Na Hostinger, conecte o Git do hPanel ao branch `deploy`. O passo a passo está em [docs/DEPLOY_HOSTINGER.md](docs/DEPLOY_HOSTINGER.md).

## Estrutura

```
src/
  main.ts                 Phaser + tratamento de erros fatais
  data/                   ataques, habilidades, inimigos, chefe, bênçãos, ondas (100% dados)
  game/
    scenes/               Boot, Menu, Arena, UI (HUD), Reward, Pause, Result
    entities/             Player, Enemy, Boss, TrainingDummy
    combat/               ComboController, DashController, HitboxSystem, ProjectileSystem,
                          StatusSystem, DamageSystem, geometry
    abilities/            SpellController (lógica), JudgmentFlame (manifestação)
    animation/            AtrioxAnimator (estados, prioridades, crossfade, procedural)
    ai/                   EnemyBrain, BossBrain (máquinas de estado puras)
    progression/          PlayerStats, BlessingSystem
    systems/              WaveDirector, SaveSystem, Movement, Collision, Cooldown, ArenaBuilder
    fx/                   Effects (partículas e feedback), TextureFactory (arte procedural)
    audio/                Sfx (síntese WebAudio)
    ui/ dev/              widgets, DevPanel
public/assets/atriox/     poses extraídas + atriox_poses.json
art_source/               concept sheet original
tools/extract_sprites.py  pipeline de extração
tests/                    unitários (Vitest) e e2e (playwright-core)
docs/                     GAME_DESIGN, LORE_CANON, ART_PIPELINE, REFERENCES, DEPLOY_HOSTINGER
```

## Documentação

- [Game design e números](docs/GAME_DESIGN.md)
- [Cânone e decisões narrativas](docs/LORE_CANON.md)
- [Pipeline de arte e animações pendentes](docs/ART_PIPELINE.md)
- [Referências e licenças](docs/REFERENCES.md)
