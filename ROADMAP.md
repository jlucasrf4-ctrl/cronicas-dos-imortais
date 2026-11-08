# ROADMAP — fechar um ciclo de jogo funcional

Recriado em 2026-10-23 (o antigo, da reforma técnica, não veio para esta pasta; a história dele está em
[docs/roadmap-historico.md](docs/roadmap-historico.md)). Mesmo jeito de trabalhar: uma tarefa por vez, aprovada pelo
mantenedor, marcar a caixa e atualizar o Status.

**Objetivo:** um ciclo completo jogável: personagem novo → expedições → acampamento → vender/equipar na vila → chefe
→ fim de capítulo (o jogo continua livre depois).

**Status:** 2026-10-30, acampamento no campo aberto + lobo do caminho, raposas no campo, pedras fora do acampamento,
painel do clã (passo 1), javali × árvores e o fôlego de desespero feitos (aguardando OK). Próximo: trabalhos do clã
que depositam no baú e repetem + avisos com ação; a Runa Natural como chefe ("X está em perigo", reforços); o urso nas
clareiras; os bandidos à noite. Depois o ciclo da campanha (a pista até o vale e o chefe).

## Pedido do mantenedor (2026-11-03) — personagens e modelos novos

### Stamina progressiva — 2026-11-05

**Status:** regras implementadas; animação específica de ferido pendente (não existe nos clips atuais).
Ginga, puxada/tensão do arco e madeira usam consumo externo centralizado, com perda de 20 pontos internos
por transição positiva para zero. Mantidos o mínimo externo da Ginga e a perda de mira do arco sem fôlego;
o corte continua mesmo com ambas as barras vazias. Corrida interpola a curva configurável da reserva.
Inimigos perdem 25% internos por quebra, com chances progressivas, fuga final e proteção ao levantar.
Tempos de chão e taxas/esperas de recuperação preservados; a reserva de combate deixa de limitar o teto externo,
permitindo recuperar mesmo com reserva zero. Laço mantém seu teto próprio.

- [x] Centralizar consumo das atividades e parâmetros, sem penalidade repetida enquanto vazio.
- [x] Separar quebras de resistência das quedas e aplicar exaustão progressiva.
- [x] Preservar corte vazio e cobrar 3% externos uma vez no contato válido com a árvore.
- [x] Suavizar a velocidade de corrida pela stamina interna.
- [ ] Adicionar/selecionar clip específico de ferido quando houver recurso disponível.

### Ataque básico automático — 2026-11-05

**Status:** opção experimental “Ataque básico automático (teste)” nas Opções, desligada por padrão
e salva neste navegador. Desligar restaura um golpe por clique e encerra a sequência em curso.
Quando ligada, clique esquerdo no inimigo inicia os básicos ao alcance, usando os golpes existentes
(combo, recarga, dano e carga da clava). O inimigo escolhido é independente do alvo prioritário
dos avisos. Botão direito mantém o especial da arma e suspende os básicos; Esc ou clique no
chão encerram o automático. Movimento continua em WASD; arco mantém carga e disparo manuais.
Tipos, lint, build e regressão no navegador aprovados.

- [x] Repetir básicos no inimigo clicado, preservando as mecânicas de cada arma.
- [x] Respeitar alcance, pausa, especiais e cancelamento; manter a carga básica da clava após soltar o clique.

### Ajustes de 2026-11-06 (referência LoL)

- [x] Básico automático limitado a 1,5 por segundo (`ATAQUE_AUTO`, acelerado pelo atributo velocidade).
- [x] Básico do arco no automático: tiro sem carga no inimigo clicado, 5 tiles, 0,6× o dano base, 1 flecha (`ARCO_BASICO`).
      Refeito no mesmo dia ("rajadão", alcance grande): o clique puxa a corda por 3 s com som de corda, mirando no alvo
      e mostrando o percurso no chão, e solta sozinha com a força da carga cheia (1,5×); 3,5 tiles; 0,4 s até a próxima
      puxada; fora do alcance ela segura a corda; o botão direito no meio assume como tiro carregado.
      Depois, a pedido: puxada 50% mais rápida (3 s → 2 s).
- [x] Segurar Alt: anel fino do alcance do básico (no arco, também o do tiro carregado, mais apagado).
- [x] Quebra de fôlego sem queda: a próxima barra do inimigo já vem cheia (cada quebra custa o mesmo esforço).
- [x] Primeiro personagem escolhe rosto e cores de pele/cabelo depois de nascer (corpo segue sorteado); os seguintes
      nascem sorteados. Corpos das deusas fora do sorteio (as cabeças continuam).
- [x] Aura das deusas: fitas que enrolam o corpo só em corpo de deusa e mais transparentes; véus soltos mais leves.
- [ ] Ataque automático andar até o alvo fora do alcance (decidir) · marca própria do alvo automático.

### Sorteio feminino completo — 2026-11-04

**Status:** restaurado o sorteio independente e uniforme de corpo e cabeça: todos os
13 corpos femininos (incluindo heroína, líder e deusas), 28 cabeças femininas e a opção
de cabeça própria. Removida a restrição aos seis corpos com cabeça própria. Pesos antigos
e notas do Editor não interferem nas chances. A migração única preserva os visuais femininos
válidos; personagens já migrados mantêm suas escolhas. Build, lint, 23 testes unitários e
teste de criação de mil personagens no navegador aprovados.

- [x] Restaurar todas as cabeças e corpos femininos, incluindo heroína e líder.
- [x] Conferir distribuição em 30 mil sorteios e no fluxo real de criação.

### Cravada — 2026-11-04

