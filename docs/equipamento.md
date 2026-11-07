# Equipamento: ranque, cuidado e armas únicas (roadmap)

Sistema de qualidade nova (C → B → A → A+ → S → SS), cuidado com a arma (afiar, consertar, remendar) que sobe o
ranque, e armas únicas com nome, ID e história. Mesmo jeito de trabalhar do [ROADMAP.md](../ROADMAP.md) e do
[docs/campanha.md](campanha.md): uma tarefa curta por vez, aprovada pelo mantenedor.

**Status:** planejamento (2026-10-13). Nada implementado. Faltam as respostas da seção "Em aberto".

---

## Decidido pelo mantenedor
- **Escala:** C · B · A · A+ · S · SS. SS = único/artefato. Cores da arte nova: C cinza, B verde, A azul, A+ roxo, S dourado, SS vermelho.
- **Subida pelo uso: no máximo 1 degrau acima do ranque de nascimento** (decidido em 2026-10-13; substitui a ideia de subir até o topo). C → B · B → A · A → S · S → SS. Um C nunca chega a S.
- **A+ é a exceção: sobe 2 degraus**, A+ → S → SS. É o único jeito de um item que não nasceu S virar SS.
- **A+ só se acha na natureza** (drop/coleta/caça), nunca sai do uso: um A sobe direto para S.
- **Raridade na natureza:** A+ muito raro, S mais raro ainda, SS nunca. **SS só se consegue forjando e melhorando** (uma peça S forjada, ou A+/S achada, sobe pelo cuidado). A forja vai no máximo até S.
- **Afinidade da arma:** XP próprio do item, **escondido** do jogador. Afiar, consertar ou remendar dá uma chance de subir o nível, calculada contra o nível atual da arma.
- **Único (SS):** painel de maestria visível: nome dado pelo jogador, ID, quem forjou, proficiência gravada. Vendida, a arma leva a proficiência junto. O único ensina a própria receita, e ela continua valendo mesmo se a arma quebrar.
- **O item não cresce na mochila.** Qualidade muda valor e moldura, nunca a forma.
- **Loot e equipamento separados.** Equipamento tem um espaço padrão **por categoria**, em retângulo, sem "dentes" (arma longa, arma curta, armadura…).
- **Loot de criatura vai no máximo até S.** SS só por forja + melhoria.
- **Arma na mochila tem outro ícone** (não o mesmo de equipada); as informações aparecem ao passar o mouse.

## O que existe hoje (e o que muda)
| Hoje | Onde | Muda para |
|---|---|---|
| 3 qualidades A / A+ / SS, guardadas como posição na lista (0, 1, 2) | `TIERS` em `items/inventario.ts`, `it.tier` em ~20 arquivos | 6 qualidades; o item guarda a letra, não a posição; save antigo convertido |
| A qualidade engorda a forma (A+ mais larga, SS mais larga e mais alta) | `tierShape`/`dilate` em `items/qualidade.ts` | forma fixa |
| Armas e armaduras têm formas próprias, como qualquer item | `ITEM_DEFS[k].shape` em `data/itens.ts` | espaço padrão por categoria (equipamento) |
| Durabilidade só gasta e quebra; não há afiar/consertar/remendar | `items/durabilidade.ts` | ações de cuidado com minijogo |
| Proficiência do herói por tipo de arma | `hero/proficiencias.ts` | continua; a arma ganha o XP dela por cima |
| `uid` do item é um contador da sessão | `INV.invUid` | ID permanente nos itens de equipamento |
| Ícone da arma com variações e versão gasta | `wxKey` em `ui/icones.ts` | ícone de mochila (outro) + ícone de equipada |
| "Carne de Javali SS", couro A+… | caça, cozinha, chão | loot entra na escala nova (ver Em aberto 2) |

## Fases
### E0 — Escala nova e separação loot × equipamento
- [ ] `TIERS` com 6 entradas e id em letra; `it.tier` vira a letra; conversão dos saves antigos.
- [ ] Forma fixa: `tierShape` deixa de engordar.
- [ ] Categoria do item (loot / equipamento) na definição; equipamento no espaço padrão.
- [ ] Tabela de chances nova (seção "Chances de qualidade"), numa tabela só em `data/`, no lugar de `rollTier` e das contas soltas em `critLoot`, `FIN` e `giveMeat`.
- [ ] Valor de cada qualidade (hoje A ×1, A+ ×1,8, SS ×3,5) para as 6.

### E1 — Molduras e ícones
- [ ] Arte das molduras **sem letra**, fatiada em 9 (cantos fixos, bordas que esticam), uma por qualidade.
- [ ] Letra da qualidade escrita pelo jogo (CSS) no selo.
- [ ] Ícone de mochila × ícone de equipada para as armas; cartão ao passar o mouse.

