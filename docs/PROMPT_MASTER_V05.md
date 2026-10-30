# ATRIOX CINDER — PROMPT MASTER DE CONTINUIDADE PARA CLAUDE

Você assume a implementação do jogo **Atriox Cinder: Lâmina sem Deus** no repositório existente. Este documento reúne as decisões desta conversa e acompanha todas as imagens geradas nela. Trabalhe no projeto real, implemente, teste e entregue a build. Não se limite a sugerir código ou produzir um plano.

Referência publicada: https://grey-antelope-524656.hostingersite.com/

## 1. Como começar

1. Leia as instruções do repositório, descubra motor, cenas, scripts, input, loop, física, renderer, recursos e build.
2. Leia `INVENTARIO_ASSETS.md` e `manifesto_assets.json` neste pacote. Os caminhos são relativos à pasta deste documento. Inspecione as imagens reais antes de escolher frames.
3. Compare com o código atual: algumas mecânicas podem ter sido implementadas após a conversa. Preserve o que funciona; não duplique sistemas.
4. Registre um plano curto por prioridades e execute. Não recrie do zero nem troque de motor sem necessidade concreta.
5. Se o repositório não estiver acessível, explique a ausência; não invente acesso nem declare mudanças implementadas.

O jogo deve continuar estático, compatível com Hostinger, sem backend ou banco obrigatório. Persistência local é suficiente. Prepare o deploy; não publique automaticamente.

## 2. Estado da evidência

Houve testes pelo navegador remoto nas versões v0.1 e v0.2. Confirmaram carregamento, entrada na preparação, deslocamento, dash, interação com altar, aparecimento das portas e abertura da pausa. A primeira sessão reconheceu comandos de combo e magia no tutorial, mas NÃO comprovou dano, balanceamento ou toda a sequência do combo. Não foi validada uma campanha completa, morte/reinício, vitória ou luta contra Caim. Em uma sessão, 15 segundos reais de W avançaram aproximadamente um segundo no relógio do jogo; houve timeout do controle remoto. A causa não foi isolada: medir localmente, não atribuir automaticamente ao jogo.

O jogador relata que Caim está fácil e os inimigos parecem genéricos. Aumentar diversidade e qualidade do combate é requisito. A aparência dos assets não equivale a funcionamento pronto.

## 3. Identidades e ordem dos encontros

**Ordem obrigatória: salas iniciais → Carrasco da Provação → salas → Toknar → salas → Caim → bênção de Apollon → opção de modo infinito.** Preserve salas intermediárias suficientes para montar a build.

- **Atriox:** cabelo prateado preso, rosto visível, orelhas pontudas, armadura dourada, tecido roxo e espada longa. As seis imagens individuais em `assets/referencias/atriox_*_original.png` são a referência principal.
- **Carrasco da Provação:** primeiro chefe, veterano do Campo de Provação. Humano enorme, capuz carmesim com face em sombra e olhos âmbar, placas de aço gastas, malha, tabardo vermelho com símbolo circular cruzado, correntes e machado de execução assimétrico. Use `carrasco_base.png`, não o desenho geométrico antigo.
- **Toknar:** orc enorme em fúria contra Atriox, verde, cabelo preto comprido, barba, presas, olhos vermelhos, couro e peito exposto. **Rhaesis** é o machado lendário com crânio/núcleo vermelho que drena sangue e o cura. Não confundir com o machado simples do Carrasco ou dos orcs comuns.
- **Caim Morvaigne:** humano pálido e angular, cabelo preto, sorriso sádico, casaco preto de gola alta e bordados dourados. Usa sangue, infecção, servidão e wyverns.
- **Apollon:** Sóbele da Glória e do Orgulho; emanação do Segundo Sol de Heytpaneh, criado por Celtêsius e Halliz. Armadura dourada, mantos brancos e roxos, cabeça solar e olhos luminosos, sem rosto humano. Intervenções de combate são um avatar/emanação temporário. Frase: “O que fazes em vida ecoa na eternidade.”

`assets/historico/atriox_elmo_DESCARTADO.png` é um erro de identidade: NÃO usar o guerreiro de elmo com chifres como Atriox. A cena original Atriox/Caim é referência narrativa; não substituir a identidade atual do herói por aquela armadura.

## 4. Catálogo prático das imagens

