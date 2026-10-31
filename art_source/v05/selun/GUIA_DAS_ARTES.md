# Guia das artes — Sêlun

Pacote exclusivo do Sêlun: 19 artes originais + 10 revisões = 29 PNGs. As revisões preservam alternativas e NÃO comprovam remoção de fundo. Não inclui sprites antigos de Atriox/Toknar/JDR.

## Como usar

1. Entregue o ZIP e PROMPT_SELUN_GAME_OVER.md ao Codex/Claude do projeto.
2. Peça para implementar o prompt no repositório existente.
3. Use as fontes para preparar atlas: as contagens são metas, não validação individual dos quadros. Confira visualmente cada recorte e pivô.
4. Consulte as medições abaixo. Ter alguns pixels transparentes não garante fundo completamente limpo. Não use chroma key preto global.

O encontro acontece após concluir o nível 10 do Infinito. Sêlun é o GAME OVER; Apollon revive Atriox com buffs. Regras detalhadas e propostas de balanceamento estão no prompt.

## Inventário

| Arquivo | Conteúdo | Tamanho | Alfa não opaco | Situação |
| --- | --- | --- | --- | --- |
| `artes/selun_idle.png` | Parado respirando; meta 4 quadros. | 2079×756 | 99.924% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_attack_01_horizon.png` | Horizonte Partido: preparação e corte horizontal; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_run.png` | Corrida/perseguição; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_attack_02_sentence.png` | Sentença do Abismo: golpe diagonal descendente; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_attack_03_end.png` | Decreto do Fim: gesto do especial; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_stagger.png` | Postura quebrada; meta 4 quadros em loop. | 2086×754 | 99.928% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_hurt.png` | Reação curta ao dano; meta 4 quadros. | 2172×724 | 99.969% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_apparent_death.png` | Queda aparente; meta 8 quadros. Não é morte definitiva. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_phase_change.png` | Fúria/transição de fase; meta 4 quadros. | 2172×724 | 99.957% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_dash.png` | Investida; meta 10 quadros: 3 entrada, 4 loop, 3 freio. | 1774×887 | 99.941% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_recompose.png` | Recomposição após queda aparente; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_channel.png` | Canalização; meta 10 quadros: 3 entrada, 4 loop, 3 saída. | 1774×887 | 99.95% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_portrait_calm.png` | Busto calmo olhando à esquerda para diálogo. | 1230×1278 | 99.941% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/selun_portrait_angry.png` | Busto irritado olhando à esquerda para diálogo. | 1206×1304 | 99.942% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/fx_selun_horizontal.png` | Rastro horizontal separado; meta 6 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/fx_selun_diagonal.png` | Rastro diagonal separado; meta 6 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/fx_selun_ground_impact.png` | Impacto no chão separado; meta 6 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `artes/arena_selun.png` | Arena própria; imagem única 1536×1024, fundo opaco intencional. | 1536×1024 | 0.0% | Fundo opaco intencional |
| `artes/fx_selun_end.png` | Fenda dimensional âmbar do especial; meta 8 quadros. | 1774×887 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/selun_run_alpha_revision.png` | Corrida/perseguição; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/fx_selun_ground_impact_alpha_revision.png` | Impacto no chão separado; meta 6 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/selun_attack_01_horizon_alpha_revision.png` | Horizonte Partido: preparação e corte horizontal; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/selun_attack_02_sentence_alpha_revision.png` | Sentença do Abismo: golpe diagonal descendente; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/selun_attack_03_end_alpha_revision.png` | Decreto do Fim: gesto do especial; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/selun_apparent_death_alpha_revision.png` | Queda aparente; meta 8 quadros. Não é morte definitiva. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/selun_recompose_alpha_revision.png` | Recomposição após queda aparente; meta 8 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/selun_channel_alpha_revision.png` | Canalização; meta 10 quadros: 3 entrada, 4 loop, 3 saída. | 1774×887 | 99.911% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/fx_selun_horizontal_alpha_revision.png` | Rastro horizontal separado; meta 6 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
| `revisoes/fx_selun_diagonal_alpha_revision.png` | Rastro diagonal separado; meta 6 quadros. | 1536×1024 | 100.0% | Contém alfa; revisar visualmente, grade, escala e pivôs |
