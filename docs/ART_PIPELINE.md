# Pipeline de arte — Atriox Cinder (v0.2)

## 1. Folhas de origem (`art_source/v02/`)

| Arquivo | Conteúdo | Dimensões | Alpha | Grade real | Orientação original |
|---|---|---|---|---|---|
| `atriox_run.png` | Atriox correndo | 1448×1086 | sim | 4×3 = 12 | esquerda |
| `atriox_combat.png` | dash, golpes, stun por sangue | 1402×1122 | sim | 4×4 = 16 | mista (por quadro) |
| `atriox_solar.png` | 4 habilidades solares | 1428×1102 | sim | **5 + 4 + 4 + 4 = 17** (crescente solto na 1ª linha) | mista |
| `apollon_blessing.png` | Apollon abençoa Atriox | 1536×1024 | sim (brilho de fundo com alpha baixo) | 3×2 = 6 | — |
| `caim_blood.png` | conjuração, dominação, invocação | 1448×1086 | sim | 4×3 = 12 | frontal |
| `caim_move.png` | corrida, garras, salto (folha extra, não listada no pedido) | 1536×1024 | sim | 6×4 = 24 | direita |
| `wyvern.png` | voo, investida, materialização | 1448×1086 | sim | 4×3 = 12 | esquerda |
| `../atriox_concept_sheet.png` | concept original (v0.1) | 1536×1024 | **não** | 3×2 | — |

**Achados da auditoria:**

- Todas as folhas da v0.2 têm canal alpha real. As auréolas vermelhas e amarelas vistas em pré-visualizações são pixels com alpha 1–7 e cor saturada. Elas somem sobre qualquer fundo e são zeradas no pipeline (alpha < 8 = 0). **O preto não é removido**, porque contornos e roupas escuras são preservados.
- Os efeitos semitransparentes (halos, rastros, arcos) são preservados. Só o ruído abaixo de 8 é descartado.
- A grade nominal **não é confiável**:
  - na folha solar, a 1ª linha tem 5 peças;
  - arcos de golpe cruzam a divisão entre linhas (combate 5, 9 e 10);
  - o selo vermelho do quadro 14 invade a célula de cima;
  - na wyvern, as asas atravessam células.

## 2. Pipeline reproduzível

```bash
python tools/sheet_frames.py     # (opcional) pranchas de inspeção com os recortes: art_source/v02/_inspect/
python tools/build_atlases.py    # gera public/assets/atlas/characters-*.webp + characters.json
```

1. **Recorte** (`tools/sheet_frames.py`):
   - Cortes de grade adaptativos, nos "vales" de densidade perto das linhas nominais.
   - Cada componente conectado pertence ao quadro que contém ≥85% da sua massa, inteiro, mesmo ultrapassando a célula.
   - Componentes realmente fundidos entre quadros (ponta de arco tocando a espada vizinha) são separados por erosão até a "ponte" romper, e cada pixel volta ao pedaço mais próximo (estilo watershed).
   - Exceção manual: a linha 0 da folha solar usa um corte vertical em x=712, porque o arco do corte solar sobrepõe o corpo do quadro seguinte.
   - Lascas pequenas e distantes do corpo principal são descartadas.
2. **Orientação**: todos os quadros são espelhados para olhar à **direita**, com tabela por quadro. O jogo espelha conforme a direção.
3. **Escala por folha, pela altura do corpo**:
   - A altura é medida sem efeitos (dourado e sangue saturados), sem a lâmina (metal pouco saturado) e sem halos semitransparentes, em quadros de referência em pé.
   - A corrida não tem quadro em pé, então usa a mediana × 0,92.
   - Uma explosão grande **não** encolhe o personagem.
4. **Pivô nos pés**: x = mediana do torso (25–65% da altura do corpo); y = percentil 99,6 do corpo (botas). A wyvern usa pivô no centro do corpo, porque voa sobre a sombra.
5. **Fonte fixa por personagem**: cada personagem tem um `sourceSize` único com o pivô no mesmo ponto. Os quadros são aparados (trim) e o `spriteSourceSize` guarda o deslocamento. Resultado: a **origem do sprite é constante** e trocar de quadro nunca teletransporta o personagem.
6. **Ciclo da corrida ordenado pela pose das pernas**: compara silhuetas da metade inferior ancoradas no pivô e busca o ciclo fechado de menor diferença (vizinho mais próximo + 2-opt). A ordem fica em `meta.atrioxRunOrder`.
7. **Multi-atlas WebP** (alpha sem perdas, cor q=90): 2 páginas ≤ 2048 px, cerca de 2,7 MB no total (o PNG equivalente teria 11,8 MB).

