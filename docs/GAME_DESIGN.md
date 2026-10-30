# Game Design — Vertical Slice v0.1

**Atriox Cinder: Lâmina sem Deus.** Roguelite de ação 2D top-down oblíquo (2.5D) para navegador desktop.

## Loop da partida (5–10 min)

1. Menu → **Iniciar Provação**
2. **Preparação:** checklist de controles e dois bonecos de treino.
3. Altar central, **[E] Iniciar a Provação**.
4. **Primeira Provação:** 3 recrutas, depois 2 recrutas + 2 atiradores.
5. **Brasa de bênção** no altar → [E] → escolha 1 de 3.
6. **Segunda Provação:** 3 grupos com guardiões, atiradores e recrutas.
7. Nova bênção.
8. Os portões se abrem: introdução do **Carrasco da Provação**.
9. Fase 1 (Disciplina de Ferro) → 50% → Fase 2 (Fúria do Carrasco) + 2 reforços.
10. Vitória (câmera lenta, recompensa) ou derrota → **tela de resultado** → Enter para nova tentativa.

## Controles

| Entrada | Ação |
|---|---|
| WASD / setas | Mover |
| Mouse | Mirar |
| Clique esquerdo | Combo (cada clique = um golpe; segurar não repete) |
| Clique direito | Chama do Julgamento |
| Espaço / Shift | Dash |
| E | Interagir (altar, brasa de bênção) |
| Tab (segurar) | Atributos e bênçãos |
| Esc | Pausa e opções |
| 1 / 2 / 3 | Escolher bênção |

## Atriox

| Atributo | Valor |
|---|---|
| Vida | 100 |
| Velocidade | 285 px/s (aceleração 3400, desaceleração 3800 px/s²) |
| Invulnerabilidade após dano | 700 ms (pisca) |

### Combo (`src/data/attacks.ts`)

| Golpe | Dano | Prep. | Ativo | Recup. | Alcance / arco | Knockback | Extra |
|---|---|---|---|---|---|---|---|
| Corte Ascendente | 12 | 70 | 90 | 180 | 104 px / 120° | 150 | hitstop 45 ms |
| Corte Cruzado | 14 | 85 | 100 | 200 | 118 px / 190° | 180 | arco largo |
| Julgamento da Lâmina | 30 | 180 | 110 | 380 | 140 px / 150° | 460 | tremor, hitstop 95 ms, onda de choque |

- **Buffer:** um clique durante o golpe encadeia o próximo a partir de `chainFrom`.
- **Janela:** depois do fim de um golpe, há 260 ms para continuar o combo. Passado isso, volta ao golpe 1.
- **Cancelamento:** dash ou magia cancelam a preparação e a recuperação, **nunca** a janela ativa (o dash fica em buffer até ela terminar).
- **Mira assistida leve:** a mira gira até 70% em direção a um inimigo a menos de ~30° do cursor.

### Dash
190 px em 165 ms, invulnerável por 230 ms, cooldown de 620 ms. Atravessa ataques, mas não paredes nem pilares.

### Chama do Julgamento
Conjuração de 240 ms, cooldown de 3,2 s. O projétil (640 px/s, alcance 620) causa 14 de dano direto e explode em raio de 96 com 34 de dano.

## Inimigos (`src/data/enemies.ts`)

Máquina de estados: `idle → patrol → chase → windup → attack → recovery`, além de `hurt` e `dead`.

| Inimigo | Vida | Ataque | Telegraph |
|---|---|---|---|
| Recruta | 46 | Corte em setor (9 de dano) com avanço | Setor vermelho que se preenche (480 ms) |
| Atirador | 34 | Flecha (8 de dano). Mantém distância de 230–420 px e circula. | Linha de mira que pisca em branco no fim (650 ms) |
| Guardião | 150 | Esmagamento em área (18 de dano, raio 120). Tem *poise*: só sofre stagger com golpes ≥ 28. | Círculo que se preenche (950 ms) |

Os inimigos acompanham o jogador nos primeiros 60% da preparação e depois **travam a direção**, o que torna a esquiva justa.

## O Carrasco da Provação (`src/data/bosses.ts`)

Vida 1050 e *super armor* (não sofre stagger).

| Golpe | Fase | Dano | Forma |
|---|---|---|---|
| Golpe Frontal | 1–2 | 22 | Retângulo de 210 × 86 |
| Varredura Horizontal | 1–2 | 18 | Setor de 170 px / 220° |
| Investida | 1–2 | 20 | Corredor de 380 px; para ao bater em parede |
| Execução Ardente | **2** | 20 + anel 14 | Círculo de raio 150 + anel de fogo que se expande (desvie com dash ou distância) |

Na fase 2, a velocidade sobe para ×1,3, a recuperação cai para ×0,68 e a preparação para ×0,85. A transição dura 1,5 s com invulnerabilidade, rugido e aura, e chama 2 recrutas.

## Bênçãos (`src/data/blessings.ts`)

| Bênção | Efeito | Tipo |
|---|---|---|
| Lâmina Ardente | Golpes básicos queimam (6/s por 3 s) | gatilho `basicHit` |
| Sangue da Provação | +5 de vida por eliminação | gatilho `kill` |
| Passo do Julgamento | Cooldown do dash −35% | atributo |
| Fogo Persistente | A magia deixa área em chamas (16/s por 3 s) | gatilho `spellImpact` |
| Vontade Inquebrável | +40% de resistência por 3 s ao sofrer dano | gatilho `damaged` |
| Golpe Consagrado | O 3º golpe libera uma onda de luz (18 de dano) | gatilho `comboFinisher` |

As bênçãos são **somente dados**. `BlessingSystem` aplica os atributos e devolve ações, e um único executor (`ArenaScene.runBlessingAction`) as interpreta.

## Polimento

Hitstop por golpe, tremor de câmera, flash de dano, arcos de lâmina, faíscas direcionais, afterimages no dash, números de dano, sombras, selos de surgimento, câmera lenta no fim da onda e na morte do chefe, música procedural que acompanha a intensidade do combate.

**Acessibilidade** (opções no menu e na pausa): reduzir tremor, reduzir flashes, ocultar números de dano, partículas reduzidas e volumes.

## Persistência (`localStorage`, chave `atriox-cinder.save.v1`)

Salva configurações, tentativas, vitórias contra o Carrasco, maior onda e melhor tempo. Valores inválidos são sanitizados campo a campo. JSON corrompido ou armazenamento bloqueado caem para os padrões; nesse caso, o jogo continua e avisa no menu.