Correção da pegada após o relato do braço esticando: as mãos são resolvidas sobre o cabo
da arma já posicionada, com cotovelos articulados e alcance limitado pelo comprimento
real dos ossos do corpo vestido. O punho adicional da lança agora acompanha a palma,
em vez de avançar separado junto com a origem da arma. Roupa e corpo compartilham a
pose corrigida. Oito testes unitários passaram (heroína, F02, F06 e poses existentes),
além de duas regressões no navegador, capturas antes/depois, tipos, lint e build.

**Status:** revisada após o relato de que o corpo avançava e a lança não entrava na pele.
A profundidade agora desloca somente a arma, sem encurtar a distância entre os corpos.
O contato usa os triângulos da pele animada; a lança penetra até 18% do seu comprimento
real, preservando o avanço ao soltar. Mantidos os tiques de 1 de vida / 2 de fôlego.
Tipos, lint, build e duas regressões de navegador aprovados; o teste da lança verifica
contato na pele, avanço de 18% e deslocamento zero dos corpos. Capturas antes/depois conferidas.

- [x] Desenhar a arma presa no animal, acompanhando o corpo e a direção da mão.
- [x] Limitar a penetração a 18%, sem recuar ao soltar o botão.
- [x] Consumir vida e fôlego em tiques de 1 de vida / 2 de fôlego.
- [x] Corrigir a lança: medir o comprimento real, atravessar a pele e retirar o avanço dos corpos.
- [x] Alinhar as mãos ao cabo sem alongar braço/antebraço e manter o punho adicional preso à palma.

### F2 e feedback de combate — 2026-11-04

**Status:** F2 corrigido e regressão principal aprovada no navegador. Parry usa Espada 02;
o perfeito usa Espada 1. Removidos os rótulos ALVO, FOCO e ALVO · FOCO e as setinhas.
Números de dano restaurados; seleção desenhada no chão 3D com profundidade, acompanhando o relevo.
Tipos, lint e build aprovados; teste de navegador confirmou os dois estados de animação,
desenho do número do golpe, ausência dos rótulos e anel no plano do chão.

- [x] Tornar a migração de aparência única, preservando escolhas posteriores do F2.
- [x] Restaurar a aparência por personagem e recuperar o visor ao reabrir Aparências.
- [x] Animar a tentativa de parry sem exigir guarda mantida; afinar os arcos de contato.
- [x] Retirar rótulos de alvo/foco e setinhas dos avisos, preservando anéis de seleção e ícones de itens.
- [x] Usar espada_2 no parry e espada_1 no perfeito; manter números dos golpes.
- [x] Colocar os anéis de alvo/foco no chão WebGL, ocultos pelo corpo quando necessário.

### Revisão visual em etapas — 2026-11-03

Orientação do mantenedor em 2026-11-04: aproveitar o busto completo dos novos arquivos. Fonte F02 inspecionada em frente, perfil e costas: cabeça, pescoço, clavículas, peito, costas e braços parciais em T; 283.537 triângulos, sem rig ou animação. A integração ainda está pendente. O experimento de emenda curta do pescoço foi separado e desativado; a próxima montagem deve conservar a região superior original e unir tronco e braços.

Refino individual iniciado na F02: removidos 94 triângulos desconectados do recorte antigo. Cobertura de pele recuperada nas três peças aventureiras, calculada por peça final e conferida em 16 vistas/poses, com roupa completa, sem peitoral e sem peças extras. Pescoço, cintura, calçados, demais roupas e combinações ainda têm pendências; nenhuma combinação foi aprovada como acabamento final.


Revisão após regressões relatadas em 2026-11-04: descartada a troca global do eixo do pescoço pelo osso Neck,
restaurando a referência individual de encaixe. A tintura automática pela cabeça também foi retirada: piorava o
tom de pele em algumas combinações. Os experimentos foram guardados separadamente, sem aprovação visual.
As 398 capturas de referência estão sem armaduras extras: não comprovam o ajuste das camadas de roupa.
Próximo passo: uma combinação com e sem cada peça, em frente/perfil/costas e ao longo dos movimentos, antes de expandir.


Primeiro refino dos ombros em 2026-11-04: aplicado somente na Atlética F02 e nas suas peças de roupa. Pivôs dos braços reposicionados dentro dos deltoides; pesos suavizados localmente. Posições de repouso da superfície, triângulos, UVs, cores e demais corpos preservados. Capturas comparáveis frontal/perfil e detalhe em outputs deste chat. Acabamento anatômico e expansão aos demais corpos continuam pendentes.

Correção adicional de 2026-11-04: o pulso acompanha a direção do antebraço, sem forçar os dedos para baixo. Corpo e roupa agora compartilham a pose já resolvida no campo e no retrato; não há segunda correção independente na luva. Cinco regressões passaram, incluindo três corpos e transições com roupa. O acabamento de ombro/cotovelo e os pesos da malha continuam na etapa anatômica.

Revisão de 2026-11-04: repouso com mais folga lateral e polo do cotovelo para trás,
conforme referência desenhada do mantenedor. Teste da pose verifica punho à frente do
cotovelo, comprimentos dos ossos e preservação de caminhada, corrida, guarda e mira.

**Status:** primeira etapa (idle) ajustada e conferida de frente/perfil na heroína e Atlética F02.
Capturas antes/depois usam a mesma câmera e instante. Braços e direção real dos dedos são ajustados
sobre o corpo vestido antes da mistura de estados; mira, guarda e locomoção preservadas.
Cós F01 aventureira em protótipo no gerador, ainda sem empacotar; pescoço em correção parcial.