As pranchas `art_source/v02/_inspect/atlas_*.png` mostram cada quadro com o pivô marcado.

## 3. Animações montadas (`src/data/animations.ts`)

| Animação | Quadros | Observação |
|---|---|---|
| `atriox.idle` | combate 07 | Pose única + respiração de ±1% (movimento secundário discreto). |
| `atriox.run` | 12 da corrida, na ordem calculada | 72 ms por quadro (≈14 FPS) × velocidade real/máxima; não reinicia enquanto o estado continua `run`. Marcadores de passo em 2 pontos do ciclo. |
| `atriox.attack_1` (corte rápido) | 08 → **06** → 06, 07 | Arco horizontal pintado no quadro 06. |
| `atriox.attack_2` (retorno) | 03 → **09**, 10 → 11 | Arco ascendente. |
| `atriox.attack_3` (finalizador) | 04 → **05** → 05, 03 | Diagonal pesada. |
| `atriox.attack_3_glory` | solar 00 → **01** → 02 | Com Lâmina da Glória: o crescente (`fx_solar_crescent`) vira projétil. |
| `atriox.dash` | 01 → 02 → 00 | Impulso, deslocamento com linhas de velocidade, aterrissagem. |
| `atriox.dash_radiant` | solar 09 → 10 → 11 → 12 | Ímpeto Radiante. |
| `atriox.cast` / `cast_sun` | solar 05 → 06 (→ 08) | Chama do Julgamento / Juízo do Segundo Sol. |
| `atriox.avatar` | solar 13 → 14 → 15 → 16 | Avatar de Apollon (o avatar está pintado junto com Atriox). |
| `atriox.hurt` | combate 12 | |
| `atriox.bloodStunned` | combate 13, 15, 14, 15 (loop) | Sangue envolvendo Atriox. |
| `caim.run` | movimento 00–05 | |
| `caim.claw` | movimento 12, 13 → **14** → 11 | |
| `caim.blink` | movimento 18–22 | |
| `caim.pool` / `eruption` / `summon` | sangue 01–04 / 05–07 / 08–11 | |
| `wyvern.materialize` / `fly` / `windup` / `charge` / `recovery` / `dissolve` | 08–11 / 00–03 / 07, 06 / 05 / 04, 11, 00 / 10, 9, 8 | |
| `apollon.blessing` | 6 quadros compostos | Crossfade em duas camadas, luz aditiva, zoom da câmera. |

Os ataques são **sincronizados**: o `ComboController` define windup, active e recovery, e a animação escolhe o quadro pela fase. O quadro de impacto (marcador `hit`) só aparece na janela ativa, junto com a hitbox.

## 4. Limitações reais (honestas)

- **Corrida**: os 12 quadros são muito parecidos. A variação está nos joelhos, no pé de trás e no cabelo. O ciclo lê como passada contínua, mas **não** tem as quatro poses clássicas (contato, compressão, passagem, impulso) bem separadas. Não declaro a corrida "fluida de verdade": ela é contínua e sem reinício, com variação limitada.
- **Uma direção por animação**: só há vistas laterais em 3/4. Andar para cima ou para baixo usa a mesma corrida lateral, espelhada pelo componente horizontal. **Não há 8 direções.**
- **Golpes com 1 quadro de impacto**: cada ataque tem 1 a 2 quadros-chave por fase, não um ciclo de 5 a 7 quadros. O impacto lê bem; a transição entre antecipação e impacto é um corte, e não um arco contínuo de braço.
- **Efeitos pintados nos quadros**: os arcos dourados (combate 05, 06, 09, 10; solar 01) e as linhas de velocidade fazem parte dos sprites. Por isso o renderer **não** desenha arcos extras para Atriox. A desvantagem é que a cor e o tamanho do arco não podem ser ajustados por golpe.
- **Avatar de Apollon pintado junto com Atriox** (solar 14 e 15): não dá para separar corpo, avatar e feixe. O feixe só sai na horizontal (direita ou esquerda).
- **Pilar do Juízo do Segundo Sol**: o pilar pintado no solar 07 está colado ao corpo de Atriox. O pilar no alvo é um feixe procedural (`beam`), e o quadro 07 não é usado.
- **Bênção**: os 6 quadros são composições completas (Atriox + Apollon). A cena usa crossfade, sem animação intermediária.
- **Caim**: a folha de sangue é frontal e a de movimento é em 3/4. A troca entre elas é perceptível.
- **Wyvern**: 4 quadros de voo dão uma batida de asas curta. Na investida, o quadro 05 é estático durante o deslocamento.
- **Morte**: não há quadros de morte. Atriox usa o quadro 12 com queda e escurecimento; Caim usa sangue 08 com dissolução.

