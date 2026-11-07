# CRÔNICAS DOS IMORTAIS — Documento Mestre de Implementação

Recebido do mantenedor em 2026-10-16 (texto original, sem edição). Andamento em [documento-mestre.md](documento-mestre.md).

---

HUD, Combate, Inventário, Expedição, Mapa e Polimento

Destinatário: Claude
Objetivo: consolidar e implementar as decisões aprovadas para a próxima etapa de desenvolvimento do jogo.

---

## 1. Regras gerais de implementação

Antes de modificar o projeto:

1. Inspecione a estrutura atual, os arquivos, os sistemas existentes, os assets, os eventos e o fluxo de navegação.
2. Identifique quais funcionalidades já existem, quais estão parcialmente implementadas e quais apresentam bugs.
3. Preserve os modelos, as animações, os dados do mundo, as criaturas, os itens e as mecânicas que já funcionam.
4. Não substitua sistemas inteiros quando uma correção localizada for suficiente, exceto nos sistemas de navegação e câmera do mapa, cuja reconstrução foi explicitamente aprovada.
5. Evite criar implementações paralelas que concorram com sistemas existentes.
6. Mantenha as regras de jogo independentes da apresentação visual, sempre que a arquitetura permitir.
7. Preserve o estado dos inventários e a progressão durante transições, morte e retorno ao acampamento.
8. Não invente valores de atributos, capacidades, tempos ou probabilidades que não tenham sido definidos. Inspecione as regras atuais e identifique os parâmetros ainda pendentes.

Ordem de trabalho: corrigir os problemas funcionais críticos, implementar os comportamentos aprovados, integrar os sistemas e, por último, finalizar a apresentação visual.

## 2. Bloco 1 — Combate, foco, alvos e movimentação

### 2.1. Controles de combate

- Clique esquerdo: ataque básico.
- Clique direito: ataque especial.
- Alt + clique esquerdo: selecionar o foco.
- Esc ou Alt + clique no chão: cancelar o foco, preservando o alvo prioritário de combate.
- Verificar se Alt já possui outra função no projeto. Se houver conflito, escolher uma alternativa compatível e documentá-la.

Selecionar o foco nunca pode executar um ataque.

Corrigir o tratamento dos eventos de entrada para que selecionar, atacar, mover-se e interagir sejam operações independentes. Um clique não pode criar, reposicionar ou duplicar um animal por engano.

### 2.2. Alvo prioritário e foco independente

Manter dois conceitos separados:

- Alvo prioritário: criatura selecionada para o combate, identificada em laranja.
- Foco: criatura selecionada para precisão direcional, identificada em branco translúcido.

O alvo prioritário exibe as informações essenciais de combate e a stamina da criatura. O foco não substitui automaticamente o alvo prioritário.

O foco permite direcionamento preciso dentro do alcance válido da arma e sem obstáculos. Não criar homing em projéteis.

Quando foco e alvo prioritário forem a mesma criatura, combinar os indicadores sem prejudicar sua legibilidade.

Qualquer bônus de dano por foco será uma habilidade desbloqueável da árvore de habilidades, não um bônus básico.

### 2.3. Mudança automática de alvo

Implementar, se a arquitetura permitir, a regra de prioridade inteligente:

- Quando o jogador causar dano a outra criatura, essa criatura passa a ser o alvo prioritário.
- Quando outra criatura atacar o jogador, ela só assume a prioridade se o jogador não estiver comprometido com outro alvo.

Se a arquitetura atual não permitir essa regra com segurança, utilizar a alternativa aprovada: o alvo prioritário só muda quando o jogador causar dano a outra criatura.

Não alterar o foco automaticamente ao trocar o alvo prioritário.

### 2.4. Rastreamento de criaturas

Criar ou corrigir o painel compacto de rastreamento no canto superior direito.

- Até quatro criaturas inicialmente; capacidade máxima de cinco conforme a evolução da habilidade.
- A detecção possui um raio próprio.
- A capacidade máxima e o raio de detecção são limitações independentes.
- Detectar automaticamente criaturas próximas e permitir inclusão e remoção manual.
- Ao atingir a capacidade máxima, preservar as criaturas atuais e exigir remoção manual antes de adicionar outra.
- Remover da lista as criaturas que saírem do raio de detecção.
- Criaturas detectadas recebem indicadores laranja e informações básicas.
- Apenas um alvo prioritário e um foco podem estar ativos simultaneamente.

A habilidade Revelação é um pulso temporário de detecção em área. Não ataca, não altera o foco ou o alvo prioritário e não adiciona automaticamente criaturas ao rastreamento permanente.

