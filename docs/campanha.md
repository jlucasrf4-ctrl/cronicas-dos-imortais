# Campanha 1 — "A Runa Selvagem" (roadmap)

Roteiro da primeira campanha (do novo personagem até a ida ao Palácio dos Imortais), quebrado em tarefas curtas.
Mesmo jeito de trabalhar do [ROADMAP.md](../ROADMAP.md): uma tarefa por vez, aprovada pelo mantenedor, marcar a caixa e
atualizar o Status.

**Status:** C0 feita em 2026-10-13, aguardando o OK do mantenedor (jogar o Ato 1 e ver o quadro do objetivo). C1 feita
em 2026-10-18 (dormir, aviso da noite, o Caçador chamando; aguardando OK). C2 (os lobos): passos 1 e 2 feitos em 2026-10-18
(a Brasa, laçar, Abater/Carregar, a roupa que rasga, o cercado e o vínculo; aguardando OK); passo 3a (os pedidos
de carne), 3b (a costura) 4 (o casal, o filhote, soltar os pais), 5a (o filhote solto pelo acampamento) e a
porteira do cercado também; próximo: 5b, o jogador criar o próprio casal (no mesmo cercado).

Legenda do levantamento: ✅ já existe e serve · 🟡 existe em parte / precisa adaptar · ❌ não existe.

---

## O roteiro em atos

| Ato | Batidas | Situação no código hoje |
|---|---|---|
| **1. Chegada** | personagem novo · tutorial de flecha e cura · exploração até o acampamento · fogueira · Caçador dorme · tempo livre · volta | ✅ quase tudo: cena inicial (`intro/cena.ts`: javali, erva com H, juntar galho/pedra, fazer flecha, faca de presente, analisar a faca) e acampamento (`intro/tutorial.ts`: acender a fogueira, assar a carne SS, barraca, cochilo) |
| **2. O ciclo** | dia e noite · expedição acaba, volta ao acampamento, dorme · Caçador chama | 🟡 o mundo tem relógio e dia/noite (`ui/hud.ts`, `ui/painel.ts`), a fogueira brilha mais à noite; ❌ dormir/pular a noite, ❌ o Caçador chamando o jogador |
| **3. Lições do Caçador** | corda (laço) · abate limpo = pele melhor · pele vira armadura básica · a sua rasga e ele promete ensinar | ✅ laço com cabo de guerra (`field/faca_corda.ts`), ✅ finalizar com a faca = pele inteira e qualidade +1/+2 (`field/chao.ts`), ✅ costura de couro na forja (`forja/oficios.ts`); ❌ as falas/missões que ensinam cada um, ❌ armadura que rasga |
| **4. Ir à cidade a pé** | baú cheio → vender · encontros na estrada viram mini masmorra sem chefe | ✅ viagem de comércio a pé com rota e preço (`econ/economia.ts` `startTrip`), ✅ empório da Vila Musgo (`map/vila_musgo.ts`), ✅ masmorra com hordas (`field/masmorra.ts`, "3 hordas e um chefe"); ❌ o encontro na estrada (entrar no campo no meio da viagem e voltar) |
| **5. Noite na vila** | taverna · quadro de missões · convite para beber · boato do norte e da Runa Selvagem · runas antigas, artefatos | ❌ a vila hoje é só uma janela de compra/venda: sem cena, taverna, NPCs, quadro de missões |
| **6. Manhã na vila** | barra de fome (comer antes de voltar) · NPCs com missões · porto: barco precisa de madeira · tutorial de madeira · conserto · doca perto da floresta · pesca · fast travel (2 dias) | ✅ fome do herói (`survival/sobrevivencia.ts`), ✅ minijogos de madeira e pesca (`minijogos/trabalho.ts`), 🟡 **o bote já funciona** entre a doca da vila e a da área de caça (`boteViagem`): precisa ficar trancado até o conserto; ❌ NPCs, missões, a espera de 2 dias |
| **7. A igreja** | Imortal + dois cavaleiros do norte · Imortal vê sua afinidade · convite para a caçada | 🟡 a afinidade já nasce com o personagem (`data/nascimento.ts`: fogo, raio, água, ar, terra, nularis); ❌ igreja, Imortal, cavaleiros |
| **8. Rastreamento** | pista 1 = lobo (errada) · pista 2 = javali alfa · pista 3 = o coelho · diálogo no vale | 🟡 caça no mapa acha presa (`map/caca.ts`), nó "Rastreador" da árvore marca bichos; ❌ pegadas/pistas, a sequência de três rastros |
| **9. Preparação** | mundo livre · juntar ouro e montar o equipamento · voltar à cidade quando pronto | ✅ economia, forja, armas, aljava, mochila; ❌ o gatilho "estou pronto" |
| **10. Chefe: Lebre Rúnica** | Imortal dá uma runa básica do seu elemento (bônus de afinidade) · fase 1 · runa = dano forte → fase 2 · todos lutam · flecha na cauda, laço, atordoar · gema que fica com o Imortal | 🟡 bichos rúnicos existem (`runas/runas.ts`: Lebre/Cervo/Lobo Rúnico, Javalino; soltam gema), laço e atordoar existem (`field/combate.ts`); ❌ chefe em fases, ponto fraco (cauda), aliados lutando junto, runa usável em combate, bônus de afinidade |
| **11. A Agulha** | o que é agulha · absorver runa natural (outra missão) · runa 5/5 com cargas, mana recarrega · Imortal explica artefatos, chama você para fazer · minijogo complexo · artefato fica com ele | ✅ minijogo de absorção de 8 passos (`runas/absorcao.ts`), ✅ runas capturadas/preciosas como item; 🟡 atributo Mana existe mas está "dormente"; ❌ cargas, recarga, criar artefato |
| **12. Fim** | Imortal incentiva seu próprio artefato · nova era da magia · convite ao Palácio dos Imortais | ❌ só falas (fácil depois do C0) |