## 5. Quadros adicionais necessários (prioridade)

Formato recomendado: o **mesmo enquadramento e a mesma escala** das folhas atuais, fundo transparente, personagem olhando para a **direita**, pés na mesma linha de base em todos os quadros.

| Personagem | Animação | Quadros | Prioridade |
|---|---|---|---|
| Atriox | corrida lateral com contato, compressão, passagem e impulso bem distintos | 8 | **Alta** |
| Atriox | corrida de frente e de costas | 8 + 8 | **Alta** |
| Atriox | cada golpe: 2 de antecipação, 2 ativos, 2 de recuperação, **sem o arco pintado** (arco em camada separada) | 6 × 3 | **Alta** |
| Atriox | idle respirando | 6 | Média |
| Atriox | morte | 6 | Média |
| Atriox | Avatar: corpo e avatar de Apollon em camadas separadas; feixe separado | 3 + 4 + 4 | Média |
| Caim | idle, corrida e dano na mesma vista 3/4 da folha de movimento; conjurações em 3/4 | 6 + 8 + 2 + 8 | Média |
| Caim | morte | 6 | Média |
| Wyvern | ciclo de voo de 8 quadros; investida em 3 quadros | 8 + 3 | Média |
| Apollon | bênção com Atriox e Apollon em camadas separadas | 6 + 6 | Baixa |

## 6. Inspetor de animações (desenvolvimento)

Acesse por `npm run dev` → menu → **Inspetor de animações**, pela URL `?inspector` ou pelo painel F2 → "inspetor de animações".

| Tecla | Ação |
|---|---|
| ←/→ | personagem |
| ↑/↓ | animação |
| Espaço | play/pause |
| `,` / `.` | quadro anterior / próximo |
| `+` / `-` | velocidade |
| B | fundo claro/escuro (conferir transparência) |
| P | pivô e bounds |
| C | collider nos pés |
| H | hitbox do golpe na fase ativa |
| X | espelhar |

Os ataques tocam com as durações reais do combo.

## 7. Substituir por arte definitiva

1. Coloque a nova folha em `art_source/v02/` e ajuste `SHEETS` (organização), `CHARS` (quadros usados, espelhamento e referência de escala) e, se preciso, `PIVOT_FIX` em `tools/build_atlases.py`.
2. Rode `python tools/build_atlases.py` e confira `art_source/v02/_inspect/atlas_*.png`.
3. Ajuste a lista de quadros em `src/data/animations.ts`. Os testes (`npm test`) verificam que todo quadro referenciado existe no atlas.

## 8. v0.5 — pacote PROMPT_MASTER (`tools/build_v05_atlas.py`)

```bash
python tools/build_v05_atlas.py   # anexa páginas v05-*.webp, retratos e arenas (idempotente)
npm run atlas                     # reconstrói tudo: v0.2 → v0.3 → v0.4 → v0.5
```

- Fontes intactas em `art_source/v05/` (nomes do pacote). Pranchas de inspeção com pivô: `art_source/v05/_inspect/atlas_*.png`.
- Recorte por grade refinada + posse de componentes; `split_all` (opcional por folha) continua a erosão até separar uma figura por célula quando lâminas encadeiam várias poses.
- Escala pelo **corpo**: Toknar e Caim pela mesma medida usada no atlas (sem metal e efeitos), para combinar com os quadros existentes; Carrasco, goblin, orc e wyvern selvagem pela silhueta opaca de quadros em pé (armadura de aço não pode ser excluída como "metal").
- Pivô nos pés; wyvern e VFX pelo centro (VFX pelo centro da célula, para o desenho ficar onde foi feito).
- Personagens existentes crescem o canvas quando preciso (Toknar 650×400 → 650×429), deslocando os quadros antigos; a reexecução desfaz e refaz (meta `v05Base`).
- Finalizador diagonal do Atriox entra no pipeline v0.4 (512×512). Recorte explícito documentado: a ponta da lâmina vizinha é apagada no quadro 06; o quadro 05 fica fora da animação.
- Retratos: `public/assets/portraits/*.webp` (440 px de altura). Arenas: `public/assets/arenas/*.webp`. Ambos entram na revisão de cache do atlas (`vite.config.ts`).
- Pendências de arte: [ASSETS_PENDENTES.md](ASSETS_PENDENTES.md).

