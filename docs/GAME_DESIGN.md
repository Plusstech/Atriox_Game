# Game Design — v0.2

**Atriox Cinder: Lâmina sem Deus.** Roguelite de ação 2D top-down oblíquo para navegador desktop (Phaser 3.90, WebGL, resolução interna 1280×720, escala FIT, zoom da câmera 1,1).

## Sequência da partida (8–12 min)

1. **Campo de Provação (preparação)**: tutorial compacto e recolhível (H) e bonecos de treino. **E** no altar abre as portas.
2. **Portas**: cada uma mostra o tipo de recompensa **antes** da escolha:
   - ☀ **Dom de Apollon**
   - ✦ **Bênção**
   - ♥ **Vitalidade** (+20 de vida máxima e cura completa)
3. **Primeira Provação**: recrutas e atiradores. A saída fica bloqueada até o fim do combate; depois, a recompensa da porta escolhida surge no centro.
4. Portas → **Segunda Provação** (guardiões).
5. Portas → **Câmara do Carrasco** (miniboss de 2 fases, mantido da v0.1).
6. Portas → **Arena de Nemeia**: **Caim Morvaigne**, com sangue e wyverns.
7. **Vitória → Apollon abençoa Atriox** (cena que pode ser pulada) → **Bênção da Glória** (permanente) → resultado.

Ao trocar de sala, perigos, projéteis, poças e invocações são removidos.

## Controles

| Entrada | Ação |
|---|---|
| WASD / setas | Mover (diagonais normalizadas) |
| Mouse | Mirar |
| Clique esquerdo | Combo de 3 golpes (um clique = um golpe; segurar não repete) |
| Clique direito | Chama do Julgamento |
| Espaço / Shift | Dash (2 cargas) |
| Q | Juízo do Segundo Sol (dom) |
| F | Avatar de Apollon (dom, Glória cheia) |
| E | Interagir (altar, portas, recompensa); pular a cena final |
| H | Recolher/expandir o tutorial |
| Tab (segurar) | Atributos, dons e bênçãos |
| Esc | Pausa (também ao perder o foco da janela) |
| F3 (dev ou `?perf`) | Sobreposição de desempenho |

## Atriox — estados e transições

Estados explícitos: `idle`, `run`, `attack_1–3` (+ `attack_3_glory`), `dash` / `dash_radiant`, `cast` / `cast_sun`, `avatar`, `hurt`, `bloodStunned`, `dead`, `cinematic`.

Prioridade de escolha, a cada quadro: cinemática > dominado > avatar > dash > dano > conjuração > golpe > recuperação do dash > corrida/idle.

- A corrida não interrompe golpes; o golpe não reinicia com o botão segurado.
- A corrida mantém o progresso do ciclo enquanto o estado continua `run`. A cadência é proporcional à velocidade real (0,55×–1,25×).
- Movimento: 285 px/s; aceleração 3600 e desaceleração 4200 px/s² (≈80 ms até a velocidade máxima).
- O collider é um círculo de 16 px nos pés. O corpo visual fica separado (sprite com origem fixa nos pés). A profundidade é a coordenada y dos pés.
- O sprite só é **espelhado**, nunca girado para mirar.

## Combo (`src/data/attacks.ts`)

| Golpe | Dano | Antecipação / ativo / recuperação (ms) | Alcance / arco | Hitstop |
|---|---|---|---|---|
| Corte rápido | 12 | 70 / 90 / 180 | 104 px / 120° | 45 ms |
| Corte de retorno | 14 | 85 / 100 / 200 | 118 px / 190° | 55 ms |
| Finalizador | 30 | 180 / 110 / 380 | 140 px / 150° | 95 ms + tremor |

- **Buffer de 120 ms**: um clique só entra se faltar ≤ 120 ms para o ponto de encadeamento. Cliques mais cedo ficam 120 ms no buffer do Player e expiram.
- **Reset**: 260 ms após o fim de um golpe.
- **Cancelamento por dash**: só na antecipação e na recuperação, nunca na janela ativa (o dash fica no buffer até ela terminar).
- Pequeno avanço nos golpes (26–64 px), respeitando colisões. A direção é travada no início do golpe.
- Dano no início da fase ativa (marcador `hit`), **1 acerto por alvo por golpe**.
- O hitstop só ocorre no impacto confirmado. Som de golpe (no swing) e som de impacto (no acerto) são distintos.

## Dash

- **2 cargas**; cada carga recarrega em 950 ms (em sequência, por tempo de jogo).
- Intervalo mínimo de 110 ms entre dashes; a repetição de tecla não consome cargas.
- 200 px em 170 ms. Invulnerabilidade de 150 ms (≤ duração), seguida de 60 ms de recuperação.
- Direção pelo movimento atual; **parado, segue a direção para onde Atriox olha**.
- Não atravessa paredes nem pilares. Afterimages discretos.

## Caim Morvaigne e o sangue

**IA**: `reposition` (mantém 210–350 px, alterna lados) → `windup` → `cast` → `recovery`, além de `reaction` (dano acumulado ≥ 60) e `dead`.

