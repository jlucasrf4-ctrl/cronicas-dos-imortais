# Stamina progressiva

Pedido de 2026-11-05. Balanceamento em `src/data/combate.ts`: `FOL_HEROI`, `GINGA`, `ARCO_FOL` e `EXAUSTAO`.

## Pontos existentes e decisões

- Jogador: externa fixa em 100 (`gstam`), interna em 100 (`gint`). A externa mantém sua taxa de 62,5/s, os
  multiplicadores existentes e as pausas de cada ação. A interna só recupera com externa cheia, mantendo suas
  faixas/taxa anteriores. Corrida mantém seu ciclo anterior de reserva e reposição externa; muda sua velocidade.
- Ginga: preserva o mínimo de 20 externos e a recarga de 0,55 s. Sem externa suficiente, não inicia. Não exige
  nem gasta interna diretamente. A pausa de regeneração de 0,4 s e o mínimo existente impedem ciclos de migalhas.
- Arco: puxada gasta externa continuamente na taxa de 10/0,4 por segundo; tensionado usa os pulsos anteriores.
  Ao zerar cobra uma quebra. No próximo pulso sem externa, baixa sem disparar, preservando a reação anterior
  de perda de mira quando faltava o recurso consumido. A alternativa de manter a tensão vazia ficou aberta ao mantenedor.
- Madeira: mantém custo inicial e por segundo. Não solta/cancela ao zerar. Mesmo ambas as barras vazias não
  impedem continuar. A pausa de 0,8 s evita recuperação durante a carga. Picareta e machado em combate mantêm
  seu comportamento anterior. Golpes de madeira resolvem o contato na descida de 0,46 s, aos 0,18 s configuráveis;
  o recurso travado é revalidado pelo alcance. Cobra 3 externos somente se houver árvore atingida; dano e coleta
  seguem `golpearRecursoCampo`, sem alteração de quantidade. Conversão de tronco em galho não é impacto de árvore.
- Inimigos: reserva não regenera, como antes. O desgaste passa das quedas para as quebras externas. Recuperação
  externa mantém espera de 2,5 s e taxa de 0,5/s. Foi necessário separar o teto externo da reserva de combate:
  manter o vínculo antigo impediria qualquer recuperação na quarta quebra. O laço mantém seu teto próprio.
- Queda mantém 8 s (4 s para chefes), recuperação no chão e levantamento existentes, com 3 s de proteção
  contra nova queda após levantar. Quebras durante a proteção ainda gastam reserva, sem derrubar novamente.
  A fuga final dura 3 s com bônus de velocidade, usa colisão existente e termina em `folKO`, mesmo se bloqueada.
  Após exaustão total, o levantamento não reinicia a fúria antiga. Dano base e resistências não foram alterados.
- Defesa: reduz a eficácia dos bloqueios e a frequência das reações dos bandidos onde elas já existem.
  Animais não receberam uma mecânica artificial de escudo/defesa.
- Não há clip específico de ferido nos conjuntos atuais. Permanece a caminhada existente extremamente lenta;
  a animação específica está pendente, sem gerar um sistema de animação paralelo.

## Verificação

`tests/unit/folego.test.ts` cobre transições compartilhadas, limites, curva contínua, probabilidades das quatro
quebras, colapso após fuga, proteção ao levantar e recuperação. `tests/browser/e2e/stamina_progressiva.spec.ts`
exercita as ações reais, contato único do machado, golpe fora de alcance, fuga/colapso/levantamento e corrida exausta.
O instante visual de contato e os valores novos são configuráveis para ajuste de sensação de jogo.

Lint, build e cinco testes de navegador aprovados. A primeira checagem de tipos passou; na rodada final surgiu
um erro em `tools/auditar-personagens.ts:96` (campo `rotulo` ausente), arquivo alterado durante a sessão fora deste
trabalho. A suíte unitária completa teve 222 testes aprovados e
três falhas fora das alterações: auditoria de exports em `field/combate.ts` e `render/gl/cacador_anim.ts`, e duas
comparações de HTML com a referência congelada em `montagem.test.ts`. Os 25 testes focados em stamina/dano passaram.