- [x] Relaxar braços e mãos no idle; comparar frente/perfil e verificar transição para andar/mirar.
- [ ] Concluir cós da calça sem camisa, com cobertura traseira e lateral e sem deformar botas.
- [ ] Corrigir pivô, escala e emenda cabeça/pescoço; aproveitar bustos na transição anatômica.
  - 2026-11-07 — cabeças trocadas centradas (nariz na linha do meio do esqueleto; frente/trás pelo encaixe do pescoço na abertura do corpo) e rosto dos bustos integrais centrado (`ENCAIXE_CABECA`). Emenda: `render/gl/gola.ts acabarPescoco` fecha com pele os buracos laterais do recorte (tira da F05, ombro da Líder), recolhe para dentro do peito o resto de colo das cabeças e, onde a abertura do corpo fica para fora do pescoço da cabeça, cobre a emenda com um pescoço de pele medido por raios (tabela `GOLA`, modo "pele": cada face copia a pele ou o decote da roupa embaixo, indo para a pele do rosto; o modo "pano" ficou como opção); com peitoral vestido só cobre o que fica à mostra. Os restos do cabelo ruivo original na boca do pescoço da F02 (a "gargantilha" vermelha) são limpos. O nariz das cabeças trocadas é achado sem janela de lado (a F16 ficava ~1 u ao lado do pescoço, "cabeça manca"). O cabelo apoiado no ombro acompanha o ombro (`CABELO_OMBRO`: a mecha da busto_04 cortava a ombreira). F16 na F02 sai do busto integral (`INTEGRAIS_FORA`). Ponto de pele no cabelo da busto_15 e 10 parecidos corrigidos (`tools/corrigir-uv-cabelo.ts`, também no gerador). Testes: `tests/unit/gola-pescoco.test.ts`; prévias `build/previas/pescoco/`. Pendente: aprovação visual; Líder (veste as peças da F01, o pescoço de pele cobre os rombos do peito/costas).
- [ ] Refinar ombros, braços e busto; eliminar pele atravessando roupas durante animações.
- [ ] Conferir visualmente cores rosto/corpo e botão Vestir a heroína.
- [ ] Refinar queixos, proporções de cabeça e traseira dos cabelos; avaliar mechas articuladas.
- [ ] Avaliar GLB 7135044f-e0c5-42fc-888b-d1d3c596a424 para a Voluptuosa (sem rig/textura na origem).
- [ ] Corrigir pose do arco ao mirar para esquerda e verificar demais direções.
- [ ] Refinar ciclos quadrúpedes das criaturas: apoios, articulações, peso e transições.
- [ ] Entregar prints por etapa e conferir versões finais no jogo.

### Continuação — cinemática e cabana

**Status:** concluído. Movimentos procedurais de patas no coelho e na forma de fogo,
respiração, pequeno avanço e mandíbula; entrada da preparação usa `treinoDeQualquerLugar`
para aceitar o personagem na cabana. Build, tipos, teste de movimento e os dois testes
de navegador (cinemática completa e botão dentro do acampamento) passaram.

- [x] Articular as malhas da cinemática pelo tempo da cena, preservando pulos, orelhas e transformação.
- [x] Corrigir o botão `prep-train`, que ainda chamava a entrada restrita a personagens livres.
- [x] Conferir a abertura e a entrada na Dungeon Teste pelo navegador.

**Status:** personagens e prévia entregues; detalhes em `docs/personagens-2026-11-03.md`.
Cópia anterior em `backups/personagens-2026-11-03/`.
Teto atualizado pelo mantenedor em 2026-11-05: cerca de 25 mil triângulos no personagem completo, priorizando a definição do rosto.

Revisão de 2026-11-05: F01–F06 usam montagens integrais individuais, com cabeça, pescoço, ombros e busto da fonte. Abdômen e braços são unidos por contornos fechados no mesmo esqueleto, sem alongar o peito para alcançar a cintura. Quatro conjuntos de roupa por montagem (24 no total) foram ajustados; cós e alças respeitam as alturas de cada corpo. Cabeças regeneradas com prioridade geométrica para a face. Auditoria usa as combinações reais e o teto de 25 mil; referências e instruções em `docs/modelos-modulares-2026-11-05.md`. A conferência de todas as cabeças alternativas, roupas misturadas e movimentos extremos continua pendente.

- [ ] Reconstruir os corpos e os personagens existentes, preservando as animações e corrigindo os pesos dos ombros.
- [ ] Preparar os 16 bustos texturizados e seus encaixes; seis rostos correspondentes como padrão dos corpos femininos.
- [ ] Separar e ajustar as cores dos 12 NPCs das folhas novas e preparar a guarda de armadura branca.
- [ ] Preparar esqueletos e animações da quimera, grifo e hidra de cinco cabeças, disponíveis no teste.
- [ ] Prévia com seleção de modelo, cabeça e movimento, pausa, giro e aproximação; botão na sala de treino e código MODELOS.
- [ ] Conferir orçamento, integridade, animações, desempenho e gerar o jogo atualizado.

## Pedido do mantenedor (2026-10-31) — Modo Editor (decorar vendo ao vivo)
Etapas 0–5 autorizadas em sequência, sem aprovação entre elas; da 6 em diante, propor antes.
- [x] **0. Ver ao vivo**: `Abrir jogo ao vivo.bat` (na pasta do projeto e em `H:\Projeto Cronicas`) = `npx vite --open`.
- [x] **1. Editor básico** (`src/editor/editor.ts`, F2 no campo; botão "🛠 Editor" só no modo ao vivo): colocar,
      mover, girar, tamanho, altura, apagar, desfazer/refazer, salvar sozinho, **Testar aqui** (T) e **recados** (📌,
      N) para o Claude. **Aguardando OK.**
