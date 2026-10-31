# Atriox — assets do projeto estilo Hades

Este pacote recupera a fase de ação em arena do Atriox anterior ao platform fighter estilo Brawlhalla. Inclui o pacote original de campanha e os complementos posteriores de inimigos, Apollon e ambientação. Não inclui JDR nem as folhas laterais criadas para o Brawl.

## Como usar

- `assets/sprites_e_retratos/`: personagens, golpes, retratos e efeitos do pacote original.
- `assets/complementos_hades/`: inimigos e camadas separadas produzidas depois.
- `assets/arenas/`: cenários completos.
- `assets/referencias/`: fontes de identidade visual e poses originais.
- `assets/historico/`: versões anteriores e design descartado; não integrar automaticamente.
- `PROMPT_MASTER_CLAUDE.md`: briefing original de campanha e integração.
- `INVENTARIO_ASSETS.md`: inventário original preservado.

As folhas são fontes de arte, não atlas prontos. Grades descritas no inventário são intenções dos pedidos; confirmar recorte, transparência, escala e sequência antes de integrar. Há variantes com fundo residual, efeitos juntos ao personagem e armas perto das bordas. O Atriox com elmo marcado DESCARTADO não deve substituir o design aprovado.

## Cada imagem do pacote original

Todas as 41 gerações locais, incluindo revisões e o design descartado, foram preservadas. Os nomes abaixo são nomes organizados para este pacote. As grades são a intenção dos pedidos e devem ser verificadas visualmente. Ter alpha não comprova qualidade do recorte.

