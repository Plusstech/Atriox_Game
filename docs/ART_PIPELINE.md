# Pipeline de arte — Atriox Cinder

## 1. Auditoria do asset fornecido

| Item | Resultado |
|---|---|
| Arquivo | `art_source/atriox_concept_sheet.png` |
| Formato | PNG, **RGB sem canal alfa** |
| Dimensões | 1536 × 1024 px |
| Fundo | Cinza-claro uniforme (~#F7F7F7) |
| Layout | Grade 3 × 2, células de 512 × 512 |
| Quadros por animação | **1** (concept sheet com poses-chave, não spritesheet) |
| Direções | Poses variam entre esquerda e direita. Não há vistas para cima/baixo. |
| Consistência | Alta: mesmo rosto, cabelo, armadura, tabardo roxo e espada em todas as poses |
| Alinhamento | Nenhum (cada pose em posição livre na célula) |

### Poses identificadas

| Célula | Pose extraída | Uso no jogo | Observação |
|---|---|---|---|
| (0,0) | `idle` | idle, retrato do HUD, menu | Espada baixa, brilho vermelho na mão (anel) |
| (1,0) | `lunge` | run, attack_1, preparação de attack_2/3 | Avanço com espada estendida |
| (2,0) | `slash` | ativo de attack_2 e attack_3 | Arco de fogo solar **pintado na pose** |
| (0,1) | `cast` | cast (Chama do Julgamento) | Esfera de luz na mão |
| (1,1) | `dash` | dash | Afterimages douradas **pintadas na pose** |
| (2,1) | `hurt` | hurt, death | Recuo ao receber golpe |

## 2. Extração (`npm run sprites`)

`tools/extract_sprites.py` (Pillow + NumPy + SciPy):

1. Divide a folha em 6 células.
2. Remove o fundo por **flood fill a partir das bordas** (tolerância 16 por canal) e, em algumas poses, também os "buracos" brancos fechados por efeitos de luz.
   - O núcleo branco do fogo do `slash` é **preservado**.
3. Aplica *color-to-alpha* numa faixa de 3 px na borda para remover o halo branco.
4. Descarta fragmentos de células vizinhas (pontas de espada que cruzam a grade).
5. Espelha as poses para que **todas olhem para a direita**. O jogo espelha conforme a mira.
6. Usa **um único fator de escala** (0,5) para todas as poses, preservando as proporções.
7. Calcula a **origem nos pés**: x = centro de massa dos pixels escuros (roupa e armadura), y = linha opaca mais baixa. O resultado vai para `public/assets/atriox/atriox_poses.json`.

## 3. Como a animação funciona hoje (provisória e honesta)

Com **um quadro por pose**, não existem frames de animação reais. Também **não** criamos falsos frames repetindo a mesma imagem. O `AtrioxAnimator` combina:

- **Pose-chave** por estado e fase do golpe (preparação, ativa, recuperação).
- **Transformações procedurais:** respiração (idle), balanço e bob (run), inclinação para trás na preparação, avanço e squash & stretch no impacto.
- **Crossfade** de 110 ms entre poses, com um sprite "fantasma".
- **Efeitos** separados: arcos de lâmina, afterimages do dash, faíscas, partículas, flash de dano.

Consequência: o personagem é reconhecível e legível em combate, mas a corrida e os golpes **não têm ciclo de pernas nem movimento de braço quadro a quadro**.

## 4. O que precisa ser produzido (prioridade)

Formato recomendado: PNG com transparência, células de **256 × 256** (ou 192 × 192), pés no mesmo ponto em todos os quadros (sugestão: x = 128, y = 240), personagem olhando para a **direita**, mesma escala do concept.

| Animação | Quadros mínimos | Direções | Prioridade |
|---|---|---|---|
| run | 8 | lado (espelhado). Ideal: + frente e costas | **Alta** |
| attack_1 (Corte Ascendente) | 5 (2 preparação, 1 ativo, 2 recuperação) | lado | **Alta** |
| attack_2 (Corte Cruzado) | 5 | lado | **Alta** |
| attack_3 (Julgamento da Lâmina) | 7 | lado | **Alta** |
| idle | 6 (respiração) | lado | Média |
| dash | 3 (entrada, deslocamento, saída) **sem** afterimages pintadas | lado | Média |
| cast | 5 (concentração → disparo) | lado | Média |
| hurt | 2 | lado | Média |
| death | 6 | lado | Baixa |
| Efeitos de lâmina separados do corpo | 3–4 por golpe | — | Média |

**Recomendação importante:** pinte os efeitos (arco de fogo, afterimages) **em camadas separadas** do corpo. O `slash` atual tem o arco embutido, o que impede reaproveitar a pose para outros golpes.

Inimigos e chefe precisam de arte definitiva com a mesma lógica: idle, andar, preparação, ataque, dano e morte.

## 5. Como substituir por arte definitiva

1. Coloque o spritesheet em `public/assets/atriox/`, por exemplo `run.png` com 8 quadros horizontais.
2. Em `BootScene.preload`, troque `load.image` por `load.spritesheet('atriox_run', 'run.png', { frameWidth: 256, frameHeight: 256 })`.
3. Em `AtrioxAnimator`, crie animações do Phaser (`scene.anims.create`) e, em `setPose()`, chame `sprite.play(...)` para os estados que tiverem quadros. As transformações procedurais podem ser zeradas por estado.
4. Os **estados, prioridades, fases de ataque e hitboxes não mudam**: a lógica de combate é independente da arte.

Texturas procedurais (inimigos, cenário, efeitos) são substituídas carregando um PNG com a **mesma chave** no `BootScene`. O `TextureFactory` não gera uma textura que já existe.

## 6. Painel de desenvolvimento

Com `npm run dev`, pressione **F2** (ou `` ` ``) para abrir o painel. Ele permite:

- forçar cada estado de animação;
- ajustar a escala do sprite e a velocidade das animações;
- exibir hitboxes, hurtboxes, origem e bounds do sprite;
- ativar o modo deus, matar inimigos, pular para o chefe e conceder bênçãos.

O painel **não é carregado** no build de produção. Para forçá-lo, use `VITE_DEV_TOOLS=true`.