- [x] **2. Biblioteca automática + inspetor**: cenário, vila (com textura), itens, minérios e "Meus modelos" (`.glb` em
      `modelos-novos/` → `tools/lib/importar.ts` pelo servidor ao vivo); inspetor com tamanho, giro, altura, cor,
      camada, ilumina. **Aguardando OK.**
- [x] **3. Conforto**: camadas (👁/🔒), grade com ímã (G), duplicar/copiar/colar, conjuntos (🧩), pincel com variação
      (P, Shift apaga). **Aguardando OK.**
- [x] **4. Segurança**: grava sozinho 4 s depois de mexer, rascunho no navegador (recuperar), histórico em
      `editor-historico/` (a cada 5 min e a cada 💾), Antes/Depois (segurar Espaço). **Aguardando OK.**
- [x] **5. Atmosfera**: hora do dia fixada e prévia das 4 estações (só no editor), luzes (fogo, tocha, janela; peças
      que iluminam), efeitos (fumaça, vaga-lumes, folhas, neblina, faíscas), sons de área sintetizados (rio, mar,
      vento, floresta, fogo, grilos, vila). **Aguardando OK.**
- [x] **Pedidos de 31/10 (tarde)**: mini mapa (M); pincel de terreno (⛰, I: terra/água, vale no campo e no mapa 2D);
      piscada no zoom afastado corrigida; emblemas das deusas nos botões de estação; prévia de estação repinta árvores,
      chão e capim + peças de estação na biblioteca; **árvores e pedras postas cortam/quebram de verdade** e **as do mapa
      podem ser apagadas** (clique, caixa ou pincel com Shift). **Aguardando OK.**
- [x] **Luta contra humanos (31/10, noite)**: sem avisos na tela contra bandidos (sem anel/⚠/cone/linha de mira/
      "ALVO·FOCO"/"Fúria!"/"Acordou!"); o golpe se lê na arma que brilha no fim do preparo (`BANDO.brilho`) e no fôlego
      antes do pesado (som); o caído tem corpo de verdade (`corpoCaido`: o acerto e o anel no corpo deitado, não nos
      pés; `wolfBody`/`centroCorpo` em acertos.ts); mais resposta (`IMPACTO_SENTIDO`, tomar dano tem som e congelada,
      parry contra humano = aço e faíscas). Dificuldade (combos, fintas, punir o erro) fica para depois de jogar.
      **Aguardando OK.**
- [x] **Inimigos mais vivos (01/11)**: bandidos vêm correndo de longe, golpe leve ~0,25 s, combos de até 3 (o último
      deixa exposto), investida de meia distância, aproveitam você golpeando no vazio ou rolando, vez a cada 0,8 s
      (`BANDO.combo/corre/investida/punir`). Javali procura um lugar com a linha livre antes de investir e desvia de
      tronco/água na corrida (`JAVALI_PENSA`). **Aguardando OK.**
- [ ] 6. Jogabilidade (propor antes): áreas de caça, muros invisíveis, NPCs com falas e ronda, eventos
      "Quando… Então…", baús.
- [ ] 7. Visualizador de modelos e tabelas editáveis (itens, forja).
- [ ] Não resolvido: o editor só existe nas cenas 3D do campo (campo aberto, vila, acampamento, treino), não no mapa
      2D; o Antes/Depois é segurar para ver (não tem divisória arrastável); um `.glb` com muitas costuras de textura
      pode não reduzir (a deusa ficou com 21 mil triângulos).

## Pedido do mantenedor (2026-10-30) — clã, perigos e bichos
- [x] **Painel do clã, passo 1** (`ui/painel.ts`, CSS `59_v8.1_cla.css`): um cartão por personagem (atividade, barra
      do trabalho, vida, alertas ● ponto e ✚ ferida); clique seleciona, de novo centraliza; as ordens só de quem está
      em foco. População, Eventos e Controles começam fechados na barra de janelas. **Aguardando OK.**
- [x] **A caçada não puxa** (decisão "a"): o aviso "achou a presa" só leva ao campo se clicado; ignorado
      (`CACADA.aviso`, 6 s) ou Esc, segue automática. **Aguardando OK.**
- [x] **Estados da heroína perto dela** (2026-10-31, `field/estados.ts`, `ESTADOS_UI`/`ESTADOS_LIM` em
      `data/estados.ts`, CSS `60_v8.1_estados.css`): três estilos ligáveis nas Opções (pode mais de um): dentro do
      anel (combate a cada 1,6 s; fome, frio, ferida e carga como lembrete a cada 1:30), selos na borda (até 3,
      amarelo/vermelho/dourado) e a fita sob os pés, que abre o painel com problemas, bônus e necessidades. Os cartões
      do clã mostram os mesmos selos e abrem o mesmo painel. Estados de hoje: tonta, debilitada, guarda quebrada, fome,
      frio, ferida, carga. **Aguardando OK.**
- [x] **Machado, picareta e a vida das árvores e pedras** (2026-10-31, `GOLPES_RECURSO` e `PEDRA_QUEBRA` em
      `data/combate.ts`, `field/recursos_campo.ts`): golpes para derrubar/quebrar por tamanho e qualidade (verde 3–5,
      amarelo 5–8, laranja 8–12); barrinha de vida discreta em cima do golpeado. Picareta nova (`eq_picareta`, mesmo
      golpe carregado do machado, trava numa pedra): a cada golpe pode cair pedra ou minério (ORE_TABLE) no chão, e ao
      quebrar caem as pedras do fim. Ofício novo Minerador. A heroína ganha machado e picareta na mochila na primeira
      saída (`econ._ferramentas`). **Aguardando OK.**
