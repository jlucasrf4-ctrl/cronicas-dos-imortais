# Comida que importa e ações rápidas (Q / Tab)

Estudo de 2026-10-13, pedido pelo mantenedor. Nada implementado. Mesmo jeito de trabalhar do [ROADMAP.md](../ROADMAP.md).

## Comida hoje
- Só 3 comidas (`FOOD` em `data/sobrevivencia.ts`): carne assada (fome −45, ferimento −12, vida +10), carne crua (−18, 25% de enjoo), peixe cru (−15, 25% de enjoo). Qualidade: +15% por degrau.
- Fome (`survTick` em `survival/sobrevivencia.ts`): sobe 4% por minuto no campo (×1,4 com frio). Acima de 60%: −15% de dano e −20% de fôlego. Acima de 85%: perde vida devagar. No acampamento sobe 1% por minuto.
- **Por que não se sente:** uma expedição curta raramente leva a fome de 0 a 60%. Comer não dá nada além de tirar fome e curar um pouco. Estar bem alimentado não tem vantagem nenhuma.

## Proposta: comida
1. **Bem alimentado vale a pena.** Fome abaixo de 30% dá bônus: o fôlego volta mais rápido e a vida regenera devagar. Hoje só existe castigo.
2. **Refeição com efeito** (estilo Monster Hunter/Red Dead): cada prato dá um efeito por um tempo, só uma refeição ativa por vez.
   - Carne assada: vida regenera.
   - Ensopado (carne + erva, panela na fogueira): fecha ferimentos e protege do frio.
   - Peixe assado: fôlego máximo maior.
   - Carne de javali: mais dano corpo a corpo.
   - A qualidade (C…S) aumenta a força e a duração do efeito.
3. **Fome cobra mais cedo e de leve.** A partir de 50%, o fôlego máximo diminui aos poucos (o jogador vê a barra encolher), em vez de um corte seco em 60%.
4. **Carne crua estraga** na mochila (alguns dias de jogo). Isso empurra a cozinhar, salgar ou defumar, e a vender rápido.
5. **Comer leva tempo** (~1,2 s parado, sem atacar): no meio da luta é uma escolha arriscada.
6. **Ligação com a campanha:** o jantar com o Caçador dá "bem alimentado" no dia seguinte; a barra de fome da vila (Ato 6) vira tutorial de verdade.

## Q e Tab hoje
- **Q** = trocar de arma (`switchWeapon` em `field/masmorra.ts`: arma 1 → arco → arma 2 → arco 2).
- **Tab** = trocar o alvo travado (`cycleTarget`).
- **H** = usar erva. Comer só pela mochila (menu do item).
- Teclas já usadas no campo: W A S D, Shift, Espaço, E, C, I, K, H, F, G, X, R (só com a mochila aberta), T.
- Não existem: arremessar pedra, poção, usar runa.

## Proposta: Q = ação rápida, Tab = trocar arma
- **Tab troca de arma** (a mesma ordem de hoje). O "trocar alvo" do Tab vai para outra tecla ou sai (ver Em aberto 1).
- **Q usa o item colocado no espaço rápido.** No boneco da mochila nasce um espaço "Q". Arrasta-se um item para lá, ou "Pôr no Q" no menu do item. O HUD mostra o ícone e quantos restam ao lado da arma.
  - O que pode ir para o Q: erva, comida, poção, pedra (arremesso que atordoa bicho pequeno e espanta pássaro), runa (Ato 10 da campanha), corda (laçar).
  - Usar leva o tempo do item (erva rápida, comer ~1,2 s, runa com preparo).
  - Acabou o item: o Q fica vazio e cinza; o próximo igual na mochila entra sozinho.
- **Depois (opcional):** segurar Q abre uma roda com 4 espaços (estilo Red Dead), e solta escolhe.
- **Celular:** o botão de trocar arma passa a ser do Tab; nasce um botão Q.

## Em aberto
1. O "trocar alvo travado" (hoje no Tab): passa para o botão do meio do mouse, para outra tecla, ou sai do jogo?
2. O **H** (erva) continua como atalho fixo, ou a erva passa a ser só um item que se põe no Q?
3. Um espaço Q só, ou já a roda de 4?
4. Arremessar pedra: só atordoa bicho pequeno e espanta pássaro, ou também faz um pouco de dano?
5. Comida estragar: quer isso, ou fica de fora por enquanto?
