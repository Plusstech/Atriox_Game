# Sêlun — O Game Over do Infinito

Implemente este conteúdo no projeto existente do Atriox, roguelite de ação inspirado em Hades. Leia primeiro o código, identifique o motor, o combate, o fluxo do Infinito, os bosses Toknar e Caim, diálogos, persistência e pipeline de sprites. Adapte-se à arquitetura real. Este documento define o comportamento desejado; nomes de funções abaixo são conceituais. Entregue implementação funcional, não apenas um plano. Preserve os sistemas existentes e não adicione backend se o jogo não precisar dele.

## Regras obrigatórias

- Nome: **Sêlun**, título **O Fim do Infinito**. Ele é literalmente invencível e representa o **GAME OVER**.
- **Aparece imediatamente após concluir o nível 10 do Infinito**, antes de qualquer nível 11 normal. Substitui a ideia anterior de aparecer após o 15. Use um único parâmetro configurável, inicialmente 10, sem gatilhos duplicados.
- A primeira aparição é um encontro de chefe completo, com conversa, arena, fases, postura e ataques. Atriox consegue lutar, causar dano à manifestação e quebrar postura, mas jamais matar Sêlun definitivamente.
- Toda derrota real para Sêlun mostra GAME OVER e depois uma intervenção de **Apollon**, que revive Atriox com um novo buff. Não apagar o save, equipamentos ou progressão permanente.
- Proposta de fluxo adotada: GAME OVER encerra a tentativa; Apollon revive Atriox no refúgio, com vida cheia. O próximo Infinito começa no nível 1. Ao concluir novamente o 10, Sêlun retorna. Permitir voltar ao menu/refúgio após a bênção; nunca obrigar tentativas infinitas.
- Bênçãos de Apollon persistem entre tentativas neste save. Não conceder bênçãos por abandonar, recarregar, morrer para outros inimigos ou repetir o callback da mesma morte.
- Não criar vitória secreta, recompensa por matar Sêlun, porta do nível 11 nem texto dizendo que ele morreu. A luta mede resistência, domínio e feitos.

## Identidade e direção

Usar as artes anexadas: cavaleiro alto de armadura metálica verde-acinzentada, elmo de crânio com chifres claros voltados para cima, olhos âmbar, ombreiras espinhosas e espada longa estreita com guarda ornamentada. Sem capa. Não confundir com JDR, Atriox ou Toknar.

Movimento pesado, econômico e deliberado. Ele não fica frenético porque precisa se esforçar: a arena passa a obedecer à vontade dele. Paleta de aço frio, cinza escuro e âmbar. O dourado solar intenso pertence a Apollon. Efeitos sempre separados do corpo.

## Três golpes centrais e habilidades absurdas

Todos os valores são parâmetros iniciais ajustáveis, não números já existentes no projeto. Use dano proporcional à vida máxima apenas nos ataques indicados, respeitando os limites abaixo. Sinalizações devem continuar legíveis com efeitos reduzidos.

| Habilidade | Execução e leitura | Consequência |
| --- | --- | --- |
| Horizonte Partido — golpe 1 | Espada recua, quadril arma e corte horizontal avança. Travar direção antes do impacto; aviso inicial de 0,65 s. Rastro percorre a arena em linha, com corredor lateral para escapar. | Corte físico de alcance médio e onda separada. Um mesmo lançamento não pode acertar várias vezes por frame. |
| Sentença do Abismo — golpe 2 | Espada ergue, desce em diagonal e acerta o solo. Marca no chão fixa a posição-alvo 0,45 s antes de cair. Aviso total de 0,9 s. | Impacto e anel expansivo. Esquivar atravessa o anel; centro deixa uma zona perigosa temporária. Não preencher toda a arena. |
| Decreto do Fim — golpe 3 | Sêlun aponta para Atriox e canaliza. Fendas âmbar surgem em sequências anunciadas; cada uma conserva uma rota de escape. Aviso de 1,2 s. | Cortes dimensionais, até três sequências. Depois, recuperação visível. Sem perseguição instantânea da posição atual. |
| Passo do Carrasco — investida | 3 poses de preparação, 4 de deslocamento repetíveis, 3 de freio. Corredor marcado; direção trava antes da saída. | Atravessa a arena com espada; pode encadear Horizonte em fases avançadas, sempre com novo aviso. |
| Tributo ao Silêncio — canalização | Entrada, loop e interrupção. Canal de 2,5 s, com barra própria. | Prepara fendas adicionais. Quebrar postura interrompe e concede punição; completar dispara padrão evitável. |
| Ecos de Execução | Repete cortes antigos como VFX fantasma: 1 eco na fase 2, até 2 na fase 3, intervalo de 0,7 s. | Memória espacial: eco usa a posição/direção registrada, nunca mira de novo sem aviso. Reutilizar VFX separados, sem inventar uma folha de clone corporal. |
| Peso do Fim | Setores sinalizados recebem gravidade forte por 3 s; fora deles movimentação normal. | Redução de movimento limitada a 20%, sem desligar esquiva ou comandos. |
| Última Palavra | Aos 180 s de combate ativo, Sêlun finca a espada e inicia uma contagem inequívoca de 5 s. Apollon avisa que precisa retirar Atriox. | Execução narrativa inevitável ao concluir. Esta é a única técnica que ignora defesa e invulnerabilidade; conduz a GAME OVER e ressurreição. Pausas e diálogo não contam. |