### E2 — Cuidado com o equipamento
- [ ] Afiar (pedra de afiar), consertar (bigorna), remendar (couro/pano: a costura que já existe).
- [ ] XP escondido do item; chance de subir o ranque a cada cuidado, só até 1 degrau acima do nascimento, 2 para quem nasceu A+ (o item guarda o ranque de nascimento).
- [ ] Ligar à campanha: Ato 3, a armadura rasga e o Caçador ensina a remendar.

### E3 — Armas únicas
- [ ] ID permanente, nome dado pelo jogador, quem forjou, proficiência gravada.
- [ ] Painel de maestria.
- [ ] Receita própria; refazer pela receita.

## Chances de qualidade (drop)
Levantamento de 2026-10-13. Tudo em %.

**Hoje (3 qualidades):**
| Situação | Onde | A | A+ | SS |
|---|---|---|---|---|
| Lobo/horda, abate normal | `spawnLoot` (`field/chao.ts`) → `rollTier` | 72 | 23 | 5 |
| Lobo Alfa (chefe) | idem, `boss` | 15 | 60 | 25 |
| Coelho/cervo/lobo neutro do campo, abate normal | `critLoot` (`field/campo_vida.ts`), sem sorteio | 100 | 0 | 0 |
| Finalizar com a faca (horda) | `FIN`: +1 qualidade em tudo | 0 | 72 | 28 |
| Finalizar com a faca (coelho/cervo) | `critLoot` | 0 | 100 | 0 |
| Finalização perfeita (8% + 2% por nível de faca) | `FIN.extra`: +2 | 0 | 0 | 100 |
| Caça no mapa, normal | `giveMeat` (`econ/economia.ts`) | 72 | 23 | 5 |
| Caça no mapa, abate limpo (com faca: 15% + 3%·faca + 2%·caça) | `giveMeat`, +0,45 no sorteio | 27 | 23 | 50 |
| Mineração/madeira/pesca no minijogo | `minijogos/trabalho.ts` | 64–68 | 23 | 9–13 |
| Árvore/pedra do mapa (automático) | `map/recursos.ts` | 72 | 23 | 5 |

Problemas: SS (que vira "único") cai em qualquer bicho; o abate limpo no mapa dá SS em metade das carnes; o comentário de `rollTier` diz Alfa 15/50/35, mas o código dá 15/60/25; coelho e cervo não sorteiam nada.

**Proposta (aguardando OK):** loot de criatura e recurso vai até S; A+ muito raro, S mais raro ainda.
| Situação | C | B | A | A+ | S |
|---|---|---|---|---|---|
| Bicho comum, abate normal | 40 | 40 | 17 | 2,5 | 0,5 |
| Abate limpo (finalizar com a faca) | — | 35 | 50 | 12 | 3 |
| Abate limpo perfeito | — | — | 60 | 30 | 10 |
| Alfa/chefe, abate normal | — | 20 | 50 | 22 | 8 |
| Alfa/chefe, abate limpo | — | — | 50 | 35 | 15 |
| Caça no mapa (automática) | 50 | 35 | 13 | 2 | — |
| Minijogo de trabalho (nota perfeita: metade de C vai para B) | 45 | 35 | 17 | 2,5 | 0,5 |
| Árvore/pedra do mapa (automático) | 55 | 35 | 9 | 1 | — |

**Abate limpo** = só a finalização com a faca no campo, com o bicho laçado e dominado ou caído/atordoado; ataque comum não conta. Também dá pele inteira garantida (hoje 65%).
**Feito em 2026-10-13 (opção 2 do mantenedor):** a caça automática do mapa não faz mais abate limpo (antes bastava faca na mochila: 15% + 3%·faca + 2%·caça, com metade das carnes SS). Quem quer qualidade boa finaliza no campo.

## Em aberto
3. **Ícone da arma na mochila:** o que mostra? Sugestão: uma silhueta simples por tipo (espada embainhada, machado, arco desarmado), sem moldura; o desenho completo com a moldura de qualidade só no espaço de equipada e no cartão do mouse.
4. **Ao chegar a SS a arma vira única** (ganha nome, ID e painel)? (Já decidido: SS nunca nasce; só S ou A+ melhorados chegam lá.)
5. **Cópia pela receita do único nasce em que ranque?** Sugestão: num ranque baixo, com o mesmo desenho e nome ("Excalibur II"), para não virar fábrica de SS.
6. **Proficiência gravada na arma vendida:** dá bônus ao novo dono ou é só registro?