**Resumo:** a parte de *jogo* (combate, caça, laço, couro, forja, runas, fome, minijogos, bote) está mais pronta do que
parece. O que falta é quase tudo de *campanha*: missões, NPCs, cenas na vila, dormir, e três sistemas novos de
verdade (chefe em fases, runa usável com cargas/mana, criação de artefato).

---

## Fases

### C0 — Esqueleto da campanha (antes de qualquer conteúdo)
Sem isso cada ato vira código solto. Reaproveita `say()`, `ctChoice()` e `introObj()` de `intro/`.
- [x] Estado da campanha no save: `econ.campanha = { etapa, feitas, flags }` (`EstadoCampanha` em `core/tipos.ts`). Save antigo ganha a etapa pelas marcas `introDone`/`campTut`.
- [x] Missões como tabela (`data/campanha.ts`: `MISSOES`, `ATOS`): ato, título, objetivo, evento que conclui, próxima. A lógica é `campanha/campanha.ts`: o jogo chama `campanhaEvento("<evento>")`; um evento de missão mais adiante conclui as do meio. Ato 1 ligado: `introFim` (cena.ts), `acampamentoChegou`, `acampamentoFim` (tutorial.ts, preparo.ts).
- [x] Objetivo atual na tela: quadro `#missao` (CSS `34_v7.7_campanha.css`), no mapa acima da barra de recursos, no campo à direita embaixo do HUD; some durante falas, mochila, janelas e quando a cena mostra o objetivo dela (`#isc-obj`); brilha 4 s quando a missão muda.
- [x] Falas em tabela (`FALAS`, `FALANTES`; `falar(id, done, acoes)`); `say()` aceita quem fala (padrão: Caçador). As falas do acampamento já saem de lá. Escolhas (`ctChoice`) ainda são código: entram na tabela quando a C2 precisar.
- [x] Gameshark: `PULARMISSAO` (conclui a atual) e `RECOMECAR`; no gancho de teste, `__t.campanhaIr(id)` vai direto a qualquer missão.
- Testes: `tests/unit/campanha.test.ts` (corrente da tabela, andamento) e `tests/browser/e2e/campanha.spec.ts` (quadro no mapa, Ato 1 no acampamento, fotos).