O inventário completo lista **41 imagens geradas + 11 referências originais**. Nada do histórico deve ser apagado. Prefira revisões após verificar qualidade; “revisão” não significa recorte final aprovado.

### Atriox

- `atriox_corrida_12.png`: grade pretendida 4×3, ciclo de 12 poses. Conferir alternância das pernas e continuidade.
- `atriox_combate_stun.png`: 4×4; dash, dois golpes e dominação pelo sangue, quatro poses por linha.
- `atriox_combo_1_revisao.png`: 4×2, horizontal rápido, oito poses.
- `atriox_combo_2_revisao.png`: 4×2, retorno no sentido oposto, oito poses.
- `atriox_combo_3.png`: 4×2, finalizador diagonal pesado, oito poses.
- `atriox_carga_revisao.png`: 2×2, quatro poses de carga EM PÉ.
- `atriox_sentenca_revisao.png`: 4×2, oito poses de corte ascendente.
- `atriox_tecnicas_avancadas.png`: 6×3; retorno, Sentença e Marca do Carrasco. VFX estão incorporados; usar como referência quando houver folha corporal melhor.
- `atriox_habilidades_solares_novas.png`: 6×3; Órbita da Lâmina, eco do Segundo Sol, Sol Cativo. VFX incorporados.
- `atriox_ataques_solares.png`: 4×4; meia-lua, pilar, dash solar, invocação. Não montar vários Atriox sobrepostos a partir da composição.

### Toknar

- `toknar_movimento_furia.png`: 4×4; idle4, corrida8 em duas linhas, ativação de fúria4.
- `toknar_combate_inicial.png`: 4×4; corte, giro, investida, cura; só quatro poses por ação. Base alternativa, não suficiente para congelar longas antecipações.
- `toknar_ceifa_revisao.png`: 4×2; oito poses: três antecipação, uma impacto, duas continuação, duas recuperação.
- `toknar_fome_revisao.png`: 4×2; oito poses: três preparando golpe no chão, impacto, duas sustentando/tremor, duas recuperação.
- `toknar_vfx.png`: 6×3; rastro horizontal5 + célula vazia; diagonal5 + vazia; fissura6. Não reproduzir a célula vazia como frame ativo sem intenção.

### Caim e wyverns

- `caim_poca_revisao.png`: 3×2, seis gestos corporais de conjuração da poça.
- `caim_erupcao.png`: 3×2, seis gestos corporais de erupção.
- `caim_magia_rubra.png`: 4×3, poça/dominação/invocação com efeitos incorporados.
- `caim_movimento_ataques_inicial.png`: 6×4, folha alternativa histórica com corrida, ataques e dash.
- `wyvern_sanguineo.png`: 4×3, voo/investida/materialização, quatro poses por linha; criatura evocada por Caim.
- `wyvern_selvagem.png`: 4×3, voo/investida/queda; inimiga nas fases iniciais, distinta da invocação sanguínea.

### Carrasco

- `carrasco_base.png`: identidade principal e pose-base.
- `carrasco_retrato.png`: retrato para diálogo.
- `carrasco_movimento.png`: 4×4; idle4, corrida8 nas linhas2–3, postura quebrada4 na linha4.
- `carrasco_golpes.png`: 4×4; varredura horizontal8 nas linhas1–2, execução vertical8 nas linhas3–4.
- `carrasco_investida_dano_morte.png`: 4×4; investida/freio8 nas linhas1–2, dano4 na linha3, morte4 na linha4.
- `carrasco_vfx.png`: 6×3; horizontal6, diagonal6, impacto6; sem corpo.

### Inimigos, retratos e arenas

- `goblin.png`: 4×3, corrida4, ataque4, reação/queda4.
- `orc_saqueador.png`: 4×3, corrida4, ataque4, reação/queda4; machado simples e escudo, não é Toknar.
- `retratos_atriox_toknar_caim.png`: 3×2, colunas Atriox/Toknar/Caim, duas expressões por personagem. Recortar separadamente.
- `apollon_bencao_atriox.png`: 3×2, seis composições da bênção com ambos os personagens. SOMENTE para cena narrativa, não para avatar em gameplay.
- `assets/arenas/arena_toknar.png`: arena do clã com público de orcs, entrada inferior e dois acessos superiores laterais para reforços.
- `assets/arenas/arena_caim.png`: campo aberto em ruínas com wyverns observadoras nas bordas.