### 2.5. Stamina e movimentação

- A stamina interna deve poder chegar a zero.
- Ao chegar a zero, bloquear a corrida até a recuperação a 25%.
- O footwork corpo a corpo consome 20% da stamina máxima por esquiva curta, interpretando o custo como 20 pontos percentuais da barra máxima, salvo incompatibilidade demonstrada pela implementação atual.
- Corrigir o deslizamento do personagem ao sair de uma ação agachada para continuar correndo.
- Corrigir o movimento de costas e o moonwalk.
- Verificar se o pacote de animações do arqueiro contém caminhada para trás compatível e utilizá-la se apropriado.
- Sincronizar orientação do personagem, direção de movimento e animação.

### 2.6. Proficiência de armas

Manter progressões separadas para:

- Espada.
- Machado.
- Lança.
- Clava.
- Arco.

Não agrupar todas as armas corpo a corpo em uma única proficiência nem todas as armas de distância em uma única categoria.

## 3. Bloco 2 — HUD e direção visual

### 3.1. Identidade visual

Usar uma identidade consistente baseada em:

- Carvão.
- Cinza quente.
- Bronze.
- Bordas finas e texturas discretas.
- Ornamentação mais elaborada apenas em telas especiais.

Evitar excesso de informações, ornamentos ou textos permanentes.

### 3.2. Comportamento da interface

- HUD fixa e compacta durante exploração e combate.
- Painéis grandes podem ser movidos e redimensionados.
- Escala da interface adaptável à resolução, com ajuste nas configurações.
- Vida, stamina, habilidades frequentes e atalhos úteis permanecem acessíveis.
- Informações secundárias aparecem ao selecionar ou passar o cursor sobre os elementos.
- O painel de rastreamento só aparece quando a habilidade correspondente estiver ativa.
- Botões precisam distinguir visualmente os estados disponível, selecionado, bloqueado e indisponível.

Corrigir especialmente botões funcionais que parecem desativados, como o botão “Fazer nascer” do menu de criação.

### 3.3. Representação visual

- Usar miniaturas 3D quando houver um modelo adequado.
- Usar ícones ilustrados nos demais casos.
- No mapa, usar ícones em zoom distante e miniaturas dos animais no zoom próximo.
- Manter a mesma linguagem visual entre personagem, inventário, equipamentos, habilidades e preparação de expedição.

## 4. Bloco 3 — Inventário e equipamentos

### 4.1. Layout principal

Adotar um inventário em grade espacial, inspirado na organização de itens de Resident Evil 4, mas coerente com a identidade visual do jogo.

A tela deve combinar:

- Personagem e equipamentos principais.
- Espaços de equipamento organizados.
- Grade para equipamentos e acessórios extras.
- Mochilas, bolsas, aljavas e bainhas representadas corretamente.

Cada item deve mostrar sua miniatura, quantidade quando aplicável e informações essenciais. Descrições completas aparecem sob demanda, sem uma faixa inferior permanentemente ocupada por textos excessivos.

Todos os equipamentos equipáveis devem ter molduras padronizadas, incluindo a faca.

### 4.2. Recipientes independentes

Mochilas, bolsas e aljavas possuem dimensões e capacidades próprias.

- Clicar em um recipiente abre sua janela.
- Múltiplas janelas podem permanecer abertas simultaneamente.
- Cada janela identifica claramente o recipiente e seu conteúdo.
- As dimensões dos itens determinam o espaço ocupado.
- Respeitar as orientações permitidas pelos itens e recipientes.
- A estrutura deve permitir novos tipos de recipiente sem exigir uma reconstrução do inventário.

### 4.3. Transferências

Oferecer dois métodos:

1. Arrastar e soltar para movimentação precisa.
2. Clique direito para transferência rápida.

Com várias janelas abertas, o recipiente válido sob o cursor é o destino prioritário. Sem destino apontado, utilizar um destino padrão explícito e previsível.

Se não houver espaço, recusar a transferência e informar o motivo. Não perder nem duplicar o item.

### 4.4. Organização automática

Disponibilizar um botão de organização automática.

- Nunca reorganizar o inventário sem solicitação.
- Preservar a organização manual até o jogador solicitar a operação.
- Se não for possível acomodar todos os itens, cancelar a reorganização sem descartar ou sobrescrever nada.

### 4.5. Itens no chão

A área de itens no chão deve ser prática, sem se transformar em um segundo inventário gigante.