A proposta é uma luta absurda com um fim inevitável conhecido pelo jogador. Durante os 180 segundos, cada ataque comum deve ser evitável. Não usar acertos invisíveis para simular dificuldade. A execução final nunca começa durante recuperação do jogador, diálogo ou transição; entrar em estado próprio, limpar perigos anteriores e preservar a contagem.

## Fases, dano e postura

Separar explicitamente vida da manifestação, postura e imortalidade. Não usar uma quantidade enorme de HP como substituto da invencibilidade.

- Manifestação tem vida finita para dar feedback aos ataques. Ao chegar a zero: desativar hitboxes, tocar queda aparente, recomposição e restaurar manifestação. Nunca emitir evento global de boss derrotado, loot ou avanço de andar. Cada recomposição conta como feito, sem parar o relógio de combate além da própria transição.
- Postura pode quebrar em qualquer fase fora de transições e execução. Janela inicial de 2 s; interrompe canalização e deixa causar dano à manifestação. Durante a janela, Sêlun não ataca. Ao recuperar, ganha 3 s de proteção contra nova quebra, com feedback discreto.
- Fase 1: início até 45 s. Horizonte, Sentença e investida isolados.
- Fase 2: 45–100 s. Transição de fúria, Decreto, primeiro eco, combinações de dois ataques.
- Fase 3: 100–180 s. Até dois ecos, setores de gravidade, combinações de três ataques e canalização. Sêlun pode recompor em todas as fases. Tempo decide a fase; dano alto não faz pular diretamente para a execução.
- Nunca executar simultaneamente todas as técnicas. Diretor de combate deve reservar espaço seguro e limitar perigos ativos. Telegrafia não pode ficar oculta por partículas.
- Dano de ataques comuns baseado no sistema existente, inicialmente calibrado para 2–4 erros graves. Um único evento não deve causar mais de 65% da vida máxima antes das defesas. Evitar dano duplicado entre espada, rastro e chão do mesmo golpe usando grupos de acerto e intervalo por alvo.
- Sem dreno permanente de atributos, roubo de equipamento ou desativação global das bênçãos.

## GAME OVER e ressurreição por Apollon

Sequência: morte real de Atriox → congelar dano e limpar projéteis → GAME OVER / SÊLUN → resumo de feitos → fala de Apollon → escolher 1 de 3 bênçãos → salvar concessão e estado de retorno atomicamente → refúgio com vida cheia.

Falas sugeridas, originais para esta implementação:

Sêlun, calmo: “O infinito termina onde eu estou.”
Atriox: “Então eu atravesso você.”
Sêlun, irritado: “Você confunde retorno com vitória.”
Apollon, primeira derrota: “Ele encerrou sua tentativa. Eu ainda não encerrei a sua história.”
Apollon, retorno: “Leve esta centelha. Faça-o sentir sua próxima passagem.”
Sêlun, reencontro: “O sol voltou a remendar você.”