- [ ] Necessidades e clima (ideia, 2026-10-31): descanso, corpo frio ↔ calor, molhada, correnteza nos rios, chuva/sol
      forte/neblina/tempestade, bônus de comida e de "tudo alto"; sede a decidir. Entram em `estadosDe` e aparecem nos
      três estilos sozinhos.
- [ ] Painel do clã, passo 2: trabalhos "uma vez / até encher / sempre"; ao encher a mochila **deposita no baú** e
      recomeça (decisão do mantenedor); o feed de eventos vira avisos com ação ("Bru terminou · mandar de novo").
- [x] **Runa Natural = chefe** (2026-10-31, `map/perigo.ts`, `PERIGO` em `data/perigo.ts`, CSS `62_v8.1_perigo.css`):
      bicho rúnico perto de quem trabalha sozinha no mapa → o jogo pausa, a câmera vai até ela e abre o painel "X está
      em perigo" (reforços com o tempo de chegada, Lutar ou Deixar). Sozinha 30%, +20% por reforço. Lutar: o bicho vira
      chefe no campo (vida ×5, dano ×1,5, aura; coelho e cervo com o próprio modelo) e o contador "ajuda a caminho";
      os reforços que chegam atiram flechas (até aliados lutarem junto). Derrota: volta ferida ao acampamento.
      Vitória: runa bruta e experiência. **Aguardando OK.** O mesmo sistema vai servir aos bandidos.
- [ ] **Urso** (`bear.fbx` do pacote craftpix, via `tools/gerar-bichos.ts`): por enquanto nas clareiras do campo
      aberto. **Depois: entrar no ecossistema do mapa** (população, caça) — não esquecer.
- [x] **Bandidos à noite** (`field/bandidos.ts`, `data/bandidos.ts`, `render/gl/bandidos_gl.ts`, `map/perigo.ts`).
      Decisão (2026-10-31): na maioria das vezes no campo, mas também atacam quem trabalha sozinho no mapa à noite;
      **sempre com aviso antes**, igual à Runa Natural (o painel do Perigo, reforços, "ajuda a caminho"; com bandidos
      também "Entregar o ouro"). A luta contra humanos refeita: ficha própria por tipo (capuz, arqueiro, colete com
      escudo, bruto, couraça), preparo visível, reação só ao que ele vê, no máximo 2 atacando por vez, fôlego dos
      bichos. Caído: E finaliza, R poupa (entrega algo, foge ou trai). O último de pé foge abaixo de 80% e luta até a
      morte com 20%. Cada um com o próprio animado vestido (vestidos.json). **Aguardando OK.**
      Falta: botão de poupar no celular; o parceiro da sala de treino na IA nova; seta na borda de onde o bando vem.
- [ ] **Líder dos bandidos** (`lider_bandidos`) só no final, e pode virar personagem jogável do clã se o jogador
      decidir não finalizá-la.
- [x] **Javali × árvores** (`BOAR_ARVORE` em `data/especies.ts`, `linhaLivre` em `map/mundo.ts`): só mira com o
      caminho até a heroína livre; na investida, só a trombada de frente conta (raspar escorrega); a trombada atordoa
      e cansa (30% do fôlego). Esquivar com uma árvore atrás é a jogada. Passeando ou rodeando, troca de rumo em vez
      de empurrar o tronco. **Aguardando OK.**
- [x] **Fôlego de desespero** (`FOLEGO.desespero` em `data/combate.ts`): ao levantar de uma queda, 4 s em que o
      fôlego não cai; presa e bicho neutro fogem para longe 35% mais rápido (podem escapar); predador bravo fica em
      fúria (+30% de dano, frenesi do lobo, fúria do javali). **Aguardando OK.**

## Pedido do mantenedor (2026-10-23)
- [x] Versão v8.0 (`<title>`, `MV_VER`, `package.json`; o teste de montagem ignora o número no título).
- [x] Aba de missões (`campanha/diario.ts`, CSS `50_v8.0_diario.css`): J ou clique no quadro do objetivo; missão
      atual, ❗ do Caçador, dicas (`dicas` em `MISSOES`), concluídas por ato; ✕/J/Esc fecham; pausa o campo.
      Teste `missoes.spec.ts`. **Aguardando OK.**
- [x] Lição do rolamento na cena inicial (`ISC_ESQUIVA` em `data/intro.ts`, câmera lenta `dungeon.camLenta`): na 1ª
      investida o tempo desacelera e, perto dela, **congela** com a tela "Aperte ESPAÇO para desviar" (`#isc-esq`, CSS
      `51_v8.0_intro_esquiva.css`) até ela rolar (sem limite de tempo, correção do mantenedor); rolou = passa; a
      investida seguinte acerta uma vez e o Caçador chega antes da segunda. Teste `missoes.spec.ts`. **Aguardando OK.**