- Arrastar um item para a área do chão deixa o item no mundo, próximo ao personagem.
- Arrastar para outro recipiente tenta transferir para esse recipiente.
- Itens no chão reorganizam sua apresentação automaticamente para evitar sobreposição.
- Transferências inválidas mantêm o item na origem.
- Corrigir a rejeição indevida de itens quando há espaço válido disponível.

## 5. Bloco 4 — Acampamento e preparação de expedição

### 5.1. Baú permanente

O baú do acampamento é um armazenamento persistente entre expedições.

- Deve poder ser aberto diretamente no acampamento.
- Deve estar acessível também no painel de preparação.
- Seu conteúdo permanece após morte, retorno e início de uma nova expedição.
- O conteúdo não deve ser confundido com o inventário do personagem ou a carga do companheiro.

### 5.2. Tenda

A tenda funciona como ponto de preparação e acesso ao baú, deixando de ser apenas um elemento decorativo.

### 5.3. Painel de preparação

Criar um painel combinado que mostre:

- Inventário do personagem.
- Baú do acampamento.
- Companheiro disponível e sua carga.
- Equipamentos preparados.
- Destino selecionado.

Permitir transferências antes da partida e mostrar a situação dos recipientes. Só exibir informações de peso ou capacidade que existam ou tenham sido implementadas de forma consistente no sistema.

### 5.4. Partida

O jogador escolhe o destino e confirma a expedição após conferir o resumo.

Corrigir o fluxo em que selecionar uma expedição leva o jogador de volta ao acampamento em vez de carregar a área desejada.

A confirmação precisa iniciar a expedição correspondente, preservando o estado necessário do personagem, inventários e companheiro.

## 6. Bloco 5 — Tamanduá-bandeira e carga

### 6.1. Janela de carga

O compartimento do tamanduá deve abrir em uma janela independente ao lado da mochila do personagem.

- Distinguir claramente a carga do tamanduá, a mochila do jogador e os itens no chão.
- Permitir transferências entre esses recipientes conforme as regras gerais do inventário.
- Utilizar uma capacidade própria e fixa, com dimensões definidas.
- Não implementar melhorias de capacidade neste sistema.

### 6.2. Comportamento autônomo

Quando receber o comando para passear, o tamanduá deve se afastar, procurar formigueiros e alimentar-se autonomamente.

A tecla T chama o tamanduá de volta.

Ele não deve retornar automaticamente apenas por atingir um limite de distância. Entretanto, o sistema deve impedir que fique preso fora dos limites do mapa ou em estados irrecuperáveis. Qualquer proteção técnica desse tipo não pode contradizer a regra de retorno por comando.

### 6.3. Morte e preservação da carga

A morte realiza um único sorteio de 65% para preservar toda a carga do tamanduá.

- Se o sorteio for favorável, preservar todos os itens do compartimento.
- Caso contrário, aplicar as regras de perda da expedição.
- Não sortear separadamente para cada item.
- Não afetar o conteúdo do baú permanente do acampamento.

## 7. Bloco 6 — Mapa, introdução e exploração

### 7.1. Reconstrução da navegação

Refazer o sistema de navegação e câmera do mapa, preservando os assets e os dados do mundo.

A reconstrução não deve apagar ou recriar desnecessariamente o conteúdo já existente.

Corrigir os problemas de serrilhado excessivo, tremores, travamentos e mudanças bruscas de detalhe.

### 7.2. Zoom e representação

- Zoom distante: ícones legíveis.
- Zoom próximo: miniaturas dos animais, quando houver assets adequados.
- Transição progressiva entre níveis de detalhe.
- A troca de representação não pode duplicar, apagar ou deslocar entidades no mundo.
- A posição lógica da criatura deve ser independente da representação visual utilizada.

### 7.3. Câmera

Implementar movimento e zoom suaves, com transições consistentes entre níveis de detalhe.

Evitar saltos de posição, tremores, desaparecimentos temporários e renderização duplicada durante a transição.

### 7.4. Introdução

Permitir pular a introdução sempre que o jogador desejar.

Pular a cena não significa derrotar o chefe coelho. A progressão da campanha deve depender do evento real de derrota, não da exibição ou do salto da sequência cinematográfica.

Corrigir a animação ociosa do caçador.

### 7.5. Runas naturais

As runas naturais só começam a aparecer depois da derrota real do chefe coelho da introdução.

Disponibilizar uma opção para desativar o aparecimento de todas as runas naturais.

A opção de desativação visual ou de aparecimento não deve corromper o estado da campanha nem conceder automaticamente progressão.

## 8. Bloco 7 — Morte, saque e polimento

### 8.1. Tela de morte

Ao morrer, o personagem não deve retornar imediatamente ao mapa.

