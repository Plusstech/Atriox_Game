# Sêlun — O Fim do Infinito

Implementação de [PROMPT_SELUN.md](PROMPT_SELUN.md). Sêlun é o **GAME OVER** do Infinito (Provação da Eternidade): invencível, aparece **imediatamente após concluir o nível 10** e termina toda tentativa com a Última Palavra. Apollon revive Atriox com bênçãos permanentes.

## Fluxo

1. Concluir o nível `SELUN.triggerWave` (10) do Infinito → em vez do nível 11, a arena do Sêlun (`arena_selun`). Gatilho único (`selunTriggered`); depois dele não existe nível seguinte nem porta.
2. Conversa (arena pausada): primeira vez "O infinito termina onde eu estou." / "Então eu atravesso você." / "Você confunde retorno com vitória."; reencontros: "O sol voltou a remendar você."
3. Banner na primeira entrada: há um fim inevitável e Apollon pode trazer Atriox de volta.
4. Luta de até 180 s de **combate ativo** → **Última Palavra** (contagem de 5 s) → execução que ignora defesas e invulnerabilidade.
5. Qualquer morte real no encontro → uma única transição terminal → **GAME OVER / SÊLUN** com resumo (tempo, fase, quebras, recomposições, esquivas perfeitas, recordes) → **Apollon** → escolha de bênção → **Refúgio** (vida cheia) → "Provação da Eternidade — nível 1" ou menu.

## Combate

| Técnica | Leitura | Consequência |
|---|---|---|
| Horizonte Partido | aviso 0,65 s; direção trava a 62% | corte de 175 px + onda em linha (corredor lateral); mesmo grupo de acerto |
| Sentença do Abismo | marca segue o jogador até 0,45 s antes; aviso 0,9 s | impacto, anel expansivo (atravessável) e zona central de 2,2 s |
| Decreto do Fim (fase ≥ 2) | aponta e canaliza 1,2 s | 2 (fase 2) ou 3 (fase 3) sequências de fendas paralelas anunciadas; vãos de 104 px e uma faixa omitida; recuperação de 1,4 s |
| Passo do Carrasco | 3 poses de entrada, loop de 4, freio de 3; corredor marcado | atravessa até a parede; na fase 3 encadeia Horizonte com novo aviso |
| Tributo ao Silêncio (fase 3) | canal de 2,5 s com barra no HUD | quebrar postura interrompe; completar dispara raios com cunhas seguras |
| Ecos de Execução | 1 eco (fase 2), até 2 (fase 3), 0,7 s de intervalo | repetem a geometria registrada, com aviso; VFX fantasma (sem clone corporal) |
| Peso do Fim (fase 3) | círculos anunciados 0,7 s | −20% de movimento por 3 s; esquiva e comandos continuam |
| Última Palavra | 180 s de combate ativo; contagem de 5 s | única técnica que ignora defesa; só começa com Sêlun livre e o jogador fora de recuperação/stun/Avatar |

- **Relógio**: só conta em combate (idle/golpe/postura/canalização). Pausa, diálogo, transição de fase, queda aparente, recomposição, Avatar (tempo parado) e a própria contagem não contam.
- **Fases por tempo**: 0–45 s, 45–100 s, 100–180 s. Dano alto nunca pula para a execução.
- **Manifestação** (900): ao zerar, hitboxes desligadas, queda aparente (1,7 s) e recomposição (1,7 s) com vida cheia. Evento próprio (`fallen`/`recomposed`) — nunca "chefe derrotado", loot ou avanço.
- **Postura** (220): quebra fora de transições/queda/execução; 2 s de janela sem ataques (+30% de dano), interrompe canalização e remove perigos pendentes; depois 3 s de proteção ("postura protegida" no HUD).
- **Dano**: 16–28 por acerto (2–4 erros graves com 100 de vida); teto de 65% da vida máxima por evento; espada, rastro e chão do mesmo golpe compartilham um **grupo de acerto** (uma vez a cada 450 ms).
- **Diretor**: um golpe por vez (combos de 1/2/3 por fase, cada um com aviso); Decreto e canalização nunca no mesmo combo; gravidade só sem Decreto ativo.

## Bênçãos de Apollon (persistentes neste save)

