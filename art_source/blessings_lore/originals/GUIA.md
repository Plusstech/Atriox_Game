# Assets — bênçãos de Atriox

Inclui 1 atlas com 7 ícones + célula final vazia, 7 folhas de VFX e 3 revisões alternativas. Total: 11 PNGs. São fontes geradas, ainda sem atlas recortado ou integração ao jogo.

## Ordem dos ícones

Grade 4×2, leitura da esquerda para a direita, de cima para baixo: Disciplina de Althar; Quebrador de Grilhões; Instinto do Eremita; Cinzas de Ignacius; Cicatrizes Douradas; Vontade do Renegado; Julgamento Próprio; célula vazia.

## VFX e uso

Cada folha foi solicitada com 8 poses, grade 4×2. Validar recortes e margens antes de integrar; alguns efeitos maiores ficam próximos das bordas. Não tratar a sequência como loop contínuo: começa, atinge pico e desaparece.

| Arquivo | Acionamento e efeito |
| --- | --- |
| fx_disciplina_althar.png | Esquiva precisa preservando combo: crescente azul-prateado. O VFX não determina a lógica do combo. |
| fx_quebrador_grilhoes.png | Saída efetiva de controle: correntes bronze e onda de empurrão/postura. Disparar uma vez e respeitar recarga interna. |
| fx_instinto_eremita.png | Prontidão depois de esperar sem atacar: concentração verde. Consumir no próximo golpe válido; alcance e postura são lógica separada. |
| fx_cinzas_ignacius.png | Explosão de brasas espalhadas por golpe carregado. Brasas persistentes devem ser entidades próprias; esta folha representa ativação/explosão. |
| fx_cicatrizes_douradas.png | Recuperação por ataque corpo a corpo: fissuras vermelhas fecham em ouro. Vida recuperável precisa de indicador de HUD próprio, não incluído. |
| fx_vontade_renegado.png | Rompimento da primeira dominação da sala por esquiva: prisão violeta se abre. Consumir cargas no sistema e evitar disparar junto de outro efeito redundante. |
| fx_julgamento_proprio.png | Interrupção confirmada de ataque inimigo: estrela de aparo e proteção azul/marfim. Duração da proteção definida no código, separada da animação. |

## Pendências visuais

Instinto do Eremita, Cicatrizes Douradas e Julgamento Próprio mantiveram degradê de fundo nas fontes e nas revisões. Precisam de extração confiável antes de uso sobre o cenário. O sufixo alpha_revision identifica uma tentativa de correção, não garante fundo limpo. As outras folhas e ícones exibem transparência na prévia, mas ainda precisam de conferência sobre fundos claros e escuros, recorte de cada célula e teste de alinhamento. Não remover preto globalmente: apagaria detalhes dos efeitos e dos ícones.

Manter todas as fontes; preparar atlas com retângulos e pivôs reais após inspeção. Não há sprites corporais, sons, HUD de vida recuperável, lógica de bênçãos ou código neste pacote. Estas sete bênçãos de lore são distintas do conjunto genérico proposto antes para Apollon; não substituir automaticamente aquelas regras sem decidir como os dois sistemas se relacionam.