Exibir uma tela de derrota e aguardar a confirmação do jogador. Antes da confirmação, apresentar um resumo das consequências, incluindo:

- Quantidade de vida no retorno.
- Itens do personagem perdidos.
- Itens preservados.
- Resultado da proteção da carga do tamanduá, quando aplicável.

### 8.2. Vida ao retornar

O personagem retorna com vida parcial, e a quantidade deve ser claramente informada.

A porcentagem ou quantidade exata ainda precisa ser definida com base na regra atual do projeto ou em um parâmetro explícito de configuração. Não inventar um valor sem justificativa.

Garantir que o jogador consiga entender seu estado antes de iniciar uma nova expedição.

### 8.3. Perda de itens

Os itens do personagem sujeitos à perda são perdidos definitivamente.

Aplicar a distinção entre:

- Inventário do personagem: itens sujeitos à perda definitiva.
- Carga do tamanduá: 65% de chance de preservar todo o conteúdo.
- Baú do acampamento: armazenamento persistente, não afetado pela morte.
- Itens no chão: objetos do mundo sujeitos ao temporizador ou às regras específicas de saque.

Não criar duplicações, desaparecimentos indevidos ou transferência acidental entre esses armazenamentos.

### 8.4. Temporizador de saque

Corrigir a cintilação excessiva da carne e de outros itens antes do desaparecimento.

- Manter o temporizador previsto no sistema.
- O tempo restante deve ser consistente.
- A cintilação visual, se existir, não pode começar de maneira excessivamente frequente nem indicar estados contraditórios.
- Ao expirar, o item deve desaparecer de maneira controlada.

### 8.5. Polimento geral

Corrigir os bugs de interação, navegação, inventário, animação e transição que comprometam as decisões acima.

Priorizar falhas que impedem o jogador de atacar, selecionar alvos, movimentar-se, transferir itens, preparar expedições ou chegar ao destino escolhido.

Não alterar regras de jogo aprovadas apenas para simplificar a implementação.

## 9. Critérios de validação

Antes de considerar a implementação concluída, testar os seguintes cenários.

Combate e movimento

- Selecionar foco não executa ataque.
- Cancelar foco preserva o alvo prioritário.
- Alvo prioritário e foco podem ser diferentes.
- Cliques não criam nem reposicionam criaturas acidentalmente.
- A stamina chega a zero e bloqueia a corrida até recuperar 25%.
- Proficiências são independentes por tipo de arma.
- Não há moonwalk nem deslizamento após ações agachadas.

HUD e inventário

- HUD permanece compacta e legível em exploração e combate.
- Painéis grandes podem ser movidos e redimensionados.
- Escala da interface responde à resolução e às configurações.
- Recipientes podem ficar abertos simultaneamente.
- Transferências válidas funcionam; transferências inválidas explicam o motivo.
- Organização automática nunca descarta nem sobrescreve itens.
- Soltar um item na área do chão o coloca no mundo corretamente.

Acampamento e companheiro

- Baú permanece intacto após morte e nova expedição.
- Painel mostra personagem, baú, companheiro e destino.
- A confirmação carrega o destino escolhido.
- Tamanduá passeia autonomamente e retorna ao receber T.
- A preservação da carga utiliza um único sorteio por morte.

Mapa e progressão

- Navegação e câmera são suaves.
- Zoom distante e próximo exibem as representações corretas.
- Trocar o nível de detalhe não duplica nem desloca entidades.
- Pular a introdução não derrota o chefe automaticamente.
- Runas naturais continuam bloqueadas antes da derrota real do chefe coelho.
- A opção de desativar runas funciona sem corromper a progressão.

Morte e saque

- A tela de morte aguarda confirmação.
- O resumo das consequências é coerente com os itens realmente preservados e perdidos.
- A vida parcial do retorno é explícita.
- A carga do tamanduá respeita a chance de 65%.
- O baú permanente não é afetado.
- O saque não apresenta cintilação excessiva nem desaparece antes do tempo configurado.

## 10. Entrega esperada

Ao concluir, apresentar:

1. Relação dos arquivos alterados.
2. Resumo objetivo das mudanças por bloco.
3. Lista dos bugs corrigidos.
4. Resultado dos testes de validação.
5. Pendências que dependem de parâmetros ainda não definidos ou de limitações técnicas reais.

Não afirmar que um teste foi realizado se ele não tiver sido executado.

Prioridade máxima: preservar os sistemas e assets existentes, implementar as regras aprovadas com consistência e evitar regressões. O resultado deve ser uma experiência coesa, previsível e visualmente consistente em Crônicas dos Imortais.
