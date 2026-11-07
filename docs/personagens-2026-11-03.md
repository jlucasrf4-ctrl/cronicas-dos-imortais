# Personagens — atualização de 03/11/2026

Orçamento acordado: até 20 mil triângulos no personagem completo. A auditoria
confere corpo, qualquer cabeça compatível, roupas misturadas, arma, escudo e arco.
A reserva dos três equipamentos é 4.200 triângulos, medida nos modelos do jogo.
Esse teto não é uma garantia de FPS.

## Alterações

- Nove corpos reconstruídos, com alvo de 12 mil triângulos e prioridade no rosto.
- Heroína e Caçador com aproximadamente 15 mil triângulos cada.
- Líder, samurai, cavaleiros e explorador regenerados. Os bandidos cuja fonte
  já tem poucos polígonos continuam leves; não se acrescentaram faces artificiais.
- Cinco deusas com aproximadamente 15,5 mil triângulos, reservando espaço para armas e preservando esqueleto e
  pintura. Fonte anterior preservada em `assets/fontes-personagens/deusas.json`.
- Dezesseis bustos novos como cabeças, cabelo e união do pescoço; texturas
  compartilhadas de 2048 px. Os seis primeiros correspondem aos corpos F01–F06.
- Doze NPCs separados das três folhas, com textura e correção leve do tom
  alaranjado. Guarda de armadura branca preparada.
- Quimera, grifo e hidra de cinco cabeças com 18 mil triângulos, esqueletos próprios
  e movimentos procedurais iniciais. Disponíveis na prévia; sem novos encontros ou IA.
- Quatro roupas adaptadas aos seis corpos, com limites calculados depois de
  reservar espaço para a maior cabeça compatível e os equipamentos.
- Peito estabilizado com transição gradual dos pesos e clavículas livres.
- Texturas iguais compartilhadas no pacote. Normalização dos vetores das malhas
  com raiz quadrada direta, preservando a regra de suavização.

## Conferência

Na Dungeon Teste, clicar em **Ver modelos e animações**, ou usar **MODELOS** no
GameShark. Permite selecionar personagem, cabeça e movimento, pausar, recomeçar,
girar e aproximar. Só o selecionado é animado. Não altera a aparência salva.
As criaturas e o Caçador usam suas próprias animações. Os manequins humanoides
continuam disponíveis para vestir com E.

## Regeneração

Na raiz do projeto, com Node 22 e as dependências instaladas:

```powershell
node tools/inspecionar-folhas.ts
node tools/preparar-bustos.ts
node tools/atualizar-personagens.ts --sem-roupas
node tools/atualizar-narrativos.ts
node tools/gerar-criaturas-novas.ts
node tools/gerar-aparencias.ts --sem-previas
node tools/atualizar-personagens.ts --retomar
node tools/juntar-vestidos.ts
node tools/auditar-personagens.ts
npm.cmd run build
```

O processamento é sequencial em cada ferramenta. As fontes de transferência ficam
preservadas. Não editar manualmente os arquivos gerados de `build/` e `dist/`.

## Verificações e limites

- Auditoria: `build/personagens/auditoria.json` (índices, UVs, pesos, juntas,
  posições finitas nas animações e orçamento).
- Testes específicos: `aparencias.test.ts`, `pesos-tronco.test.ts` e
  `modelos-teste.spec.ts`; a prévia verifica movimento, altura e visual salvo.
- A suíte geral aponta três falhas fora desta alteração: duas comparam o HTML
  atual com o v7.6 (“Seu clã” versus “Seus personagens”, por exemplo); a outra
  aponta quatro exports antigos sem importadores: `tratarDebilitacao`,
  `cacadorPvpAnimado`, `cacadorPvpPreso` e `cacadorArma`. A referência ficou intacta.
- A medição de desempenho cobre deformação e normais na CPU. Não equivale a FPS
  ou a validação em todos os dispositivos.
- Cópia anterior: `backups/personagens-2026-11-03/`.