Todos os nomes acima, exceto arenas, ficam em `assets/sprites_e_retratos/`. Versões `_v1` e design descartado ficam em `assets/historico/`. Consulte o inventário para caminhos exatos.

## 5. Preparação técnica dos assets — obrigatório

As grades descritas são a intenção das gerações, não prova de alinhamento. Há margens irregulares, mudanças de escala, pontas junto das bordas e efeitos atravessando células. Faça inspeção e recortes explícitos quando a grade automática falhar.

A checagem de bytes deste pacote detectou pixels transparentes nas 39 folhas/retratos e ausência deles nas duas arenas, como esperado. Isso NÃO comprova fundo limpo: uma imagem pode conter alpha e ainda manter manchas/halos ou pixels de fundo. As prévias foram descritas anteriormente como fundos coloridos; inspecione alpha real e composição em fundo claro/escuro antes de concluir que todo o fundo é opaco. Não remover cores escuras indiscriminadamente: roupas, malha, contornos e sombra dentro do capuz são parte dos personagens.

Entregue um processo reproduzível:
- Originais intactos; preparados em outra pasta.
- Atlas PNG + metadados de retângulo, tamanho original, trim, pivot e duração por frame.
- Preferencialmente quadros normalizados de 512×512 para personagens quando fizer sentido; folhas de origem não têm essa resolução por quadro.
- Escala definida pelo CORPO, não pela extensão do efeito ou do machado.
- Apoio dos pés constante; não centralizar independentemente cada pose.
- Espada, machado, cabelo e capa completos; registre partes ausentes se não puder reconstruí-las com qualidade.
- Separar corpo, VFX, sombra projetada e colisão. Sombras dinâmicas são renderizadas no jogo.
- Não declarar oito direções se só existem direita/frente. Espelhar esquerda com critério. Corrida de costas ainda requer asset específico.
- Não rotacionar todo o personagem em 360 graus para fingir animação.

Crie um visualizador local de animações com play/pause, frame a frame, velocidade, fundo claro/escuro e visualização de pivot/hitbox.

## 6. Animações e a sensação de golpes lentos

Diagnóstico informado pelo jogador/código anterior: Toknar esticava um único frame por 0,68 s na Ceifa, 1 s na investida/Banquete e 1,25 s na Fome. Caim fazia algo semelhante por 0,65–0,8 s. Verifique os números no código atual, não os trate como medições novas.

Corrigir o mapeamento do tempo de fase para os frames:
- Distribuir antecipação entre todos os quadros disponíveis.
- Reproduzir impacto brevemente e sincronizar dano com marcador.
- Reproduzir continuação e recuperação sem saltos.
- Não reiniciar animação a cada update.
- Loops só nos trechos apropriados: idle, corrida, canalização, tontura.
- Uma ação entra em recuperação e termina; não repetir o impacto acidentalmente.

Ponto inicial de ajuste para Ceifa de oito poses: antecipação total 0,45–0,68 s entre frames1–3; impacto 0,05–0,08 s no4; continuação 0,12–0,18 s entre5–6; recuperação 0,18–0,30 s entre7–8. São hipóteses de tuning, não valores obrigatórios.

Estados explícitos: idle, move, anticipation, active, recovery, dash, cast, hurt, stagger, bloodStunned, dead, dialogue e cinematic. Transições e prioridades centralizadas. Dano único por alvo por golpe; usar ID da ação, não um acerto a cada frame da hitbox.

## 7. Clareza das salas: altar e duas portas

Após limpar sala: remover perigos transitórios, ativar recompensas, mostrar resumo e revelar saídas.

- Altar CENTRAL: buff complementar coletável uma vez (cura, barreira, Glória temporária etc.).
- Porta ESQUERDA: um dom.
- Porta DIREITA: OUTRO dom, distinto.
- Escolher porta com E concede aquele dom e avança. Descarta outra oferta. Encostar não escolhe.
- Coletar buff é opcional. Altar não avança sala nem substitui escolha da porta.
- Nome, ícone, efeito curto e estado Novo/Evolução visíveis em cada opção.
- Ao alcance: “E — escolher e avançar”.
- Indicadores nas bordas para saídas fora de tela. Resumo compacto das duas ofertas antes de caminhar.
- Tutorial recolhível, tipografia legível, títulos breves sem cobrir combate.
- Debounce de interação, trava de transição e concessão idempotente. Sem recompensas durante combate/morte.
- Gerar ofertas uma vez por sala; respeitar pré-requisitos, incompatibilidades e evoluções. Nunca duas opções iguais ou dons sem efeito.