| Ação | Descrição |
|---|---|
| **Poça** | No jogador (ou ao redor, se não couber). Anúncio de 0,95 s com anel tracejado, depois ativa por 6,5 s. |
| **Erupção** (fase 2) | 3 poças em triângulo ao redor de Atriox, com o centro livre. |
| **Garra** | Setor de 118 px, 14 de dano, com telegraph. |
| **Salto** | Reposicionamento longe do jogador; invulnerável durante o salto. |
| **Invocação** | Até 2 wyverns (3 na fase 2), sempre a ≥ 300 px de Atriox. |

Fase 2 a 50% de vida: mais poças (4), recargas e reações mais curtas.

**Limites das poças**: no máximo 3 ativas (4 na fase 2) e distância mínima de 230 px entre centros, o que garante chão seguro.

**Dominação**:

| Parâmetro | Valor |
|---|---|
| Exposição até a dominação (contínua) | 1,15 s |
| Esvaziamento fora do sangue | 0,9 s |
| Duração do stun | 1,5 s |
| Imunidade depois do stun | 2,6 s |

- A exposição aparece no anel ao redor dos pés e no HUD.
- **Dash**: a invulnerabilidade do dash não acumula exposição (atravessar a poça é seguro). A invulnerabilidade pós-dano **não** protege.
- Durante o stun, Atriox não age e os comandos são descartados na entrada e na saída. Dano ainda o atinge, mas com empurrão reduzido.

## Wyverns

- `materialize` (0,75 s, intangível) → `fly` (órbita de 250–360 px, 1,6–2,8 s) → `windup` (0,7 s; direção trava em 55%, corredor vermelho no chão) → `charge` (470 px a 880 px/s; para em paredes) → `recovery` (1,0 s, baixa, vulnerável).
- 60 de vida; 13 de dano. Hitbox de 30 px no chão, sob a sombra, independente das asas.

## Dons de Apollon (portas ☀)

| Dom | Categoria | Efeito |
|---|---|---|
| Lâmina da Glória | Combo | O finalizador lança uma meia-lua solar: 22 de dano, 760 px/s, alcance 480, atravessa (1 acerto por alvo). |
| Juízo do Segundo Sol | Magia (Q) | Marca a área no cursor (≤ 460 px). O pilar cai 0,6 s depois da conjuração: 42 de dano em raio de 92 px. O indicador é exatamente a área de dano. Recarga de 7 s. |
| Ímpeto Radiante | Mobilidade | Dash radiante: rastro solar (10 de dano, 1× por alvo); purifica o sangue cruzado por 1,5 s. Invulnerabilidade inalterada. |
| Avatar de Apollon | Especial (F) | Recurso **Glória** (+3 por acerto, +10 por abate; começa em 50%). Cancela golpe ou magia em andamento. Durante os 2,3 s **o tempo dos inimigos para**: IA, wyverns, chefes, poças e projéteis inimigos congelam, e golpes inimigos em curso são anulados. Feixe horizontal (620×180 px, 26 de dano a cada 180 ms por 0,9 s) e, no fim, explosão solar ao redor de Atriox (raio 300, 50 de dano). Invulnerável durante o especial e por 0,9 s depois. |

As 6 bênçãos experimentais da v0.1 continuam nas portas ✦.

## Final — Apollon abençoa Atriox (proposta narrativa)

1. Morte de Caim confirmada: câmera lenta; hitboxes, projéteis, poças e wyverns encerrados.
2. 2,6 s depois começa a cena: o controle trava, a câmera aproxima (zoom 1,6) e os 6 quadros entram em crossfade.
3. No 3º quadro aparece a citação: *"O que fazes em vida ecoa na eternidade."*
4. O jogador pode **pular** depois de 1,5 s (E, Espaço, clique ou Esc).
5. Ao final concede a **Bênção da Glória**: salva no `localStorage`, **concedida uma única vez** (as vitórias seguintes mostram "já concedida"). Efeito: o dash passa a purificar o sangue por 4 s em todas as partidas seguintes.

## HUD

- Vida com rastro de dano, 3 losangos do combo e barra de Glória.
- 2 cargas de dash com anel de recarga; magia, Q e F com estado bloqueado, recarregando ou pronto.
- Ícones de bênçãos e dons; nome e barra do chefe no topo, com marca de fase.
- Exposição e "DOMINADO PELO SANGUE".
- Títulos de sala breves no topo; avisos temporários acima do HUD inferior; nada fixo no centro.

## Desempenho medido

| Cenário | Ambiente | FPS | Quadro p50 / p95 / máx |
|---|---|---|---|
| Preparação, correndo | Chrome com GPU (RTX 4060, DPR 1, 1280×720) | 180 (teto do monitor) | 5,5 / 6,0 / 7,3 ms |
| Caim + 2 wyverns + sangue (~100 partículas, ~77 objetos) | Chrome com GPU (RTX 4060, DPR 1, 1280×720) | 180 | 5,6 / 6,0 / 6,3 ms |
| Mesmos cenários | Headless com renderização por software (SwiftShader) | 19–38 | — |

- No headless, o delta limitado (50 ms) desacelera o tempo de jogo, sem saltos.
- O delta é limitado a 50 ms (volta de aba) e aplicado uma única vez. Hitstop e câmera lenta escalam o tempo lógico; tweens acompanham.
- Emissores de partículas têm frequência baixa e `maxParticles` nos ambientes. Texturas são geradas uma vez por tema.
- 3 reinícios seguidos mantêm 70 objetos e listeners idênticos; heap de cerca de 60 MB.