### C1 — Ato 2: dormir e o Caçador chamando
- [x] Dormir na barraca: pula até o amanhecer (o mundo simula o tempo pulado), recupera vida/fôlego, a fome sobe.
      (2026-10-18, aguardando OK) `campanha/sono.ts`, tabela `SONO`: **Z** perto da tenda montada, só de noite
      (19h30–6h, como o sol/lua do HUD; de dia o painel diz "só à noite"); a tela escurece (`#sono`, com o relógio),
      o mundo avança até as 6h pelo avanço rápido do +1h/+1d; ao acordar: vida e fôlego cheios, frio zerado,
      ferimentos −10/h (−3,3/h com fome acima de 60), fome +2/h, o Caçador acorda (`hunterNap` = falso) e a
      campanha recebe o evento `dormiu` (ainda nenhuma missão usa). Celular: ainda sem botão. Teste: `sono.spec.ts`.
- [x] Fim de expedição → aviso para voltar ao acampamento antes da noite.
      (2026-10-18, aguardando OK) `avisoNoite` em `campanha/sono.ts`, depois do tutorial do acampamento: longe do
      acampamento, às 17h "🌇 Está escurecendo · volte antes da noite" e às 19h30 "🌙 Anoiteceu · durma na barraca",
      uma vez cada por noite. No campo é o letreiro do alto (não no acampamento, treino ou introdução); no mapa, um
      aviso e uma linha no diário quando a primeira heroína está a mais de `SONO.longe` da base. A 1×, das 17h até a
      noite são ~40 s. Teste: `sono.spec.ts`.