## 8. Combate e dons do Atriox

Preserve três cortes distintos e conectados; input responsivo, diagonais normalizadas, delta time correto, collider nos pés, depth sorting. Carga da espada SEMPRE EM PÉ, joelhos levemente flexionados. Não usar ajoelhar, stun ou pose narrativa como carga.

Comandos: ataque×3 básico; segurar/soltar para carregado; dash→ataque contra-ataque; magia e reativação do Sol Cativo; especial por Glória. Diferencie click de hold/release sem quebrar combo. Buffer inicial ~120 ms ajustável; cancelamentos definidos e hitstop curto só em impacto confirmado.

Dons com dados (ID, nome, descrição, pré-requisitos, níveis, incompatibilidades, efeitos e animação):

| Dom | Comportamento |
|---|---|
| Corte de Retorno | Após dash, breve janela para avanço curto com corte; respeita paredes. |
| Sentença Ascendente | Golpe carregado quebra postura, preparação e recuperação próprias. |
| Marca do Carrasco | Finalizador marca alvo; carregado consome marca e detona uma vez. |
| Órbita da Lâmina | Finalizador cria lâmina temporária; dash a lança; limite de lâminas/acertos. |
| Passo do Segundo Sol | Esquiva precisa de ataque real cria eco que repete próximo corte com dano menor. Eco não cria eco. |
| Forja Radiante | Magia fortalece próximo combo e altera sua sequência, com cargas/duração visíveis. |
| Sol Cativo | Conjura sol imóvel; golpes válidos alimentam; reativação explode. Um ativo, energia/tempo limitados. |
| Juramento da Glória | Ações variadas e acertos confirmados geram recurso; bater no vazio não. |
| Manifestação de Apollon | Consome Glória, invoca avatar temporário e ataque solar legível. |

Manter também Lâmina da Glória (meia-lua no finalizador), Juízo do Segundo Sol (pilar em área anunciada), Ímpeto Radiante (dash solar). Organizar evoluções para evitar habilidades redundantes e excesso de teclas.

Duas cargas de dash com recuperação e HUD; sem consumo duplicado; distância, duração e invulnerabilidade explícitas; não atravessar paredes. Não amarrar cadência a FPS. Builds possíveis: espada/postura; magia/sol; esquiva/eco. Não exigir uma build específica para sobreviver a um chefe.

## 9. Primeiras fases: inimigos reais

- Goblins: pequenos, ágeis, aproximação e corte de adaga com antecipação; frágeis.
- Orcs saqueadores: mais lentos, machado e escudo; investem espaço, defesa frontal e punição lateral legíveis.
- Wyverns selvagens: voo com sombra no chão, anúncio de investida, direção comprometida, recuperação. Collider não acompanha a largura inteira das asas.

Introduza individualmente antes de combinar. Não são só recolorações do mesmo comportamento. Limite população/projéteis. Separe as wyverns selvagens das sanguíneas evocadas por Caim.

## 10. Carrasco da Provação — primeiro chefe

Substituir o desenho antigo pelo novo capuz/armadura/machado. Preservar seu papel no código existente. Criar identidade de lutador pesado e disciplinado:
- Varredura horizontal com preparação legível.
- Execução vertical, impacto separado e recuperação de arma pesada.
- Investida com frenagem que permite punição.
- Postura quebrável sem stagger infinito.
- Reação de dano curta, morte completa e conclusão de sala exatamente uma vez.

Não importar drenagem, Rhaesis ou servidão para o Carrasco. A arena existente pode ser melhorada com colunas e braseiros nas bordas; NÃO existe neste pacote uma arena nova específica dele. Não usar arenas de Toknar/Caim como se fossem dele.

## 11. Toknar — Fúria de Rhaesis

Chefe obrigatório depois do Carrasco. Alto dano e cura por sucesso, não regeneração passiva interminável.

Ataques:
1. Ceifa Voraz: sequência de cortes distinguíveis, último atrasado, drenagem em acerto confirmado.
2. Carnificina: giro em movimento com entrada, loop e tontura/recuperação.
3. Investida do Carrasco: nome de ataque proposto para Toknar, não confundir com entidade do primeiro boss; direção comprometida, corrida e freio.
4. Rhaesis Tem Fome: preparação própria e golpe no chão, não reutilizar Ceifa.
5. Banquete de Sangue: machado fincado e canalização interrompível por postura/focos visíveis.