- [x] **Mundo ligado** (decisão: campo = pedaço do mapa): entrar abre o campo no ponto exato do mapa; andar no campo
      move a heroína no mapa em tempo real; na borda o campo passa ao pedaço vizinho; sair volta no mesmo ponto; bichos
      do mapa perto dela aparecem no campo. ~4–6 sessões, em passos:
  - [x] 1. Escala e posição (2026-10-23, `map/mundo.ts`, tabela `MUNDO`, `dungeon.origem`): o campo aberto pelo mapa
        é o pedaço em volta dela (escala 0,155 unidade do mapa por px do campo: o campo inteiro ≈ o mapa no zoom
        máximo); ela aparece no meio; cada passo move `h.x/h.y` e `JOGO.pos`; sair devolve onde ela está (fora da
        água). Acampamento, treino e expedições do preparo seguem arenas. Teste `mundo.spec.ts`. **Aguardando OK.**
  - [x] 2. Sem borda (2026-10-24, mantenedor: "ainda é aquela telinha"): o campo aberto é uma janela de 3 × 3 vistas
        (63 × 39 casas) que **desliza** quando ela se afasta 9 casas do meio (`deslocar` em `map/mundo.ts`: a origem
        anda e tudo o que está no campo volta o mesmo tanto, sem corte); a câmera enquadra só a vista (21 × 13).
        Bichos e itens nascem a até 15 casas dela, em terra (`pontoPerto`). Teste `mundo.spec.ts`. **Aguardando OK.**
  - [x] 3. Terreno do mapa (2026-10-24, mantenedor: "floresta cheia de árvore… do lado de um rio coloca um rio"):
        `map/terreno.ts` lê o mapa (água pelo contorno da costa, como o mapa recorta a terra; floresta, montanha; cor da
        terra) e `render/gl/mundo_cena.ts` monta o cenário em blocos de 6 casas presos ao lugar do mundo: as MESMAS
        árvores do mapa no zoom máximo (mesma grade e hash de `maGenSymbols`), mato pela floresta, pedras na montanha,
        água rasa/funda com margem de areia suave. Água e troncos barram a heroína (`mundoMover`). Só os blocos perto da
        câmera são desenhados (2 novos por quadro, 70 na memória; `glFree` agora apaga os buffers também); a sombra
        refaz só ao trocar de bloco. **Aguardando OK.**
  - [x] 4. Bichos do mapa ↔ bichos do campo (2026-10-24, `BICHOS` em `map/mundo.ts`): coelhos, cervos e 1 lobo do
        mapa dentro da janela entram no campo onde estão (até 8, os mais perto), ligados (`m.bichoMapa`); enquanto
        ligados, o mapa não os move (`sim/motor.ts`) e o campo escreve a posição deles no mapa; derrubado no campo =
        morre no mapa; fugiu ou saiu da janela = volta a viver no mapa. No campo aberto não há mais coelho/cervo
        sorteado: só repovoa se ali estiver vazio, e o bicho novo nasce no mapa também (`bichoNovo`). A presa da caçada
        é o próprio bicho do mapa. Bichos do campo não entram na água nem atravessam tronco. Teste `mundo.spec.ts`.
        **Aguardando OK.**
        - [x] Javalis (2026-10-24, mantenedor: "não encontro javalis, patos ou raposas"): até 2 javalis do mapa
          (`BICHOS.javalis`) entram como o javali da investida (`spawnJavalino`, nome "Javali"); no campo aberto ele
          não entra na água nem atravessa tronco, e bater nisso na investida = bater na parede. **Aguardando OK.**
        - [x] Raposas (2026-10-30, mantenedor: "não vejo raposas em Game"): até 2 raposas do mapa (`world.wild`,
          `BICHOS.raposas`) entram no campo aberto ligadas como os outros bichos; presas, o mapa não as move nem as faz
          fugir da heroína; derrubadas, morrem no mapa (`killWild`). **Aguardando OK.**
        - [ ] Patos (sem modelo 3D ainda).
  - [x] Rastro da presa (2026-10-24, mantenedor: "dificuldade de rastrear o cervo"; `field/rastro.ts`, `RASTRO` em
        `data/mapa.ts`): a presa da caçada deixa pegadas no chão que somem em 45 s; ao entrar, um rastro já sai de
        perto da heroína até ela; fora da tela, uma seta na borda aponta para ela com a distância em passos. Teste
        `cacada.spec.ts`. **Aguardando OK.**
  - [x] Caçada mais difícil e perícia Rastreio (2026-10-24, mantenedor): no campo aberto a presa nasce a 18–24 casas
        (`CACADA.longe`); o tempo caiu de 90 para 60 s; às vezes (45%, menos com a perícia) não há pegada nem seta no
        começo, só fezes pelo caminho, e chegar nelas revela o rastro; perícia **Rastreio** (👣, `data/atributos.ts`):
        menos caçadas sem rastro, pegadas mais longas, fezes de mais longe; sobe ao pisar nas pegadas, achar fezes e
        abater. Teste `cacada.spec.ts`. **Aguardando OK.**
  - [x] Arco (2026-10-24, mantenedor: "solta sozinho… não consigo cancelar… não mostra quanto tempo"; `ARCO_FOL` em
        `data/combate.ts`): clique esquerdo puxando cancela o tiro; cheio, cada 0,4 s gasta 10 do fôlego interno
        (o cinza do anel, o mesmo do rolamento; os tracinhos saíram a pedido do mantenedor); sem interno para mais um
        passo perde a mira, sem atirar; o interno gasto assim volta 2,5× mais rápido. Interno e fôlego de fora
        separados (mantenedor: "segurar o arco não deve afetar o quanto você vai correr"): o interno não é mais o teto
        do verde; só zerar o interno derruba o verde (`FOL_HEROI.queda`); o interno sobe com o verde cheio; o verde
        volta sempre na mesma velocidade (`voltaFora`). Celular
        ainda sem cancelar. Teste `armas.spec.ts`. **Aguardando OK.**
  - [x] Impacto (2026-10-24, mantenedor): o impacto sempre entra no dano, mas empurrar/interromper o bote/atordoar só
        com arma de ≥ 25% de impacto (`DANO.IMPACTO.minEfeito`: clava, maça, martelo, machado, lança de caça, flechas,
        punho). Espada e faca não interrompem mais; o golpe que interrompe sem impacto é só o 3º do combo (antes também
        qualquer golpe isolado com ≥ 5,5 de dano). Teste `impacto.spec.ts`. **Aguardando OK.**
  - [x] Combate (2026-10-24, mantenedor: "pode seguir, faça as mudanças"; tabelas em `data/combate.ts`). **Aguardando
        OK.** Testes `parry.spec.ts`, `derrubar.spec.ts`, `impacto.spec.ts`; `campo-lobos` t2/t7 e `lobo` (finalizar)
        atualizados para as regras novas.
    - Parry como janela ativa (`PARRY`, `parryNaChegada` em `field/chao.ts`): o clique abre 0,45 s; cada golpe de frente
      é avaliado quando CHEGA (perfeito até 0,2 s), inclusive de um lobo que começou depois; invulnerável só 0,4 s (era
      2,5 s); anel que fecha em volta do lobo até o instante do golpe; perfeito: tela parada, câmera lenta curta
      (`dungeon.lenta`), "PARRY!" grande, cansa o bicho (35% do fôlego), o contra-ataque sai na hora.
    - Esquiva no último instante (`ESQUIVA`, rolamento e footwork): câmera lenta, anéis, "ESQUIVA PERFEITA!", devolve
      fôlego (10 + 8 do interno) e cansa o bicho (20%).
    - Fôlego dos bichos: o dano derruba com ~75% da vida (`DANO.FOLEGO.golpe` 2,2 → 1,3).
    - Finalizar (`FINALIZAR`): lobo/javali só morre com até 35% da vida; acima, golpe fundo (30%) e levanta; bicho de
      caça sempre morre; a animação é o 3º golpe do combo com o pico no acerto (não mais a pose de pegar item), tela
      parada e câmera lenta.
    - Flecha: a cravada tira 25% do fôlego do bicho (45% com carga cheia) em vez de 5 fixos; o cervo ferido cansa menos
      fugindo (0,8 → 0,3/s): uma flecha comum não derruba sozinha. Bicho ferido/sangrando deixa sangue no chão
      (`dungeon.sangue`, `field/rastro.ts`, `RASTRO.sangue`).
    - Sangramento proporcional ao corte (`DANO.CORTE.frac`), acumula até 3 cortes, teto 35% da vida (era 5 fixos).
      Ajuste do mantenedor (jogando, 2026-10-24: "o sangramento está dando 0 de dano… tinha que dar dano na stamina"):
      pulsos de pelo menos 1 (`bleedTick`), sangrar cansa como golpe e trava a volta do fôlego; o cervo flechado volta
      a cansar fugindo (`corridaFol` 0,8: cai quando o fôlego zera); caído, o fôlego enche aos poucos (`folTick`) e ele
      levanta fugindo (ferido, pode cair de novo).
    - Perfurar: toda arma com ≥ 40% de perfurante ignora 20% da resistência perfurante (`DANO.PEN_PADRAO`, `penDe`);
      a lança segue com 40%.
    - Lobos por nível no campo aberto (`LOBO_NIVEL`): jovem / adulto / veterano pela distância ao acampamento e pela
      noite (veterano: 34 de vida, morde ×1,3, couro grosso). Alfa e arenas não mudam.
    - Ainda não: matilha cercando (um prende, outro ataca pelas costas); animação própria de execução (Mixamo).
  - `armas.spec` t15 (combo) falha também na v7.6: spec antigo não validado.
  - `transicao-campo.spec` "campo pelo zoom" falha às vezes na saída pela roda (tempo: a roda zera em 1,2 s); passa
    ao repetir.