| Bênção | Por nível | Máx. |
|---|---|---|
| Coração Solar | +8% vida máxima base | 5 |
| Lâmina do Amanhecer | +6% dano base | 5 |
| Passo da Aurora | −4% recarga base da esquiva | 5 |
| Vontade Inquebrável | +10% dano de postura (Carrasco, Toknar, Sêlun) | 5 |
| Pele de Luz | +3 p.p. de redução de dano (teto global 60%) | 5 |
| Memória da Dor | esquiva perfeita: +5% de dano por 4 s (renova, não acumula) | 5 |
| Centelha de Retorno | esquiva perfeita: cura 1% da vida (recarga 8 s) | 3 |

- Primeira derrota: Coração Solar, Lâmina do Amanhecer e Passo da Aurora. Depois, até 3 elegíveis sorteadas; nunca uma no máximo; menos de 3 elegíveis mostram só as restantes.
- Concessão exige morte no encontro ativo, ID único de tentativa e **≥ 20 s de combate ativo ou ≥ 1 quebra**. Caso contrário: só a **Brasa de Apollon** (+10% de postura na próxima tentativa, não acumula). Todas no máximo: Brasa a cada derrota + aviso de conjunto completo. Nunca os dois prêmios.
- Aplicadas uma vez por tentativa **a partir dos valores-base** (`blessingModifiers`), em qualquer partida.
- "Esquiva perfeita" = a detecção já existente de esquiva precisa (atravessar uma hitbox inimiga ativa no início do dash).

## Persistência (`save.data.selun`, schema 1)

`blessings`, `records` (melhores tempo/quebras/recomposições/esquivas/fase, derrotas), `seenIntro`, `attemptId`, `lastGrantedAttempt`, `pending` (opções congeladas), `ember`, `eternityUnlocked`.

- Morte: recordes + etapa pendente gravados juntos (`selunRecordDeath`, idempotente).
- Recarregar durante GAME OVER/escolha: o Boot reabre a **mesma** escolha.
- Confirmar: nível (ou Brasa) + fechamento da etapa na mesma gravação (`selunConfirm`); repetir não concede.
- Abandonar, recarregar no meio da luta ou morrer para outros inimigos não gera prêmio.
- Saves antigos migram com padrões seguros; quem já venceu Caim/entrou na Eternidade tem o Infinito liberado no refúgio.

## Arte

Fontes em `art_source/v05/selun/` (originais intactos no pacote; usadas as revisões `*_alpha_revision` onde existem, porque as originais de recomposição, canalização e Decreto têm linhas de grade semitransparentes). Atlas por `tools/build_v05_atlas.py` com medida `thick` (a espada passa abaixo dos pés em várias poses: altura e pivô ignoram partes finas). Contagens conferidas: idle 4, corrida 8, golpes 8+8+8, investida 10, canalização 10, queda 8, recomposição 8, postura 4, dano 4, fúria 4; VFX 6+6+6 e fenda 8; 2 retratos; arena.

**Limites honestos**
- Sem áudio novo (o pacote não traz); usa a síntese existente.
- Apollon na tela de ressurreição usa o avatar isolado (não há retrato de busto do Apollon).
- Ecos usam VFX fantasma, não um clone corporal.
- Vista lateral espelhada, como os outros chefes; não há oito direções.

## Testes

- `tests/selun.test.ts` (18): fases pelo tempo, recomposição sem vitória, postura/canal/proteção, Última Palavra (espera o jogador, uma execução), precedência da morte, pausa, diretor, animações no atlas, ofertas e limites, atributos pela base, teto de 60%, persistência (idempotência, recarregar, Brasa, conjunto completo, sem encontro, migração).
- `tests/e2e/selun.mjs` (25): nível 9 não chama / 10 chama uma vez sem 11, conversa, HUD, aviso em vários quadros, queda e recomposição sem loot, postura, fase 2, Decreto, Última Palavra inevitável → GAME OVER, opções fixas, recarregar reabre a mesma escolha, concessão única, Coração Solar aplicado (108 de vida).
- Desempenho (RTX 4060): fase 3 a ~850 FPS sem limite, quadro p50 1,1 ms / p95 1,9 ms.

**Não testado por uma pessoa:** a luta completa de 180 s jogada manualmente e o balanceamento real.

Dev: F2 → "ir: Sêlun" (local). Capturas: `tests/e2e/screenshots/selun-*.png`.