Fases 100–70, 70–35, 35–0%: introduzir padrões, combinações e canalização. Cura não repete transição de fase. Drenagem exige dano válido na vida, não contato em invulnerabilidade; limitar por golpe e nunca ultrapassar vida máxima.

Arena `arena_toknar.png`: centro livre, plateia sádica, portões superiores laterais. Orcs espectadores pintados são decoração estática. Reforços são entidades reais entrando por pontos configurados; nunca fazer um espectador pintado “sumir” sem camada separada. O rugido pode anunciar entrada de dois reforços, por exemplo; quantidades finais configuráveis. Público reage por som/camadas discretas quando disponíveis. Não spammar tropas a ponto de ocultar Toknar.

## 12. Caim — chefe final

A dificuldade deve vir de regras compreensíveis e combinações, além de ajustes de atributos.

- Manto da Servidão: defesa quando pressionado perto; ativação e vida do escudo visíveis, cooldown, duração máxima. Quebrar emite onda curta anunciada de servidão. Respostas: afastar-se, quebrar à distância ou esquivar. Não aplicar punição instantânea inevitável por causar dano.
- Sangue infectado: projéteis/golpes acumulam infecção limitada com HUD. Aumenta exposição nas poças, não stun automático ilimitado.
- Maré Rubra: poças maiores e expansão por setores, anúncio e rotas seguras.
- Servidão: exposição até limiar, imobilização temporária com sprite próprio, proteção após sair e limpeza de inputs. Não virar controle automático do herói; não criar stun-lock infinito.
- Wyverns: funções de investida/perseguição/bombardeio conforme assets; limite simultâneo, materialização legível, sem nascer causando dano sobre o jogador.
- Colheita dos Servos: ritual interrompível; interrupção cria janela de punição.

Fases 100–70, 70–35, 35–0%: duelista/poças/escudo; infecção/invocações; rituais e maior pressão. Use orçamento de ameaças para não sobrepor escudo explosivo, todas as poças e várias investidas inevitáveis.

Arena `arena_caim.png`: campo aberto com wyverns observando nos rochedos. Essas criaturas são pintadas no cenário: para levantar voo, precisam de camada separada ou de ponto de partida próprio sem deixar duplicata visível. Pode manter observadoras estáticas e invocar combatentes por outros pontos. Não fingir animação de público com o background inteiro oscilando.

As marcas vermelhas pintadas no chão são DECORAÇÃO. Poças ativas precisam de cor/borda/movimento próprios para distinguir perigo real de textura.

## 13. Conversas pré-boss: RPG antigo

Antes de CADA chefe (Carrasco, Toknar e Caim):
- Congelar combate e perigos, posicionar personagens com segurança e abrir caixa inferior.
- Retrato de Atriox à esquerda, chefe à direita; destacar quem fala.
- Nome legível, texto revelado gradualmente, Enter/Espaço/click para completar texto e depois avançar.
- Botão pular; após primeiro encontro pode lembrar preferência, sem excluir opção de rever.
- Input do diálogo não pode vazar para ataque/dash no primeiro frame da luta.
- Música/introdução/barra de chefe entram em ordem coerente.
- Início da luta uma vez; morte/reinício limpa estado.
- UI responsiva sem cobrir integralmente a arena.

Os exemplos abaixo são roteiros PROPOSTOS PARA O GAME, não fatos canônicos adicionados à história. Implementar como dados editáveis:

**Carrasco:** “Muitos chegaram até esta câmara. Poucos aprenderam a sair dela.”
**Atriox:** “Então observe com atenção.”
**Carrasco:** “Aprenderá a respeitar o peso desta lâmina.”

**Toknar:** “Rhaesis está com fome, Atriox.”
**Atriox:** “Vai ter que me alcançar primeiro.”
**Toknar:** “Quando ela beber, sua luta termina. A minha recomeça.”

**Caim:** “Até aqui você pôde escolher onde pisar.”
**Atriox:** “E ainda posso escolher quem derrubar.”
**Caim:** “Um passo no meu sangue... e até essa vontade será minha.”