| Arquivo | Conteúdo | Dimensões | Pixels transparentes detectados |
|---|---|---|---|
| `assets/sprites_e_retratos/caim_movimento_ataques_inicial.png` | Caim inicial, 6x4; alternativa histórica | 1536×1024 | Sim |
| `assets/historico/atriox_elmo_DESCARTADO.png` | Design errado: elmo e armadura preta; NÃO usar em Atriox | 1536×1024 | Sim |
| `assets/sprites_e_retratos/atriox_corrida_12.png` | 4x3, ciclo de 12 poses; conferir alternância | 1448×1086 | Sim |
| `assets/sprites_e_retratos/caim_magia_rubra.png` | 4x3: poça, dominação e invocação; VFX incorporados | 1448×1086 | Sim |
| `assets/sprites_e_retratos/wyvern_sanguineo.png` | 4x3: voo, investida, materialização | 1448×1086 | Sim |
| `assets/sprites_e_retratos/atriox_combate_stun.png` | 4x4: dash, dois cortes, stun sanguíneo | 1402×1122 | Sim |
| `assets/sprites_e_retratos/apollon_bencao_atriox.png` | 3x2: bênção pós-Caim; dois personagens juntos, somente cena narrativa | 1536×1024 | Sim |
| `assets/sprites_e_retratos/atriox_ataques_solares.png` | 4x4: meia-lua, pilar, dash solar, avatar; VFX incorporados | 1428×1102 | Sim |
| `assets/sprites_e_retratos/toknar_movimento_furia.png` | 4x4: idle4, corrida8, fúria4 | 1226×1283 | Sim |
| `assets/sprites_e_retratos/toknar_combate_inicial.png` | 4x4: corte, giro, investida, cura; alternativa de 4 poses por ação | 1536×1024 | Sim |
| `assets/sprites_e_retratos/atriox_tecnicas_avancadas.png` | 6x3: retorno, ascendente, marca; efeitos juntos | 1774×887 | Sim |
| `assets/sprites_e_retratos/atriox_habilidades_solares_novas.png` | 6x3: orbital, eco solar, Sol Cativo; efeitos juntos | 1774×887 | Sim |
| `assets/historico/atriox_combo_1_v1.png` | 4x2, horizontal8; espada cortada e fundo opaco | 1536×1024 | Sim |
| `assets/historico/atriox_combo_2_v1.png` | 4x2, retorno8; verificar recorte | 1774×887 | Sim |
| `assets/sprites_e_retratos/atriox_combo_3.png` | 4x2, finalizador diagonal8 | 1774×887 | Sim |
| `assets/historico/atriox_carga_v1.png` | 2x2, carga em pé4 | 1024×1536 | Sim |
| `assets/historico/atriox_sentenca_v1.png` | 4x2, ascendente8 | 1774×887 | Sim |
| `assets/sprites_e_retratos/atriox_combo_1_revisao.png` | 4x2, horizontal8; versão posterior, fundo ainda colorido | 1536×1024 | Sim |
| `assets/sprites_e_retratos/atriox_combo_2_revisao.png` | 4x2, retorno8; versão posterior | 1774×887 | Sim |
| `assets/sprites_e_retratos/atriox_carga_revisao.png` | 2x2, carga4 EM PÉ; fundo ainda colorido | 1024×1536 | Sim |
| `assets/sprites_e_retratos/atriox_sentenca_revisao.png` | 4x2, ascendente8; versão posterior | 1774×887 | Sim |
| `assets/historico/toknar_ceifa_v1.png` | 4x2, ceifa8; verificar pontas do machado | 1774×887 | Sim |
| `assets/historico/toknar_fome_v1.png` | 4x2, golpe no chão8; verificar margens | 1774×887 | Sim |
| `assets/historico/caim_poca_v1.png` | 3x2, conjuração6 sem VFX, 3/4 direita | 1536×1024 | Sim |
| `assets/sprites_e_retratos/caim_erupcao.png` | 3x2, conjuração6 sem VFX, 3/4 direita | 1536×1024 | Sim |
| `assets/sprites_e_retratos/toknar_vfx.png` | 6x3: rastro horizontal5 e célula vazia; diagonal5 e vazia; fissura6 | 1774×887 | Sim |
| `assets/sprites_e_retratos/toknar_fome_revisao.png` | 4x2, fome8; versão posterior com margens maiores | 1774×887 | Sim |
| `assets/sprites_e_retratos/toknar_ceifa_revisao.png` | 4x2, ceifa8; versão posterior | 1774×887 | Sim |
| `assets/sprites_e_retratos/caim_poca_revisao.png` | 3x2, poça6; revisão posterior ainda com fundo colorido | 1536×1024 | Sim |
| `assets/sprites_e_retratos/goblin.png` | 4x3: corrida4, ataque4, reação e queda4 | 1536×1024 | Sim |
| `assets/sprites_e_retratos/orc_saqueador.png` | 4x3: corrida4, ataque4, reação e queda4 | 1447×1087 | Sim |
| `assets/sprites_e_retratos/wyvern_selvagem.png` | 4x3: voo4, ataque4, queda4 | 1536×1024 | Sim |
| `assets/sprites_e_retratos/retratos_atriox_toknar_caim.png` | 3x2, colunas Atriox/Toknar/Caim; duas expressões cada | 1536×1024 | Sim |
| `assets/sprites_e_retratos/carrasco_base.png` | Pose-base corpo inteiro; referência principal do Carrasco novo | 1223×1286 | Sim |
| `assets/sprites_e_retratos/carrasco_retrato.png` | Retrato para diálogo | 1354×1161 | Sim |
| `assets/sprites_e_retratos/carrasco_movimento.png` | 4x4: idle4, corrida8, postura quebrada4 | 1402×1122 | Sim |
| `assets/sprites_e_retratos/carrasco_golpes.png` | 4x4: linhas1-2 varredura8, linhas3-4 execução vertical8 | 1536×1024 | Sim |
| `assets/sprites_e_retratos/carrasco_investida_dano_morte.png` | 4x4: linhas1-2 investida8, linha3 dano4, linha4 morte4 | 1536×1024 | Sim |
| `assets/sprites_e_retratos/carrasco_vfx.png` | 6x3: rastro horizontal6, diagonal6, impacto6 | 1774×887 | Sim |
| `assets/arenas/arena_caim.png` | Cenário inteiro: campo aberto, wyverns pintadas observando nas bordas | 1536×1024 | Não |
| `assets/arenas/arena_toknar.png` | Cenário inteiro: plateia de orcs, entradas de reforços nas laterais superiores | 1536×1024 | Não |


## Cada referência original

