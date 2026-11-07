# Modelos e rostos — 05/11/2026

O projeto em `H:\Projeto Cronicas\Cronicas_dos_Imortais_fonte_v8.0\Cronicas_dos_Imortais_fonte_v7.6` recebeu seis montagens femininas com busto integral e quatro conjuntos de roupa para cada uma. Cabeça, pescoço, clavículas e peito permanecem juntos; cintura e braços usam transições fechadas no mesmo esqueleto.

O limite passou a 25 mil triângulos por personagem completo. A redução agora reserva geometria para o rosto antes de reduzir cabelo e demais regiões. As cabeças trocáveis foram regeneradas a partir das fontes, sem apenas subdividir a malha antiga.

| Conjunto | Corpo e cabeça | Máximo com roupas e equipamentos |
|---|---:|---:|
| F01 | 16.004 | 24.104 |
| F02 | 15.606 | 23.706 |
| F03 | 15.662 | 23.761 |
| F04 | 17.475 | 24.999 |
| F05 | 16.280 | 24.380 |
| F06 | 16.132 | 24.231 |

Os máximos incluem a peça mais cara de cada categoria entre os quatro estilos, arma, arco e escudo. Personagens sem todos esses itens têm menos triângulos.

## Arquivos 3D

- `Robusta_pecas_25k.glb`: cinco peças separadas, com esqueleto e pesos: abdômen/quadril, braço/mão esquerdo, braço/mão direito, perna/pé esquerdo e perna/pé direito.
- `Robusta_montada_25k.glb`: as mesmas peças e o busto de referência, para conferir o encaixe. O busto não foi criado novamente.
- `Robusta_previa_3D.html`: visor interativo que funciona sem internet. Permite girar, aproximar e mostrar ou ocultar cada peça.

A Robusta exportada possui barriga, quadris, coxas e braços ampliados sobre a base F06. Essa variante GLB é independente das seis aparências existentes do jogo. As interfaces do busto foram preservadas. Os GLB contêm esqueleto e pesos, mas não incorporam os clipes de animação do jogo. As animações continuam nos dados do projeto.

## Conferência

A auditoria usa as montagens e roupas selecionadas pelo jogo, incluindo os bustos integrais. Verifica índices, pesos, texturas, posições durante os movimentos e limite de triângulos. Os testes de emendas conferem contornos fechados, preservação do cabelo e transições maiores entre busto e cintura.

Resultado desta revisão: 361 malhas e 168 combinações auditadas sem problemas; 24 testes passaram. Verificação de tipos, análise dos arquivos alterados e geração do jogo passaram. As seis aparências foram capturadas no visor do jogo sem erros de execução. A prévia independente carregou os GLB sem erros. O GLB montado tem 16.970 triângulos; as cinco peças faltantes têm 6.729, além do esqueleto.

Conferência visual concluída em 06/11: os 24 conjuntos foram comparados em repouso, caminhada e golpe de espada, com duas câmeras — 144 vistas. As folhas `F01_roupas_e_movimentos.png` até `F06_roupas_e_movimentos.png` mostram os quatro estilos nas colunas (aventureira, deserto, patrulheira e placa) e as três poses nas linhas, cada uma com duas vistas.

`Cronicas_modelos_25k.html` é a versão gerada do jogo. Para revisar as aparências, abra a prévia de modelos na sala de treino ou use o código MODELOS.

As cópias anteriores dos arquivos alterados estão em `backups/modelos-modulares-2026-11-05/` dentro do projeto. O acabamento visual das combinações adicionais de cabeças, roupas misturadas e movimentos extremos deve continuar sendo acompanhado no visor do jogo; testes geométricos não comprovam ausência de todo defeito visual.

## Revisão dos bustos F — 06/11/2026

As combinações do corpo F2 com F1, F3, F4 e F16 agora usam o busto integral da fonte, conservando pescoço e ombros. São quatro montagens adicionais e 16 trajes ajustados; o projeto totaliza dez montagens integrais e quarenta trajes próprios. Esta revisão responde às combinações mostradas nas capturas do mantenedor.

F13 recebeu redução de escala de 14%; F14 e F15, de 4%. O ajuste mantém a ancoragem no queixo e conserva os vértices, faces, UVs e pesos. As cabeças femininas aparecem no menu como F1 a F28: os dezesseis bustos novos primeiro e as doze cabeças anteriores em seguida. Identificadores internos permanecem iguais, preservando os visuais salvos. Os tipos de corpo usam F1 a F6, sem zero inicial.

Na F16, a base do tórax foi centralizada gradualmente, sem estreitar o peito nem deslocar o pescoço. As mechas completas da cabeça trocável substituem o cabelo recortado do busto; conservam a textura, recebem pesos Head e passam a integrar a mesma montagem. A geração das cabeças também separa o cabelo antes de recortar as peças afetadas. A F16 continua com cabelo rígido no rig existente; contato com armaduras volumosas pode aparecer em algumas poses.

| Corpo F2 com cabeça | Pele completa | Máximo com trajes e equipamentos |
|---|---:|---:|
| F1 | 15.692 | 23.792 |
| F3 | 17.212 | 24.999 |
| F4 | 16.959 | 24.997 |
| F16 | 15.070 | 23.170 |

Conferência desta revisão: 26 testes em oito arquivos aprovados; auditoria das 168 combinações dos seis corpos femininos sem problemas de integridade, com máximo de 24.999 triângulos. Os 16 novos conjuntos foram capturados em repouso, caminhada e golpe de espada, em frente e perfil: 96 vistas. Comparações de cabeça e perfil também incluem F13, F14 e F15. Essa conferência cobre as combinações descritas; os demais pares e movimentos extremos seguem o escopo anterior de acompanhamento.

Arquivo do jogo desta revisão: `Cronicas_correcao_bustos_F.html`. Cópias anteriores dos arquivos alterados em `backups/ajustes-f-2026-11-06/`.