Não inventar parentescos, pactos históricos ou eventos canônicos sem referência. A plateia e wyverns reforçam a cena, sem ataque antes do encerramento.

## 14. Vitória e modo infinito

Depois de Caim, limpar ataques/invocações e executar a bênção de Apollon. A folha de seis quadros reúne herói e avatar: usar na cinemática, NÃO como sprite de conjuração comum. Proposta de recompensa: Bênção da Glória permite ao dash radiante purificar temporariamente sangue. Recompensa aplicada uma vez mesmo ao pular a cena.

Oferecer Encerrar ou **Provação da Eternidade**. Manter build; ondas sem limite predefinido, entidades simultâneas LIMITADAS. Proposta: dons a cada3, elite a cada5, chefe a cada10. Mutar formações e comportamentos; teto de velocidade, controle, projéteis e partículas. Dificuldade não pode depender só de inflação de HP. Registrar melhor onda localmente. Ao atingir limite de dons, oferecer alternativas funcionais.

## 15. Assets ainda pendentes — não fingir que existem

Inventarie o que o código já tem versus o que falta. Este pacote NÃO contém todos os pedidos originais como animações separadas prontas. Entre lacunas possíveis:
- Atriox: contra-ataque8 próprio, dash6, idle6, corrida8 por direita/frente/costas, cast8, dano4, servidão6, morte8.
- Sol: Atriox invocando6 SOMENTE Atriox; Apollon manifestando8 SOMENTE Apollon; feixe6; orbital6; Sol Cativo loop6+explosão8; Marca isolada. Folhas antigas têm composições juntas.
- Toknar: Ceifa com três golpes completos se o código exigir três animações; investida3+loop4+freio3, giro2+loop6–8+tontura2, Banquete3+loop4+interrompido3, postura4, dano2, morte6–8. Não chamar a revisão de oito poses de Ceifa de três combos completos.
- Caim: rajada6, escudo ativar3+loop4+quebrar3, ritual entrada3+loop4+interrompido3, invocar6, idle6, dano2, morte8.
- Sangue separado: poça6, espinho6, projétil loop4+impacto4, bolha loop6+quebra6.
- Carrasco: a morte disponível tem4 poses; aumentar se insuficiente. Corridas de outras direções não existem.
- Público animado em camadas separadas não foi produzido.

Priorize integrar bem o disponível e reportar o necessário. Use fallback honesto sem longo congelamento; não invente caminho de arquivo ausente. Se não puder reconstruir frames faltantes sem ferramenta de imagem, registre em `ASSETS_PENDENTES.md` com pose e especificação.

## 16. Verificação e entrega

Mantenha configuração central de dano/vida/cura/postura/cooldown/tempos. Testes úteis de lógica: dano único, cura válida, transição de fase uma vez, duas cargas de dash, ofertas distintas, buff uma vez, servidão limitada, vitória e pular diálogo sem duplicar início.

Teste em navegador local:
- Campanha do começo ao fim, com Carrasco→Toknar→Caim.
- Portas visíveis/fora de tela, E, buff opcional e ofertas por build.
- Movimento cardinal/diagonal, carga em pé, combo/retorno/finalizador, dash cancel.
- Ataques com preparação contínua e impacto sincronizado.
- Morte durante ritual, reforços e transição.
- Reinício repetido sem timers/listeners/entidades órfãos.
- Público não invadindo collider do chão; reforços só pelos acessos.
- Pausa, perda de foco, limpeza de teclas e retorno sem salto do delta.
- Redimensionamento e clareza de texto/HUD.
- Vitória, cinemática pulada e modo infinito.

Medir FPS/frame time e entidades; não baixar qualidade indiscriminadamente sem diagnosticar. Não recriar texturas/atlas a cada update. Limitar DPR/partículas quando necessário. Relatar o que foi realmente testado e o que não foi.

Entregue código integrado, assets preparados, metadados, build estática, documentação de controles/build/deploy e relatório breve de mudanças/testes/limitações. Não deletar originais nem usar design descartado por conveniência. Não declarar concluída funcionalidade inacessível na partida.

**Resultado esperado:** progressão clara, inimigos reconhecíveis, conversas antes dos três chefes, Carrasco com o visual novo, Toknar brutal com drenagem e reforços, Caim ameaçador num campo de wyverns, dons com sinergia e animações contínuas. Faça a experiência funcionar de ponta a ponta.
