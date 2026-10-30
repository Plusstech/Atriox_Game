# Atualização das folhas de Atriox

## Avaliação e uso das cinco folhas

As versões com `- Copia` e sem esse sufixo são idênticas byte a byte. Foi preservada uma cópia de cada fonte em `art_source/v04/`.

| Fonte fornecida | Conteúdo encontrado | Uso integrado |
|---|---|---|
| Atriox em guarda…-5 | 4 poses de guarda, não 8 cortes | Idle/guarda |
| Guerreiro com espada…-6 | 8 poses de corte horizontal | Combo 1 e Corte de Retorno |
| Espadachim em oito poses…-7 | 8 poses de corte/retorno | Combo 2 |
| Espadachim de quatro quadros…-8 | 4 poses de guarda em pé | Carga da Sentença |
| Ataque ascendente…-9 | 8 poses de corte ascendente | Sentença e finalizador do combo |

A redistribuição foi feita com a liberdade concedida pelo usuário. O finalizador e a Sentença compartilham a mesma sequência visual, com preparação/recuperação determinadas por seus controladores. Não foram inventados quadros para completar uma folha inexistente.

## Preparação e continuidade

- **32 PNGs RGBA de 512×512**, em `art_source/v04/normalized/`.
- Mesma referência de altura do corpo: **256 px**; apoio em **(256, 448)**, com margem para espada e capa.
- Leitura mantida da esquerda para a direita, primeira linha e depois segunda; nenhuma reordenação automática.
- Os fundos marrons estão majoritariamente no RGB oculto de pixels transparentes. A limpeza usa o alpha fornecido, zera ruído abaixo de 8/255 e pequenos fragmentos isolados. Não há remoção global de preto nem regeneração do personagem.
- A escala é constante por folha e calibrada entre folhas usando poses de referência. Cada pose não é redimensionada isoladamente para ocupar o mesmo retângulo.
- Espadas e capas foram conferidas nas pranchas de contato; o exportador rejeita cortes que encostem nas bordas.
- PNGs normalizados são os arquivos de intercâmbio; a página WebP do jogo é aparada, com metadados para preservar o apoio e a escala anterior de Atriox.

As prévias GIF e pranchas ficam em `art_source/v04/_inspect/`; o manifesto também registra a diferença entre silhuetas consecutivas e o fechamento do ciclo. A carga tem variação pequena entre as quatro poses. As sequências continuam compostas de poses discretas, sem interpolação ou promessa de fluidez de animação desenhada quadro a quadro.

## Integração com o combate

Os golpes de oito quadros usam **3 de antecipação, 2 ativos e 3 de recuperação**. O primeiro quadro ativo tem o marcador `hit`; as durações de combate são preservadas. O finalizador com Lâmina da Glória usa o corpo novo e lança a projeção em camada separada.

Forja, Marca e o eco solar deixam de substituir o corpo por outra sequência no meio do combo. Seus efeitos lógicos, indicadores e projeções continuam funcionando; um rastro independente mostra o alcance do golpe, com cor solar para cortes forjados.

A direção de Sentença e Corte de Retorno trava no início da ação. Mover o mouse durante a antecipação não muda a direção do dano. A recuperação do contra-ataque usa sua própria duração, permitindo chegar ao último quadro.

O botão mantido é acompanhado por eventos de pressionar/soltar, incluindo soltura fora do canvas. Perda de foco, pausa, dominação e transição limpam a carga pendente. Uma ação avançada cancelada também cancela sua hitbox, evitando dano invisível após voltar à guarda.

O inspetor inclui guarda, carga, Sentença e contra-ataque; os dois últimos reproduzem os tempos reais das habilidades.

Validação local: **86 testes unitários** e **91 verificações no navegador** (55 de regressão, 26 da campanha/Eternidade, 1 de cache e 9 de arte/combate). As verificações novas usam clique, botão mantido, soltura, movimento do mouse durante a antecipação e perda de foco. Confirmam dano único por alvo, quadros ativos e cancelamento da carga. O arquivo `tests/e2e/screenshots/combat-charge-standing.png` registra a carga em pé no jogo.

## Reprodução

```text
npm run sprites:combat
npm run build
npm run check
```

`sprites:combat` prepara os PNGs e atualiza somente a página adicional do atlas. `npm run atlas` reconstrói o atlas completo na ordem base → v0.3 → novos quadros de combate. O build continua estático; a versão das páginas é calculada pelo conteúdo para impedir mistura de caches.

## Limitações que ainda pedem arte

- Falta uma sequência exclusiva do finalizador pesado, diferente da Sentença; o compartilhamento atual é intencional.
- Carga e guarda têm pouca variação corporal.
- As folhas são laterais em três quartos: mirar para cima/baixo ainda não tem animações próprias.
- Avatar de Apollon, conjurações antigas, morte e dano ainda usam os assets anteriores. Novos corpos, avatar e VFX em camadas separadas continuam sendo úteis para essas ações.