| Arquivo | O que é |
|---|---|
| `assets/referencias/apollon_original.png` | Referência visual original de Apollon. |
| `assets/referencias/atriox_caim_cena_referencia.png` | Cena de Atriox e Caim; referência narrativa, não folha isolada. |
| `assets/referencias/atriox_cast_original.png` | Atriox conjurando; referência original. |
| `assets/referencias/atriox_dash_original.png` | Dash de Atriox; referência original. |
| `assets/referencias/atriox_hurt_original.png` | Reação de dano de Atriox; referência original. |
| `assets/referencias/atriox_idle_original.png` | Atriox parado; referência original de idle. |
| `assets/referencias/atriox_lunge_original.png` | Atriox em investida/estocada; referência original. |
| `assets/referencias/atriox_slash_original.png` | Atriox executando corte de espada; referência original. |
| `assets/referencias/caim_original.png` | Referência visual original de Caim. |
| `assets/referencias/carrasco_antigo_print.png` | Print do Carrasco antigo; referência histórica, não design principal. |
| `assets/referencias/toknar_original.png` | Referência visual original de Toknar e sua arma. |

## Complementos posteriores para o projeto Hades

| Arquivo | O que é / uso | Dimensões |
|---|---|---|
| `assets/complementos_hades/boneco_treino_quebra_v1.png` | Boneco de treino: pose inicial, reações ao golpe e quebra. Variante inicial, seis poses. | 1536×1024 |
| `assets/complementos_hades/wyvern_idle_separado.png` | Wyvern isolado em seis poses de espera; camada animável para a arena de Caim. | 1536×1024 |
| `assets/complementos_hades/atirador_flecha.png` | Flecha isolada para o projétil do Atirador da Provação; imagem única, movimento controlado pelo jogo. | 2172×724 |
| `assets/complementos_hades/plateia_orcs_animada.png` | Plateia de orcs separada do cenário, em doze poses, para animar torcida na arena de Toknar. | 1448×1086 |
| `assets/complementos_hades/atirador_combate_v1.png` | Atirador da Provação: corrida, mira/disparo e reação/queda. Variante com linhas de grade visíveis: precisa de limpeza antes do atlas. | 1774×887 |
| `assets/complementos_hades/boneco_treino_quebra_v2.png` | Boneco de treino: seis poses de estado inicial, reação e destruição; variante posterior. | 1536×1024 |
| `assets/complementos_hades/recruta_combate_v1.png` | Recruta da Provação: corrida, golpes de espada e reação/queda; folha com dezoito poses. | 1536×1024 |
| `assets/complementos_hades/apollon_avatar_isolado.png` | Avatar dourado de Apollon isolado, oito poses de manifestação e dissipação, sem Atriox junto. | 1774×887 |
| `assets/complementos_hades/guardiao_impacto.png` | Efeito separado do golpe no chão do Guardião: seis fases de impacto, poeira e detritos. | 1536×1024 |
| `assets/complementos_hades/atirador_combate_v2.png` | Atirador da Provação: dezoito poses de corrida, disparo e queda; variante posterior sem linhas de grade aparentes. | 1774×887 |
| `assets/complementos_hades/guardiao_combate.png` | Guardião da Provação com maça: corrida, preparação e golpe pesado, reação e queda. | 1954×805 |
| `assets/complementos_hades/recruta_combate_v2.png` | Recruta da Provação: dezoito poses de corrida, espada e queda; variante posterior com tecido vermelho. | 1536×1024 |
| `assets/complementos_hades/apollon_feixe_solar.png` | Feixe solar isolado de Apollon: seis fases de formação, auge e dissipação. | 1536×1024 |

## Notas de integração

Recruta: inimigo de espada. Atirador: inimigo de arco, usando a flecha separada. Guardião: inimigo pesado com maça e impacto no chão. Boneco: treino inicial. Apollon: avatar e feixe separados; a bênção com Atriox é cena narrativa. Plateia e wyvern idle são camadas de ambientação. Não atribuir a uma folha mista um número de animações completas que ela não contém.

As imagens de wyvern sanguíneo, wyvern selvagem, arena de Caim e bênção de Apollon recuperadas também separadamente eram cópias idênticas de arquivos do pacote original e foram mantidas uma única vez. As variantes realmente diferentes estão preservadas.