- [x] **Saída da intro em jogo** (2026-10-24, `intro/caminhada.ts`, `ISC_CAMINHO` em `data/intro.ts`): ao sair da
      cena inicial a tela escurece e ela já está no campo aberto ~20 casas ao sul do acampamento, num caminho sem água
      (`campoDireto` em `map/transicao.ts`; a tela só clareia com o cenário montado, `cenaPronta`). O objetivo no alto
      conta os passos até a base. Pelo caminho: 2 coelhos e 1 cervo que nascem no mapa, 4 flechas (vão para a aljava;
      item de chão novo `flecha`) e 2 carnes assadas no chão. Perto da base o campo sobe para o mapa, ela anda até o
      acampamento (`mapGoCamp`) e a câmera mergulha nele. Sair antes pela roda também vale (o tutorial do mapa segue).
      Teste `mundo.spec.ts`. **Aguardando OK.**
- [x] **Acampamento no campo aberto + o lobo do caminho** (2026-10-30, mantenedor: "a transição do vá para o
      acampamento ainda é ruim… inimigos, um lobo… ver o acampamento chegando"; opção A): `field/acampamento_campo.ts`,
      `ACAMP_CAMPO` em `data/campo.ts`, CSS `58_v8.1_acampamento_campo.css`. No lugar do acampamento o campo aberto tem
      uma clareira com os objetos da cena do acampamento (`mbPropsAcampamento`), a fogueira acesa, uma coluna de
      fumaça e o Caçador; um marcador na borda da tela aponta a base fora do quadro. Chegando à fogueira (vindo de
      fora), a tela escurece e abre a cena do acampamento direto (`acampamentoDireto` em `map/transicao.ts`), sem subir
      ao mapa. Caminhada da intro (`ISC_CAMINHO.lobo`): aos 28% do caminho um uivo e um lobo passa a segui-la de lado
      (`Monster.espreita`); aos 58% ele ataca; desiste com a vida dela abaixo de 30% ou perto do fogo. Teste
      `mundo.spec.ts`. **Aguardando OK.**
- [x] **Pedras no acampamento** (2026-10-30): árvores e pedras do mapa não nascem perto do acampamento e da vila
      (`AREA_RESERVADA`; os saves antigos são limpos ao carregar); o clique direito no acampamento é "voltar", mesmo com
      um recurso em cima. **Aguardando OK.**
- Testes antigos com falha que não vêm destas mudanças: `intro.spec` tnew (sem a faca no nascimento) e tintro9 (o
  javali não aparece a tempo).

Detalhe de cada parte: campanha em [docs/campanha.md](docs/campanha.md) (C0–C9), HUD/combate/inventário/mapa em
[docs/documento-mestre.md](docs/documento-mestre.md), pequenos ajustes em [docs/ajustes.md](docs/ajustes.md).
Estimativas em sessões de trabalho (chute pelo ritmo de outubro).

---

## Etapa 1 — Rápidas (até 1 sessão cada)
- [x] Decisões da campanha: vila, runas naturais, recompensa do chefe, Agulha, vários heróis (2026-10-23).
- [x] Novo ROADMAP.md (2026-10-23).
- [ ] Backup novo (ou `git init`) antes do conteúdo novo.
- [ ] Atualizar `campanha.md` com o trabalho de 2026-10-20 (menu do lobo, afagar, coleira, lobo solto no acampamento).
- [ ] Botão de dormir no celular (C1).
- [x] Ponte Ato 3 → Ato 4 (2026-10-24, mantenedor: "logo depois do Ato 3, ou quando juntar 100 em gold no baú"):
      `a3_cria` termina ao dormir com ela (evento `noiteCria`, só da missão atual); `a4_vila` (o Caçador chama, fala
      `cacador_vila`, marca `boteFurado`: `boteViagem` recusa até `boteConsertado`, Ato 6) → `a4_vender` (vender no
      Empório, `vendeuVila`, só da missão atual) → `a4_vila_livre` (fim do pronto). Antes do Ato 4, baú com 100+ de
      valor só avisa (`avisoBau`). Missão nova ganhou `marca` (liga uma flag no fim do chamado). Teste `ato4.spec.ts`.
      **Aguardando OK.**
- [ ] C6: missão "prepare-se" com o gatilho "falar com o Imortal".
- [ ] C9: falas finais + tela de fim de capítulo simples.
- [ ] Caçador corcunda (`ajustes.md`): achar a causa (modelo, rig ou retarget).
- [ ] Mantenedor joga e aprova o que está "aguardando OK" (C0–C2, HUD do campo, mochila, janelas de recipientes, botões).
- [x] C3 passo 1: feito junto com a ponte (o baú agora é infinito: o gatilho virou o fim do Ato 3; o aviso dos 100).
- [ ] Abrir mochila/aljava guardada pelo baú e pelo preparo (Doc. Mestre, bloco 4).

## Etapa 2 — A vila em janela (C4, ~3–4 sessões)
- [x] Janela com abas (2026-10-24, `map/vila.ts`, `data/vila.ts`, CSS `52_v8.0_vila.css`): Empório (o de antes),
      Taverna, Quadro, Doca, Igreja; as conversas (FALAS: taverneiro, barqueiro, Imortal) aparecem dentro da janela.
      Campanha: `a5_taverna` (boato) → `a6_doca` (8 galhos + 20 de ouro) → `a6_espera` (2 dias; enquanto isso a
      igreja) → `a7_cavaleiros` (fim do pronto). Teste `vila.spec.ts`. **Aguardando OK.**
- [x] Taverna: dormir pagando (6 de ouro, até as 6h, vida cheia), a conversa do boato.
- [x] Quadro de missões repetíveis: três pedidos por dia (pele, carne, galho, pena, erva, pedra) por ouro.
- [x] Doca: o bote furado (Ato 4) conserta com 8 galhos e 20 de ouro em 2 dias; pronto, a doca atravessa.
- [ ] Depois do ciclo: doca/conserto do bote/pesca; cena 3D andável da vila.

## Etapa 3 — Igreja e a pista (C5 enxuto, ~2 sessões)
- [x] O Imortal e os cavaleiros como falas na aba Igreja; o texto muda com a afinidade (`IMORTAL_AFINIDADE`).
- [ ] Uma pista roteirizada até o vale (as três pistas completas ficam para depois).

## Etapa 4 — O chefe (C7 enxuto, ~4–6 sessões)
- [ ] Travar a agulha e as runas naturais até a vitória (hoje vêm desde o início; decisões 2 e 4).
- [ ] Runa usável em combate (uma tecla), bônus quando o elemento = afinidade (`raio` × `energia`).
- [ ] Lebre Rúnica em 2 fases; a runa encerra a fase 1; ponto fraco (cauda, laço, atordoar).
- [ ] O Imortal explica a mecânica da agulha (a campanha é um tutorial de criar artefatos).
- [ ] Recompensa: ouro + item raro + a ferramenta Agulha (libera absorção e forja de runas); a gema fica com o Imortal.
- [ ] Depois do ciclo: aliados lutando junto.

## Etapa 5 — Fim (C9, ~1 sessão)
- [ ] Ligar as falas finais e a tela de fim de capítulo da etapa 1 à vitória sobre o chefe.

---

## Depois do ciclo
- C2 5c e 6: o filhote na expedição e o pet no vínculo 4.
- C3 parte 2: encontro na estrada (mini masmorra sem chefe).
- C8: cargas da runa, mana, criação de artefato.
- Doc. Mestre: blocos 5 e 7, níveis de detalhe do mapa, painel de preparo combinado, performance.
- Ajustes abertos de `docs/ajustes.md`.

## Técnico (resto da reforma)
- [~] Fase 6: a maioria dos specs portados do `legacy-py` ainda não foi validada (em 2026-10-16 ~30 falhavam, nenhum
  pelos blocos novos). Validar aos poucos, área por área, quando mexer nela.
- [ ] Fase 7: remover `tests/browser/legacy-py/` e `tools/*/*.py` quando o port estiver validado.
- Fases 1–5 e 8 feitas (ver `docs/roadmap-historico.md` e `CLAUDE.md`).
