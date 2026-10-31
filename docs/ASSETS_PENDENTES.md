# Assets pendentes (v0.5)

O que o jogo usa hoje e o que ainda falta para as animações ficarem completas. Formato pedido para toda folha nova:
- fundo **transparente** de verdade;
- personagem olhando para a **direita**;
- **mesma escala** e **mesma linha dos pés** em todos os quadros;
- grade regular com espaço entre as células, sem armas atravessando a célula vizinha;
- **VFX numa folha separada** do corpo.

## Já integrados nesta versão

| Folha | Uso |
|---|---|
| `carrasco_movimento`, `carrasco_golpes`, `carrasco_investida_dano_morte`, `carrasco_vfx` | Carrasco completo |
| `carrasco_retrato`, `retratos_atriox_toknar_caim` | conversas pré-chefe |
| `toknar_ceifa_revisao`, `toknar_fome_revisao`, `toknar_vfx` | Ceifa, Fome, rastros e fissura |
| `caim_poca_revisao`, `caim_erupcao` | conjurações 3/4, escudo e ritual |
| `goblin`, `orc_saqueador`, `wyvern_selvagem` | inimigos das primeiras fases |
| `atriox_combo_3` | finalizador diagonal (quadro 05 descartado: a lâmina da pose vizinha atravessa a perna) |
| `arena_toknar`, `arena_caim` | arenas ilustradas |
| `recruta_combate_v2`, `atirador_combate_v2`, `guardiao_combate`, `guardiao_impacto`, `atirador_flecha` | inimigos da Provação com quadros, impacto e flecha desenhados (v1 do atirador tem fundo opaco: não usado) |
| `boneco_treino_quebra_v2` | boneco: parado, duas reações, quebra ao iniciar a Provação |
| `apollon_avatar_isolado`, `apollon_feixe_solar` | Manifestação de Apollon separada do Atriox; o feixe também é o pilar do Juízo do Segundo Sol |
| `plateia_orcs_animada`, `wyvern_idle_separado` | camadas animadas discretas nas arenas de Toknar e Caim |

## Atriox

| Animação | Quadros | Situação hoje |
|---|---|---|
| Contra-ataque (Corte de Retorno) | 8 | reutiliza o corte horizontal |
| Dash | 6 | 3 poses da folha `atriox_combate_stun` |
| Idle respirando | 6 | 4 poses de carga em pé usadas como guarda |
| Corrida direita / frente / costas | 8 + 8 + 8 | só a lateral (12 poses parecidas); frente e costas não existem |
| Conjuração (Chama do Julgamento) | 8 | 2 poses da folha solar |
| Dano | 4 | 1 pose |
| Servidão (dominado pelo sangue) | 6 | 3 poses com sangue pintado |
| Morte | 8 | 1 pose + queda procedural |

## Sol / Apollon (separar o que hoje vem pintado junto)

| Animação | Quadros | Observação |
|---|---|---|
| Atriox invocando | 6 | **somente Atriox** (hoje: 3 poses de conjuração da folha solar) |
| ~~Apollon manifestando~~ | 8 | **integrado** (`apollon_avatar_isolado`) |
| ~~Feixe~~ | 6 | **integrado** (`apollon_feixe_solar`) |
| Lâmina orbital | 6 | sem corpo |
| Sol Cativo | loop 6 + explosão 8 | sem corpo |
| Marca do Carrasco | 6 | isolada |

A folha `apollon_bencao_atriox` (6 composições) fica **só na cena narrativa**.

## Toknar

| Animação | Quadros | Situação hoje |
|---|---|---|
| Ceifa com **três golpes completos** | 3 × 6 | uma revisão de 8 poses (um golpe); o 2º e o 3º corte reaproveitam poses dela |
| Investida | 3 + loop 4 + freio 3 | 2 poses de preparação + corrida acelerada + 2 de freio |
| Giro (Carnificina) | 2 + loop 6–8 + tontura 2 | 4 poses em loop |
| Banquete | 3 + loop 4 + interrompido 3 | 2 + loop 2 + 1 |
| Postura quebrada | 4 | 2 poses da Fome |
| Dano | 2 | não há (flash branco) |
| Morte | 6–8 | 2 poses + desvanecer |
| Público animado | camadas separadas | **parcial**: 4 orcs animados (`plateia_orcs_animada`) sobre a plateia pintada, que continua estática |

## Caim

| Animação | Quadros | Situação hoje |
|---|---|---|
| Rajada de projéteis | 6 | sem quadros próprios |
| Escudo: ativar / loop / quebrar | 3 + 4 + 3 | loop de 2 poses da poça |
| Ritual: entrada / loop / interrompido | 3 + 4 + 3 | loop de 2 poses da erupção |
| Invocar wyvern | 6 | folha frontal antiga (troca de vista visível) |
| Idle | 6 | 2 poses |
| Dano | 2 | 1 pose |
| Morte | 8 | 2 poses + dissolução |
| Wyverns dos rochedos levantando voo | camada separada | **parcial**: 2 wyverns pousadas respirando (`wyvern_idle_separado`); levantar voo da rocha ainda não existe |

## Sangue (VFX sem corpo)

| Efeito | Quadros |
|---|---|
| Poça surgindo | 6 |
| Espinho da erupção | 6 |
| Projétil | loop 4 + impacto 4 |
| Bolha do escudo | loop 6 + quebra 6 |

## Carrasco

| Animação | Quadros | Situação hoje |
|---|---|---|
| Morte | 6–8 | 4 poses (suficiente, mas curta) |
| Corrida frente / costas | 8 + 8 | só lateral |
| Arena própria | cenário | **não existe**; usa o Campo de Provação procedural (colunas e braseiros) |

## Goblin, orc e wyvern selvagem

4 poses por ação. Ajudariam: ataque com 6 poses (2 de antecipação), reação de bloqueio do orc (2) e 8 quadros de voo para a wyvern.

## Sêlun

Pacote completo integrado (ver [SELUN.md](SELUN.md)). Faltam apenas: retrato de busto do Apollon para a ressurreição (hoje: avatar isolado), áudio próprio e, se desejado, um clone corporal para os Ecos (hoje: VFX fantasma).

