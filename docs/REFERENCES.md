# Referências técnicas e licenças

Nenhum repositório de referência foi copiado para o projeto, e nenhum é carregado em tempo de execução. Todo o código em `src/` foi escrito para este projeto. As referências serviram para estudar arquitetura e padrões.

## Repositórios analisados

| Repositório | Licença do código | Assets | O que foi aproveitado (como ideia, sem cópia) |
|---|---|---|---|
| [JohnVonDrashek/dungeon-crawler-now](https://github.com/JohnVonDrashek/dungeon-crawler-now) | MIT | Licença não declarada separadamente: **não usados** | Separação Scenes / entities / systems. Boot → Menu → cena de jogo + cena de UI. Vite + TypeScript com Phaser 3.80. |
| [Spuds0588/kabam-game](https://github.com/Spuds0588/kabam-game) | MIT | Pasta `assets/` sem licença própria visível: **não usados** | Dados centralizados (`config.js`), um arquivo por inimigo, perk e arma, WaveManager, "componentes" como Health. Inspirou `data/*.ts`, `WaveDirector` e `Health`. |
| [phaserjs/phaser](https://github.com/phaserjs/phaser) | MIT | — | Motor (dependência npm `phaser@3.90.0`) |
| [docs.phaser.io](https://docs.phaser.io/) (animations, scenes) | — | — | Ciclo de vida de cenas (shutdown/restart), cenas paralelas (UIScene), partículas 3.60+ |
| [phaserjs/template-vite-ts](https://github.com/phaserjs/template-vite-ts) | MIT | — | Referência de configuração Vite + TS. **Decisão:** o template atual usa Phaser 4. Usamos **Phaser 3.90** para manter compatibilidade com as referências de gameplay (todas em Phaser 3). |
| [ourcade/phaser3-dungeon-crawler-starter](https://github.com/ourcade/phaser3-dungeon-crawler-starter) | Analisado apenas como referência conceitual | **Não usados** | Padrão de cena de UI separada e de entidades com estado |
| [mipearson/dungeondash](https://github.com/mipearson/dungeondash) | Analisado apenas como referência conceitual | **Não usados** | Idem |

### Decisões de arquitetura derivadas

- **Colisão própria** (`systems/Collision.ts`) no lugar do Arcade Physics. A arena só tem limites retangulares e obstáculos circulares, então resolver círculo contra círculo e AABB é previsível, barato e testável sem Phaser.
- **Hitboxes geométricas** (`combat/HitboxSystem.ts`) desacopladas das animações, com janelas `delay/duration` e um alvo por hitbox. Isso atende à exigência de "separação entre animação e aplicação do dano".
- **Lógica pura testável:** combo, dash, magia, IA, chefe, ondas, bênçãos e save são classes sem Phaser e são cobertas por Vitest.

## Dependências

| Pacote | Uso | Licença |
|---|---|---|
| phaser 3.90.0 | runtime | MIT |
| vite 6 | build e servidor de desenvolvimento | MIT |
| typescript 5.8 | compilação | Apache-2.0 |
| vitest 3 | testes unitários | MIT |
| playwright-core 1.64 | teste E2E headless (não baixa navegador) | Apache-2.0 |

## Assets

| Asset | Origem | Licença / status |
|---|---|---|
| `art_source/atriox_concept_sheet.png` | Fornecido pelo usuário | Do usuário |
| `public/assets/atriox/*.png` | Extraídos do concept sheet por `tools/extract_sprites.py` | Do usuário (derivados) |
| Inimigos, chefe, cenário, partículas, efeitos | Gerados por código (`src/game/fx/TextureFactory.ts`) | Originais do projeto |
| Áudio | Sintetizado em tempo real (`src/game/audio/Sfx.ts`) | Original do projeto |

Nenhum asset de terceiros, comercial ou proprietário (incluindo Hades) foi baixado ou usado.

## Fontes consultadas e indisponibilidades

- A narrativa canônica ([aquiwhit.weebly.com/atriox-cinder.html](https://aquiwhit.weebly.com/atriox-cinder.html)) foi lida em quatro trechos com resumo automático (ver `LORE_CANON.md`).
- Os repositórios foram analisados pelo README e pela estrutura pública. O código-fonte completo não foi clonado, para respeitar a regra de não incorporar repositórios.