- [x] O Caçador chama: um "!" sobre ele e um aviso no mapa quando há missão nova.
      (2026-10-18, aguardando OK) Missão com `chamado: "<fala>"` (data/campanha.ts): "❗" amarelo sobre o Caçador
      no acampamento (some durante a fala), linha "Falar com o Caçador · ❗ ele quer falar com você" no painel, E
      (`atenderChamado`, também acorda o cochilo) diz a fala e conclui a missão; no mapa, o balão do acampamento
      "❗ O Caçador quer falar" (tocar entra no acampamento) e um aviso quando a missão começa longe dele. Corrente
      agora: `a2_livre` termina com `dormiu` → `a3_brasa` (chamado, fala `cacador_brasa`) → `a3_lobo` ("Lace um
      lobo e canse-o até ele cair · sem matar", ainda sem evento: é o passo 1b da C2).

### C2 — Ato 3: lições do Caçador — os lobos (redesenho do mantenedor, 2026-10-18)
O Caçador quer um cão de caça para caçar patos (os patos já existem no mapa). A cadela dele, a Brasa, era meio-loba
e morreu no inverno; na vila só há cachorro de quintal e cão treinado vem da capital, longe demais. O avô dele criava
cão a partir de lobo: um casal no cercado, e o filhote nasce acostumado com gente. As missões do laço, do abate limpo,
da armadura que rasga e da costura viram uma corrente só (mantenedor: "pode juntar as missões").

Fala da proposta (aguardando OK):
> "A Brasa, minha cadela, era meio-loba. Farejava pato no meio do junco antes dele levantar voo. Morreu no inverno
> passado. / Na vila só tem cachorro de quintal, que late e espanta tudo. Cão de caça bom vem da capital, e isso é
> longe demais pra mim. / Meu avô criava os dele com lobo. Pegava um casal, cuidava até perderem o medo, e o filhote
> já nascia acostumado com gente. / Quero tentar igual. Mas laçar lobo sozinho… não dá. Me ajuda?"

Regras decididas:
- **O casal e o primeiro filhote são do Caçador.** O jogador ajuda (laço, carnes) mas não tem responsabilidade com o
  vínculo dele (sumir não estraga nada). O jogador pode fazer o mesmo em paralelo, com o próprio casal e cercado; aí o
  vínculo é dele e cai com descuido.
- **Lobo adulto nunca vira pet.** O vínculo do capturado (0–4) só decide o que ele faz ao ser solto (pode ser solto com
  qualquer vínculo): baixo = ataca, médio = foge, alto = rodeia um tempo e depois foge.
- **O pet é o filhote criado sem os pais**: macho + fêmea no vínculo 4 → filhote; os pais precisam ser soltos em até 2
  dias, senão o filhote cresce lobo.
- **Vínculo do filhote (o pet):** 1 = foge ao ser solto · 2 = fica perto do acampamento, pede comida, não atende ao
  primeiro chamado · 3 = vai à expedição mas não obedece a "caçar": rodeia, foge do perigo, ataca se atacado, pode
  caçar um bicho neutro e comer sozinho · 4 = vem quando chamado, pega o alvo do foco e o prende num cabo de guerra
  corpo a corpo (como o da corda, sem a distância), traz patos e aves pequenas vivos; se vê o dono ser atacado (na
  linha de visão), ataca ou fica enfurecido.
- **O filhote do Caçador** aparece de vez em quando no acampamento; com muita carne na mochila ele vem até você.
- Pedidos de carne do Caçador: bicho, qualidade mínima, às vezes assada; sobem o vínculo dos lobos dele.

Passos:
- [x] 1. "!" do Caçador + a conversa da Brasa + missão "laçar um lobo"; lobo derrubado → escolha **Abater** (lição do
  abate limpo, pele melhor; "vivo, da próxima vez") ou **Carregar** (vai pela corda, como o "dominado" de hoje) → ao
  voltar, o lobo aparece no cercado. A roupa inicial rasga nessa luta (decisão 4).
  (2026-10-18, aguardando OK) `campanha/lobos.ts`. Corrente: `a3_brasa` (❗, fala da Brasa) → `a3_lobo` ("Numa
  expedição, lace um lobo e canse-o até ele cair · sem matar"; no "campo" do mapa `campoPovoar` garante um lobo, na
  expedição do preparo eles vêm na horda) → o laço derruba o lobo (letreiro "🪢 Lobo caído"). **Sem janela de
  escolha** (mantenedor, 2026-10-18: a decisão é no jogo): chegar perto e finalizar com a faca (E; o alcance agora é
  0,6 tile da borda do corpo, era 1,5 tile do centro) → o Caçador lamenta (letreiro + aviso), `flags.abateLimpo`,
  segue em `a3_lobo`; esperar ele **levantar ainda na corda** = domado (`loboLevantou`) → `a3_carregar` ("Leve o lobo
  pela corda até a saída"; o domado de pé não pode ser finalizado, senão o E na saída o matava) → sair do campo com
  ele na corda (caído ou domado) = `econ.lobos` ganha
  `{sexo, pelagem, ficha, vinculo: 0, dono: "cacador"}` (2026-10-18: o mesmo bicho do campo; o sexo nasce com o lobo
  em `spawnDungeonMonster` e a `ficha` guarda tamanho, vida, fôlego e velocidade para a genética futura; não aparece
  na tela). Domado na corda ele dá **pinote** (tabela `DOMA` em `data/combate.ts`, ideia do mantenedor, valores a
  ajustar jogando): o fôlego interno sobe sozinho, o G baixa, cheio = tranco que tira o seu fôlego (sem fôlego, volta
  o cabo de guerra); depois de `DOMA.teima` s ele desiste e não sobe mais → `a3_cercado` (❗, fala `cacador_lobo_vivo`) → `a3_espera` ("O
  Caçador está fechando um cercado", fim do pronto). Se o lobo escapa da corda ou morre carregando, a missão volta
  a `a3_lobo`. A primeira mordida de lobo que tira vida durante a missão quebra a armadura do peito (uma vez,
  `flags.roupaRasgou`; sem armadura no peito, nada). Ainda não há cercado desenhado (passo 2). Teste:
  `lobo.spec.ts`.
- [x] 2. Cercado no acampamento, lobos dentro, alimentar, vínculo 0–4 (do Caçador).
  (2026-10-18, aguardando OK) `campanha/cercado.ts`. O lugar ao lado da tenda é a saída do campo, então o cercado
  ficou à direita, acima da bigorna (`CERCADO`: 4 tiles à direita e 1,6 acima da fogueira, 3 × 2,2 tiles): estacas,
  duas cordas, palha e tigela d'água, só em 3D (`cercadoGL`, chamado por `campNapGL`); a heroína não entra (é
  empurrada para fora). Os lobos de `econ.lobos` andam dentro com o modelo animado e a pelagem deles; vínculo 0–1 se
  afasta de quem chega (`LOBO_C.medo`), 3–4 vem até a cerca. Vínculo por pontos (`VINCULO.niveis` 3/8/15/25): o
  Caçador trata todo dia (+1/dia, contado pelos dias que passaram) e E na cerca dá uma carne (crua ou assada) da
  mochila a um lobo que ainda não comeu da sua mão hoje (+1). O painel mostra "♂ vínculo n/4". Corrente:
  `a3_espera` ("Veja o lobo no cercado") → `a3_alimentar` → `a3_vinculo` (fim do pronto: "logo o Caçador vai pedir
  carne", passo 3). Teste: `cercado.spec.ts`.
- [x] 3. Pedidos de carne do Caçador (missões repetíveis, anunciadas pelo "!"); missão da costura com o couro.
  - [x] 3a. Os pedidos (2026-10-18, aguardando OK), `campanha/pedidos.ts`: começam depois de alimentar o lobo
    (`a3_alimentar` feita); o primeiro vem no dia seguinte **e só com um lobo dele no vínculo 2** (mantenedor,
    2026-10-18: "nesse momento o lobo já deveria ter vínculo para não fugir com a porta aberta";
    `PEDIDO.primeiroVinculo`; o objetivo de `a3_vinculo` diz "Dê carne ao lobo até ele se acostumar (vínculo 2/4)").
    Se o lobo fugiu pela porteira, não há pedido até o Caçador o trazer de volta (1 dia; o aviso agora diz "O
    Caçador vai atrás dele"). O primeiro é sempre "2 carnes de coelho · qualidade A ou melhor",
    os outros saem de `MODELOS` (coelho/cervo, 1–2, A ou A+, às vezes assada; na assada vale a qualidade da carne
    crua, `Item.qc`), um a cada `PEDIDO.cadaDias` = 2 dias. Pedido novo = ❗ no Caçador (e o balão/aviso no mapa,
    pelo mesmo `chamadoAtual`); falar anuncia; o objetivo (missões com `pedido: true`) mostra o pedido; com a
    carne certa na mochila o painel diz "Entregar a carne" e o E entrega: cada lobo dele ganha `PEDIDO.pontos` = 3
    (+1 assada, +1 por nível de qualidade). Corrente: `a3_vinculo` → `a3_pedido` → `a3_cuidar` (fica; os pedidos
    seguem). Estado em `econ.pedido`/`econ.pedidoProx`. Teste: `pedidos.spec.ts`.
  - [x] 3b. A missão da costura (a roupa rasgou na luta do lobo → o Caçador ensina a armadura de couro).
    (2026-10-18, aguardando OK) Depois da 1ª entrega: `a3_costura` (❗, fala `cacador_costura`: "Vi o estrago que
    aquele lobo fez na sua roupa… Couro segura… Junta três peles e faz a sua"; no fim, o campo novo `aprende` da
    missão faz `forgeLearn("eq_armadura")`, que o acampamento não sabia) → `a3_armadura` ("Faça a armadura de couro
    na bigorna · 3 peles"; conclui `forjou_eq_armadura`, avisado pela forja ao terminar uma peça) → `a3_cuidar`.
    A forja avisa com `campanhaEventoAtual` (novo): só conclui se for a missão atual, para que forjar a peça antes
    da hora (receita de um projeto) não pule a corrente. Testes: `pedidos.spec.ts` (a conversa e a receita),
    `campanha.test.ts` (o evento fora de hora; `chamado`/`aprende` apontam para falas e peças que existem).
- [x] 4. O casal, o filhote, os 2 dias para soltar os pais e o que cada um faz ao ser solto.
  (2026-10-18, aguardando OK) `casalTick` em `campanha/cercado.ts`, tabela `CASAL`. **Sem missão para o 2º lobo**
  (mantenedor): `CASAL.segundoDias` = 3 dias depois da captura, o Caçador traz sozinho um lobo do sexo oposto (aviso
  + diário, `flags.segundoLobo`). Com o casal no vínculo 4 e a costura feita (`feitas.a3_armadura`), nasce o filhote
  (entra em `econ.lobos` com `filhote: true`, pelagem de um dos pais, desenhado com metade do tamanho; o vínculo, a
  carne da mão e os pedidos valem para ele também) → `a3_filhote` (❗, fala `cacador_filhote`) → `a3_soltar` ("Solte
  os pais… em até 2 dias"): E na cerca solta (`paisSoltos`); com vínculo ≥ `CASAL.rodeiaDesde` os pais rodeiam a
  fogueira `CASAL.rodeiaS` s e fogem pela esquerda, abaixo disso fogem já. Passado `CASAL.prazoDias` = 2 dias, o
  próprio Caçador solta (aviso). → `a3_cria` ("O filhote cresce no cercado"). Ainda não: o lobo adulto **atacar** ao
  ser solto com vínculo baixo (para o casal do jogador, passo 5). Os pais saem pela porteira (ela abre sozinha
  por `PORTA.auto` s, ver abaixo). Teste: `casal.spec.ts`.
- [~] 5. O filhote do Caçador no acampamento; o jogador criar o próprio casal/filhote; vínculo do pet e ele na
  expedição (níveis 2–3).
  - [x] 5a. O filhote do Caçador solto pelo acampamento (2026-10-18, aguardando OK), tabela `FILHOTE` em
    `campanha/cercado.ts`: `FILHOTE.soltoDias` = 1 dia depois de os pais irem embora (`paisSoltosEm` no filhote),
    a cada visita ao acampamento ele tem `FILHOTE.chance` = 60% de estar solto, brincando em volta do Caçador; com
    `FILHOTE.carneMin` = 3 carnes (cruas ou assadas) na mochila e você a menos de 6 tiles, ele "sente o cheiro"
    (aviso) e vem atrás de você; perto dele o painel diz "Dar carne ao filhote" e o E dá (uma por dia, +1 de
    vínculo, como na cerca). Teste: `casal.spec.ts` (o sorteio da visita fixado com `Math.random`).
  - [x] A porteira do cercado (mantenedor, 2026-10-18: "poder entrar no cercado e ter uma porta pra sair e entrar;
    vínculo 2 o lobo já não tenta fugir quando a porta estiver aberta"; aguardando OK), tabela `PORTA` em
    `campanha/cercado.ts`: no meio do lado esquerdo (virado para a fogueira), dois mourões e uma folha que gira para
    fora; perto dela (por dentro ou por fora) o E abre/fecha. A cerca bloqueia por dentro e por fora; a heroína
    entra e sai só pela porteira aberta (`CC.dentro`). Aberta, lobo com vínculo abaixo de `PORTA.fogeAbaixo` = 2
    corre para ela e foge ("O lobo fugiu pela porteira!"); o do Caçador ele recupera em `PORTA.voltaDias` = 1 dia
    (`econ.lobosFugidos`), o do jogador (5b) se perde. Fecha sozinha a cada visita ao acampamento. Testes:
    `cercado.spec.ts` (entrar/sair, fugir e voltar, vínculo 2 fica).
  - [x] O lobo carregado pelo mapa (mantenedor, 2026-10-18: "no modo mapa deveria aparecer meu personagem
    carregando o lobo"; aguardando OK): saindo do campo com ele na corda, o lobo fica com a heroína
    (`LoboCercado.comHeroi`, posto por `loboNaSaida`) e é desenhado ao lado dela no mapa, na corda
    (`desenharLoboCarregado`, chamado por `drawHero` em `map/render.ts`, com o retrato de lobo do mapa); fora do
    cercado, das contas do casal e da carne da mão até ela chegar: parada no acampamento ou na cena dele
    (`loboChegou` em `casalTick`) → entra no cercado, com aviso. Teste: `carregar-lobo.spec.ts`.
  - [x] 5b. O jogador criar o próprio casal e o próprio filhote (o vínculo é dele e cai com descuido). Mesmo cercado
    (mantenedor).
    - [x] Lobo laçado fora da missão é seu (2026-10-18, depois de um teste do mantenedor: laçou um lobo branco
      depois da missão e ele sumia; o marrom no cercado era o do Caçador, que tinha voltado da fuga). Com o
      cercado já combinado (`feitas.a3_cercado`), `loboNaSaida` guarda o lobo na corda com `dono: "jogador"` (mesmo
      sexo, pelagem e ficha), vai com a heroína pelo mapa (na expedição do preparo ela volta direto ao
      acampamento, então entra já) e entra no cercado. Ninguém trata dele: cada dia sem comer da sua mão tira
      `VINCULO.descuidoDia` = 1 ponto (o do Caçador continua +1/dia). O painel da cerca marca "♂ seu". Fugiu pela
      porteira = perdido. Teste: `lobo-jogador.spec.ts`.
    - [x] O seu casal → o seu filhote (2026-10-18, aguardando OK; `casalDoJogador` em `cercado.ts`): macho e
      fêmea seus no vínculo 4 → nasce o seu filhote (uma vez por mãe, `teveFilhote`) e o aviso "Solte os pais em até
      2 dias (E na cerca)"; ninguém solta por você: soltou a tempo = `semPais` (cresce longe dos pais, pode virar pet
      no 5c); passou o prazo com eles lá = `cresceuLobo` (virou lobo, não cão).
    - [x] Soltar um lobo seu: **R** perto do cercado solta o seu lobo adulto mais perto (painel "R · Soltar este
      lobo · ♂ vínculo n/4"; o de pouco vínculo foge de você lá dentro, então não precisa encostar). Sai pela
      porteira e, pelo vínculo (`saida`, tabela `SOLTAR`): 0 vem e te morde uma vez (−`SOLTAR.dano`) e foge; 1–2 foge;
      3–4 rodeia a fogueira e vai. O cercado continua no acampamento mesmo vazio (`feitas.a3_cercado`).
    - [x] **Bug do mantenedor (2026-10-18): os lobos se multiplicavam com a porteira aberta.** O filhote do Caçador
      (vínculo 0) fugia; sem ele no cercado, o casal no vínculo 4 fazia nascer outro a cada quarto de segundo, que
      também fugia (39 voltaram com LOBOVOLTA). Agora o filhote nasce uma vez só (`flags.filhoteNasceu`; o seu, uma
      vez por mãe), o "2º lobo" conta os fugidos, o fugido aparece no tamanho dele, e `limparFilhotesRepetidos`
      conserta saves com filhotes repetidos (fica o primeiro). Testes em `cercado.spec.ts`.
    - Testes do 5b: `lobo-jogador.spec.ts`. GameShark `MEULOBO` (um lobo seu no cercado).
  - [ ] 5c. O filhote acompanhando na expedição (vínculo 2–3).
- [ ] 6. Vínculo 4: chamar, pegar o alvo do foco, a mordida que prende (cabo de guerra corpo a corpo), trazer aves
  vivas, defender o dono.
- **P** O filhote cresce (dias até poder ir à expedição) ou o vínculo basta?
- *Ideia para depois:* domesticar aves (os patos/aves pequenas trazidos vivos).

### C3 — Ato 4: viagem a pé e encontros na estrada
- [x] Ir vender na vila (2026-10-24, aguardando OK; o baú é infinito, então o gatilho é o fim do Ato 3): dormir com a
      `a3_cria` → o Caçador chama (`cacador_vila`) → vender no Empório a pé → `a4_vila_livre`. O bote fica furado
      (`flags.boteFurado`) até a doca consertar (Ato 6: `flags.boteConsertado`). Antes do Ato 4, baú com 100+ de valor
      só dá um aviso. Teste `ato4.spec.ts`.
- [ ] Encontro na estrada: durante viagem longa, chance de entrar no campo; mini masmorra de hordas **sem chefe**; ao limpar, volta ao mapa e a viagem continua. Precisa de tempo de recarga e opção de evitar (cansa rápido se for sempre).

### C4 — Atos 5 e 6: a vila
- [ ] Decidir o formato da vila (ver pergunta 1 abaixo).
- [ ] Taverna: dormir pagando, conversa do boato (norte, Runa Selvagem, runas antigas, artefatos).
- [ ] Quadro de missões (missões simples repetíveis: entregar couro, carne, madeira).
- [ ] NPC da doca: missão da madeira (minijogo de madeira) → conserto → espera de 2 dias → bote liberado + doca perto da floresta.
- [ ] Tutorial de pesca na doca (minijogo existe).
- [ ] Tutorial da fome: comer antes de voltar (alternativa: o Caçador pede um recado na vila).

### C5 — Atos 7 e 8: igreja e rastreamento
- [ ] Igreja, o Imortal e os dois cavaleiros (modelos: decidir se viram NPCs 3D ou retrato no diálogo).
- [ ] O Imortal lê a afinidade do jogador (texto muda com `h.aff`).
- [ ] Sistema de rastro: pegadas/marcas no campo que levam a um bicho; três pistas roteirizadas (lobo, javali alfa, coelho).
- [ ] Cena do vale: a Lebre Rúnica presa; o grupo recua para se preparar.

### C6 — Ato 9: preparação livre
- [ ] Missão aberta "prepare-se": lista sugerida de equipamento; o gatilho é falar com o Imortal na vila.

### C7 — Ato 10: o chefe
- [ ] Runa usável em combate (uma tecla), com bônus quando o elemento = afinidade do herói (atenção: a afinidade chama `raio`, a runa chama `energia`).
- [ ] Lebre Rúnica chefe: fases por vida; a runa encerra a fase 1.
- [ ] Aliados no campo (Imortal + 2 cavaleiros) lutando junto: IA simples.
- [ ] Ponto fraco: flecha na cauda, laço e atordoar abrem janela de dano; fora disso dano reduzido.
- [ ] Recompensa e a gema que fica com o Imortal.

### C8 — Ato 11: Agulha, cargas e artefato
- [ ] Runa com cargas (ex.: 5/5); mana do herói recarrega; atributo Mana sai do modo dormente.
- [ ] Missão de absorver uma runa natural (minijogo existe).
- [ ] Minijogo de criar artefato (novo, mais complexo que a absorção).

### C9 — Ato 12: fim da campanha
- [ ] Falas finais, convite ao Palácio dos Imortais, tela de fim de capítulo; o jogo continua livre depois.

---

## Decisões (mantenedor, 2026-10-23)
1. **A vila**: janela com abas agora (Empório, Taverna, Quadro, Doca, Igreja) para fechar o ciclo; a cena 3D andável
   fica para depois (já há pranchas de arte em `arquivos de transferência/Nova pasta/`).
   **Atualização 2026-10-24**: o mantenedor quis a cena andável já ("clico nela e já entro em um mapa de cidade, não
   as janelinhas"). Feita em `src/map/vila_cena.ts` (layout em `data/vila.ts` VILA_CENA): clicar na vila (ou chegar a
   pé) entra num mapa como o do acampamento; na porta de cada lugar o E abre a janela só daquele lugar (sem abas);
   o bote sai pela doca. Interiores andáveis ficam para depois, um de cada vez. As casas são feitas por código; trocar
   pelos modelos das pranchas (como os props do acampamento) é um passo seguinte possível.
2. **Runas naturais**: só depois de vencer a Lebre Rúnica (Ato 10). Antes disso não há absorção nem forja de runas.
3. **Recompensa do chefe**: ouro + item raro + a **ferramenta Agulha** (a gema fica com o Imortal).
4. **A Agulha**: é a ferramenta (a mesma do minijogo de absorção), não um artefato. A campanha é um grande tutorial
   de criar artefatos: a mecânica da agulha é explicada no Ato 10 e o jogador ganha a sua no fim. Logo, a agulha
   comum não deve estar disponível antes disso (rever onde ela é dada/vendida hoje).
5. **Vários heróis**: a campanha segue só a primeira heroína; as outras jogam livre, sem missões.
6. **A armadura que rasga** no Ato 3: o lobo (já feito, C2 passo 1).

## Decisões (mantenedor, 2026-10-24)
1. **Os lobos não travam a história** ("a missão do lobo atrasa o andamento"): a corrente principal do Ato 3 ficou
   brasa → laçar → levar → cercado → costura → armadura → Ato 4 (vila). Cuidar dos lobos (alimentar, vínculo,
   pedidos de carne, casal, filhote, soltar os pais, a noite da cria) virou a **linha paralela** `lobos`, aberta pela
   missão do cercado (`abre` em `a3_cercado`) e guardada em `econ.campanha.paralela`. Os eventos e os chamados do
   Caçador valem para as duas; o quadro #missao mostra a dos lobos numa linha menor e o diário (J) num bloco próprio.
   O filhote agora espera o 1º pedido entregue (`feitas.a3_pedido`), não a armadura. Saves antigos são migrados
   pelas missões feitas (`migrarParalela`). A 1ª página de `cacador_vila` mudou (antes falava do filhote): **proposta,
   aguardando o OK**.
2. **Balões de diálogo** (próximo passo, a desenhar): falas curtas sobre o Caçador sem parar o jogo; a linha dos lobos
   avança por eles, e o ❗ fica para a história principal.

## Decisões em aberto
1. **Ordem do Ato 6**: são cinco tutoriais seguidos (fome, NPCs, madeira, pesca, barco). Juntar ou deixar alguns opcionais no quadro de missões.