O GAME OVER deve parecer pesado; a intervenção solar acontece depois e não o substitui por uma tela de vitória. Resumo: tempo sobrevivido, quebras de postura, recomposições forçadas, esquivas perfeitas e fase alcançada. Recordes são motivadores mesmo sem vitória possível.

## Bênçãos acumuláveis de Apollon

Na primeira derrota, oferecer obrigatoriamente Coração Solar, Lâmina do Amanhecer e Passo da Aurora. Depois sortear 3 opções distintas elegíveis. Cada seleção dá um nível à bênção. Exibir nível atual, efeito atual e efeito após escolha. Não apresentar opções já no máximo.

| Bênção | Efeito por nível | Limite |
| --- | --- | --- |
| Coração Solar | +8% de vida máxima base | 5 níveis; +40% |
| Lâmina do Amanhecer | +6% de dano sobre o dano base do personagem | 5 níveis; +30% |
| Passo da Aurora | −4% no tempo base de recarga da esquiva | 5 níveis; −20% |
| Vontade Inquebrável | +10% de dano de postura base | 5 níveis; +50% |
| Pele de Luz | +3 pontos percentuais de redução de dano | 5 níveis; +15 p.p.; respeitar teto global de 60% |
| Memória da Dor | Esquiva perfeita concede +5% de dano por 4 s por nível; renova duração sem acumular instâncias | 5 níveis; +25% |
| Centelha de Retorno | Após uma esquiva perfeita, curar 1% da vida máxima por nível; recarga interna de 8 s | 3 níveis; 3% |

Somar os níveis de cada bênção ao atributo base correspondente, não multiplicar o atributo já modificado a cada carga do save. Reaplicar a partir de valores-base para impedir duplicação. Esquiva perfeita significa atravessar uma ameaça real em janela definida pelo sistema; apertar esquiva fora de perigo não cura nem ativa dano.

Quando restarem menos de três bênçãos elegíveis, mostrar só as restantes. Quando todas estiverem completas, cada derrota ainda concede **Brasa de Apollon**, um buff temporário de +10% de dano de postura na próxima tentativa, sem acumular consigo mesmo. Informar que o conjunto permanente foi completado. Bênçãos não bloqueiam Última Palavra; Apollon retira Atriox após o fim, não mata Sêlun.

Evitar farm acidental: concessão exige morte dentro do encontro ativo, identificador único de tentativa e pelo menos 20 s de combate ativo OU uma quebra de postura. Caso morra antes, Apollon ainda revive com a Brasa temporária, sem nível permanente. Mostrar essa regra no resumo. Uma tentativa nunca concede ambos os prêmios. Os recordes e buffs não exigem vencer Sêlun.

## Artes anexadas e pipeline obrigatório

O ZIP inclui 19 artes originais e 10 revisões, com nomes descritivos. **Não presumir que os PNGs são atlas prontos.** Algumas folhas continuam com fundo opaco/degradê; revisões com “alpha_revision” não são garantia de transparência. Consulte GUIA_DAS_ARTES.md e inventario_artes.json para dimensões e medição de alfa. O teste de canal alfa é técnico e não comprova qualidade visual.

Antes de integrar, inspecionar visualmente todas as folhas, validar número de poses, grade, direção, espada completa, margens, escala e pivô. Extrair manualmente regiões quando necessário; não assumir células uniformes só pelo nome. Gerar manifesto de atlas com frame rect, pivô nos pés, duração e eventos separados dos pixels. Personagem olha à direita; espelhar para esquerda com pivô correto. Retratos já olham à esquerda e ficam à direita do diálogo.

Artes são referência visual lateral; o jogo é inspirado em Hades. Respeitar a câmera real do projeto e o sistema atual de bosses. Não transformar todo o jogo num platform fighter nem fingir que existem oito direções renderizadas. Reutilizar o tratamento direcional do Toknar/Caim; documentar limites.

Não remover preto por chroma key global: isso apagaria armadura e VFX. Se não houver maneira confiável de limpar um arquivo, registrar pendência, manter fonte e usar fallback explícito de desenvolvimento, sem declarar arte pronta ou esconder o fundo no cenário. Não redesenhar o personagem sem autorização.

## Animação e eventos de combate

