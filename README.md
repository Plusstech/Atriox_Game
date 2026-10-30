# Atriox Cinder: Lâmina sem Deus

**v0.5:** Carrasco com visual novo e postura quebrável; Toknar com Ceifa e Fome próprias, efeitos desenhados, reforços do clã e arena ilustrada; Caim em 3/4 numa arena ilustrada; goblins, orcs saqueadores (escudo frontal) e wyverns selvagens; conversas estilo RPG antes dos três chefes; antecipações sem pose congelada. Veja [V05.md](docs/V05.md) e o que ainda falta de arte em [ASSETS_PENDENTES.md](docs/ASSETS_PENDENTES.md).

**v0.3 em revisão local:** altar complementar, dons nas portas, nove dons avançados, Toknar antes de Caim, Caim com novas defesas e infecção, e Provação da Eternidade. Veja [mudanças, controles, validação e limitações](docs/V03.md).

As novas folhas de combate de Atriox foram normalizadas em 512×512 e integradas, incluindo carga em pé. Veja [mapeamento das fontes, preparação e testes](docs/COMBAT_ART_UPDATE.md).

Roguelite de ação 2D em fantasia sombria para navegador: Phaser 3, TypeScript e Vite. **v0.2**: animações por quadros reais (atlas), combo de 3 golpes com buffer, dash de 2 cargas, salas com portas e recompensas, dons de Apollon, **Caim Morvaigne** com sangue que domina e wyverns, e a cena final em que Apollon abençoa Atriox.

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
| `npm run atlas` | Recorta as folhas de `art_source/v02` e gera o atlas (Python + Pillow/NumPy/SciPy) |
| `npm run sprites` | Reextrai as poses do concept sheet da v0.1 |
| `node tests/e2e/probe.mjs` | Capturas visuais dos momentos-chave (após `npm run build`) |

Inspetor de animações: `npm run dev` → menu → **Inspetor de animações** (ou `?inspector` na URL). F2 abre o painel de desenvolvimento e F3 mostra o desempenho.

## Deploy

Um push na `main` dispara o GitHub Actions: build, testes e publicação de `dist/` no branch **`deploy`**. Na Hostinger, conecte o Git do hPanel ao branch `deploy`. O passo a passo está em [docs/DEPLOY_HOSTINGER.md](docs/DEPLOY_HOSTINGER.md).

## Estrutura

```
src/
  main.ts                 Phaser + tratamento de erros fatais
  data/                   ataques, habilidades, inimigos, chefe, bênçãos, ondas (100% dados)
  game/
    scenes/               Boot, Menu, Arena, UI (HUD), Reward, Pause, Result
    entities/             Player, Enemy, Boss (Carrasco), Caim, Wyvern, TrainingDummy
    combat/               ComboController, DashController, HitboxSystem, ProjectileSystem,
                          StatusSystem, DamageSystem, geometry
    abilities/            SpellController (lógica), JudgmentFlame (manifestação)
    animation/            FrameTimeline (lógica pura), SpriteAnimator, AtrioxAnimator (estados)
    ai/                   EnemyBrain, BossBrain, CaimBrain, WyvernBrain (máquinas de estado puras)
    progression/          PlayerStats, BlessingSystem
    systems/              RunDirector (salas/portas), WaveDirector, SaveSystem, Movement, Collision, ArenaBuilder
    fx/                   Effects, ArenaPainter (piso), BloodRenderer, BlessingCinematic, TextureFactory
    audio/                Sfx (síntese WebAudio)
    ui/ dev/              widgets, DevPanel
public/assets/atlas/      atlas WebP dos personagens + characters.json (quadros, trim, pivô, ordem da corrida)
public/assets/atriox/     poses do concept v0.1 (menu, retrato)
art_source/v02/           folhas de arte originais da v0.2
tools/                    sheet_frames.py (recorte), build_atlases.py (atlas v0.2), build_v03/v04/v05_atlas.py (folhas seguintes), extract_sprites.py (v0.1)
art_source/v05/           folhas, retratos e arenas do pacote PROMPT_MASTER (originais intactos)
tests/                    unitários (Vitest) e e2e (playwright-core)
docs/                     GAME_DESIGN, LORE_CANON, ART_PIPELINE, REFERENCES, DEPLOY_HOSTINGER
```

## Documentação

- [v0.5: campanha, chefes, inimigos, conversas, testes](docs/V05.md)
- [Assets pendentes](docs/ASSETS_PENDENTES.md)
- [Game design e números](docs/GAME_DESIGN.md)
- [Cânone e decisões narrativas](docs/LORE_CANON.md)
- [Pipeline de arte e animações pendentes](docs/ART_PIPELINE.md)
- [Referências e licenças](docs/REFERENCES.md)
