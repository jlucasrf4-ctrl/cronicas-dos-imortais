# Lapidação de gemas (planejamento, 2026-10-24)

A gema já tem tipo (7), estágio (1–5: Bruta, Lapidada, Polida, Refinada, Re-lapidada) e arte por estágio
(`data/arte.ts`, ícones `gx_`), mas nada muda o estágio: ele é sorteado quando a gema nasce. A dica da gema
(`ui/inventario.ts`) e a proficiência Lapidário (`data/atributos.ts`) já prometem a lapidação. Este documento fecha
como ela funciona.

## Decisões

- **A heroína lapida sozinha, em todos os estágios**, com Lapidário alto. O **especialista da cidade** (Pedra Branca:
  "ourives e lapidários") é o caminho seguro para quem não treinou.
- **Quem manda:** proficiência **Lapidário** (0–10) + **Destreza**. Lapidar dá XP de Lapidário (que também ajuda o
  traçado de runa, e vice-versa).
- **Risco, não trava:** qualquer um tenta qualquer estágio; abaixo do nível sugerido a faixa do minijogo fica estreita e
  a chance de rachar sobe muito.

| Estágio | Onde | Material | Lapidário sugerido | Minijogo |
|---|---|---|---|---|
| Bruta → Lapidada | acampamento | laje de desbaste + abrasivo | 0 | desbaste (vai-e-vem, pressão na faixa) |
| Lapidada → Polida | acampamento | couro (pele) + pó de osso (presa moída) | 2 | polimento (círculos, ritmo, calor) |
| Polida → Refinada | bancada com rebolo | pasta de abrasivo + bastão (galho + resina) | 5 | facetas (ângulo na faixa), 8 facetas |
| Refinada → Re-lapidada | bancada com rebolo | idem, abrasivo melhor | 8 | facetas, 16 facetas, faixas mais estreitas |

- **Abrasivo pela dureza (Mohs):** quartzo moído → ônix, ametista, esmeralda; **esmeril** → topázio, rubi, safira;
  **pó de diamante** → diamante. Abrasivo errado (mais mole) = trabalho lento.
- **Habilidade alta encurta ou pula o minijogo** (como Sobrevivência 10 acende a fogueira direto). Margem = Lapidário −
  sugerido:
  - negativa: minijogo completo, faixa estreita, alto risco;
  - 0 a 2: completo, faixa normal, risco baixo;
  - 3 a 4: encurtado (metade das esfregadas/facetas já vem feita);
  - 5 ou mais: botão **"Lapidar direto"** (sucesso garantido). Libera no Nv 5 (Lapidada), 7 (Polida), 10 (Refinada).
  - A **Re-lapidada sempre tem minijogo** (no máximo encurtado no Nv 10): a assinatura do mestre.
  - O atalho ainda gasta tempo e material, e rende menos XP que jogar.
- **Itens novos:** **esmeril** (achado raro na mineração, ou moendo rubi/safira bruta), **pó de diamante** (de diamante
  que racha), **resina** (ao cortar pinheiro). Os pós e o esmeril também se **compram na cidade**. O resto já existe:
  pedra, quartzo, pele, presa, galho, tábua, ferro.
- **Bancada com rebolo:** construída na carpintaria (tábuas + ferro + pedra); modelo do rebolo = peça F2 de
  `assets minigame forja.glb`.
- **Quando racha:**
  - **Lascou** (falha comum): a gema volta um estágio, ganha a marca **Lascada** (vale menos) e solta um pouco do pó da
    sua dureza.
  - **Partiu** (falha grave, só com margem negativa): a gema se perde e vira pó.
  - **Recuperar a Lascada:** com o especialista ou Lapidário 8+; tira a marca, mas a gema fica um pouco menor (vale
    um pouco menos que uma que nunca lascou).

## Para que serve a gema 5/5: o artefato

- O **artefato** é a gema com uma runa engastada num item, que vira peça **única (SS)** (`docs/equipamento.md`). A
  criação do artefato é o Ato 11 da campanha (C8 em `docs/campanha.md`: a Agulha, cargas da runa, mana, minijogo de
  criar artefato). A gema Re-lapidada (5/5) é a base dele.
- O **pó de diamante** (e o esmeril) também se compra na cidade: assim dá para chegar ao 5/5 sem depender de quebrar
  um diamante.
- Situação em 2026-10-25: nem a lapidação nem a criação do artefato estão no jogo ainda.

## Em aberto

- [ ] Especialista da cidade: a gema fica com ele um tempo (proposta: ~40% do valor ganho, 1 dia de jogo por estágio,
  Re-lapidada 2 dias, sem risco, abrasivo dele) ou o serviço é na hora?
- [ ] O estágio da gema muda algo como substrato de runa?

## Passos (quando aprovado)

- [ ] Desbaste (Bruta → Lapidada) no acampamento: laje, quartzo moído, minijogo, risco, XP, atalho.
- [ ] Polimento.
- [ ] Itens novos (esmeril, pó de diamante, resina) e venda na cidade.
- [ ] Bancada com rebolo + facetas (Refinada, Re-lapidada).
- [ ] Lascada, partida e recuperação.
- [ ] Especialista da cidade.