- Idle 4 poses em loop; corrida 8; stagger 4 em loop; hurt 4; fúria 4; queda aparente 8; recomposição 8.
- Golpes de 8 poses: índices 0–2 preparação, 3 impacto, 4–5 continuação, 6–7 recuperação. Tornar duração independente da taxa de renderização. Iniciar hitbox no evento de impacto; se houver mais de um golpe, usar eventos explícitos, não dano a cada frame.
- Investida 10 poses: 0–2 entrada, 3–6 loop, 7–9 freio. Colisão/movimento físicos não dependem do sprite.
- Canalização 10 poses: 0–2 entrada, 3–6 loop, 7–9 interrupção/saída. Um estado controla se terminou ou foi interrompida.
- VFX horizontal/diagonal/chão de 6 poses; especial de 8. Ligar ao ataque por eventos, não embutir efeito na folha do corpo.
- Caso contagem real difira, corrigir o manifesto e apontar diferença; nunca inventar quadros existentes. Esses números são metas da arte solicitada.
- Encerrar todos os efeitos e colisores ao morrer, pausar, sair da arena ou mudar para ressurreição. Usar pooling já existente se houver.

## Arena e interface

Usar arena_selun.png, fonte 1536×1024. Centro livre, entradas nas bordas. Definir colisão e área navegável a partir do gameplay, sem inferir que toda decoração é obstáculo. Ajustar escala à câmera existente.

UI: nome Sêlun, título, barra de manifestação rotulada “Manifestação”, postura, fase e indicador discreto do tempo. Após primeira recomposição, comunicar “Sêlun se recompõe”. Primeira entrada informa que há um fim inevitável e que Apollon pode trazer Atriox de volta; não prometer vitória convencional. Última Palavra tem contagem e aviso próprios.

Manter opção de reduzir tremor, flashes e partículas. Não causar efeitos de tela que escondam área segura. Música e efeitos sonoros novos só se houver recursos licenciados no projeto; não alegar que áudio está no ZIP.

## Estados e persistência

Estados conceituais: entrada, diálogo, combate, stagger, canalização, transição, queda aparente, recomposição, execução final, morte do jogador, game over, escolha de bênção, retorno. Impedir corrida entre morte do jogador e recomposição de Sêlun: morte do jogador tem precedência, apenas uma transição terminal por tentativa.

Persistir versão do schema, bênçãos por ID estável, recordes, primeira conversa vista, identificador da tentativa e identificador da última concessão. Salvar escolha e conclusão da ressurreição juntas. Recarregar durante escolha deve reabrir a mesma escolha, com mesmas opções; recarregar após confirmar não pode conceder novamente. Se fechar antes de concluir a morte, restaurar a etapa pendente sem gerar prêmio novo. Migrar saves antigos preservando progresso, com defaults seguros.

Não chamar a lógica comum de derrota de boss quando a manifestação zera. Separar evento manifestation_broken do boss_defeated já existente. Combate em pausa não avança relógio, efeitos, cooldown ou contagem final.

## Entrega e validação

Implemente dentro do repositório real, forneça resumo de arquivos alterados, instrução de execução e pendências de arte. Faça testes relevantes:

1. Concluir nível 9 não chama Sêlun; concluir 10 chama uma vez e impede nível 11.
2. Zerar manifestação recompõe, mantém fase temporal e não libera vitória/loot.
3. Quebrar postura abre janela real, interrompe canal e remove ataque pendente.
4. Morte comum/Última Palavra produz um GAME OVER, uma escolha/concessão e retorno ao refúgio.
5. Recarregar em cada etapa não duplica bênçãos ou perde escolha.
6. Limites, poucas opções e todas no máximo funcionam; mortes rápidas concedem somente Brasa.
7. Defesas comuns funcionam; execução final continua inevitável e claramente anunciada.
8. Sem dano por frame repetido, hazards órfãos ou input travado após diálogo/retorno.
9. Conferir atlas e retratos em movimento, incluindo espelhamento e transparência; apontar arquivos pendentes honestamente.
10. Ajustar durações/dano ao ritmo real do projeto. Terminar com checklist do que funciona, o que foi testado e o que depende de arte.

Prioridade: identidade de Sêlun, combate legível e brutal, imortalidade real, GAME OVER seguido por Apollon, bênçãos persistentes e entrada após o nível 10. Não reduzir isso a um boss comum com muita vida.
