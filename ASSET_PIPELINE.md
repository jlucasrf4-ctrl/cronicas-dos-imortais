# Pipeline de assets 3D — Crônicas dos Imortais

Este documento descreve o pipeline que existe no projeto v8.1, conferido em `src/`, `tools/` e nos planos/dados de assets. Ele não define uma escala em metros: o jogo posiciona modelos em **unidades internas do campo**.

## Resumo das especificações

| Propriedade | Padrão observado |
|---|---|
| Entrada direta na biblioteca do editor | `.glb` binário, sem compressão Draco ou meshopt, com dados e texturas embutidos |
| Cena/coordenadas do jogo | X e Z no chão; Y para cima; rotação horizontal em torno de Y |
| Pivot produzido pelo importador | Centro da caixa em X/Z, base no plano Y=0 |
| Dimensão importada | Maior dimensão = 60 unidades do jogo (`TAM_IMPORTADO`) |
| Grade do editor | 21 unidades do jogo; o tile do campo é 42 (`EDITOR.grade`, `dungeon.tile`) |
| Alvo de redução do importador | 4.000 triângulos; é um alvo, não uma garantia absoluta |
| Textura preservada | Uma textura base color compartilhada pelos triângulos, até 512×512 WebP, qualidade 82 |
| Sem uma única textura preservável | Cor convertida para cor por vértice; múltiplas imagens são amostradas/bakeadas na cor |
| Miniatura | Gerada no navegador pelo software renderer do editor; não é preciso fornecer imagem |

## 1. Formatos aceitos e limites

O fluxo automático do editor está em [`tools/lib/importar.ts`](tools/lib/importar.ts), acionado pelo plugin em [`tools/vite-plugin-jogo.ts`](tools/vite-plugin-jogo.ts). Ele procura apenas arquivos com extensão `.glb` em `modelos-novos/` e verifica o cabeçalho binário GLB. Arquivos `.gltf` avulsos, `.obj`, `.fbx` e arquivos de materiais/texturas separados **não são entradas desse fluxo**. O projeto possui leitores e ferramentas separados para FBX/GLB usados na geração de personagens e nos planos; eles não tornam esses formatos importáveis pela biblioteca do editor.

Para o importador do editor, use um GLB autocontido, com buffer binário e imagens embutidas (bufferView ou URI `data:`). Ele rejeita GLBs que declaram extensões de compressão Draco ou meshopt e rejeita referências de imagem externas. Primitivas triangulares são lidas (`mode` 4; omitido é tratado como triângulos), incluindo nós/cenas e suas transformações. O caminho só consome posições, índices, UV0, cor de vértice e propriedades PBR de cor base. Normais são recalculadas pelo jogo.

Materiais com um único `baseColorTexture` usado por todas as primitivas triangulares e UV0 em todas elas podem manter UV e textura. Se há várias texturas/imagens, alguma primitiva não tem UV/textura, ou só há cor de material, as cores são convertidas para cor de vértice; o resultado pode perder detalhe de textura. As demais propriedades PBR — mapas de normal, metallic/roughness, emissive, transparência e shaders personalizados — não são preservadas pelo formato da biblioteca importada. Não dependa delas.

## 2. Pastas e ativos de referência

### Modelos enviados diretamente para o editor

```text
modelos-novos/                       # entrada: um .glb por asset
  bancada_lapidaria.glb
  cadeira_madeira.glb
  .importados.json                   # controle automático de tamanho/data de importação
src/assets/editor/
  modelos.json                       # índice processado, incluído no build
  bancada_lapidaria.webp             # gerado apenas quando uma textura é preservada
```

O diretório `modelos-novos/` fica na raiz do projeto. Com o servidor Vite ao vivo aberto, arquivos novos/alterados são convertidos e a biblioteca aberta recebe atualização. O índice `src/assets/editor/modelos.json` é a saída do conversor; não precisa ser escrito à mão. O arquivo `.importados.json` evita reprocessar arquivos inalterados. Para forçar a conversão integral, a ferramenta permite `node tools/lib/importar.ts --tudo` a partir da raiz do projeto.

### Exemplos existentes de natureza

A natureza em jogo não foi registrada pelo importador genérico acima. A fonte é [`arquivos de transferência/nature assets 3d.glb`](<arquivos de transferência/nature assets 3d.glb>); o plano [`tools/modelos/cenario.json`](tools/modelos/cenario.json) identifica ilhas/peças da folha e os nomes/tamanhos do mundo; [`tools/gerar-chao.ts`](tools/gerar-chao.ts) e [`tools/lib/glb.ts`](tools/lib/glb.ts) geram [`src/assets/models/cenario.json`](src/assets/models/cenario.json), que `src/render/gl/cenario.ts` consome.

Valores concretos do plano de cenário:

| Asset na biblioteca | Peça fonte | `tam` no mundo | Categoria do editor |
|---|---:|---:|---|
| `folhosa_1` (árvore) | N0 | 64 | Árvores |
| `folhosa_4` (árvore) | N8 | 44 | Árvores |
| `pinheiro_1` | N4 | 64 | Árvores |
| `moita_1` | N16 | 24 | Plantas |
| `samambaia_1` | N24 | 24 | Plantas |
| `pedra_1` | N29 | 18 | Pedras e troncos |
| `tronco_1` | N14 | 36 | Pedras e troncos |

Esses números são dimensões máximas em unidades do mundo, definidas por asset no plano; não são uma escala universal de modelagem. As malhas-fonte das peças de natureza são normalizadas no gerador (maior dimensão = 1, centradas e com base Y=0), depois `tam` as escala no jogo. Para assets novos destinados à biblioteca genérica, a regra aplicada é a seção seguinte, não esses valores individuais.

## 3. Escala, eixos, pivot e grade

O importador genérico aplica as transformações de nós do GLB, encontra a caixa delimitadora total, divide as coordenadas pela maior dimensão e centra X/Z, mantendo o ponto mínimo de Y como chão. Portanto, o GLB pode usar qualquer unidade de origem: o importador **descarta a escala absoluta de origem**, mas mantém proporções e orientação. Depois, `src/editor/modelos.ts` usa `TAM_IMPORTADO = 60` para materializar a malha no campo. Na prática, a dimensão mais longa do modelo importado fica com 60 unidades internas; os outros eixos preservam a proporção.

O renderer trabalha com X/Y/Z em matrizes e o chão do campo está no plano XZ. Y é a altura. A transformação do editor é translação, rotação Y e escala. O importador não converte eixos nem escolhe uma “frente” semântica: mantenha Y para cima e modele a orientação frontal desejada no próprio GLB. No pipeline da vila, o código documenta frente local em +Z (`src/render/gl/vila_tex.ts`); esse é um exemplo de asset cuja fachada olha para +Z antes de ser girada.

O pivot normalizado do importador é o centro da caixa delimitadora horizontal (centro X e centro Z) no nível do chão (Y mínimo → 0). O placement do editor usa X/Z como centro de colocação, com essa origem. Centralize a base da malha como descrito para que mover, girar e encaixar seja previsível. O gerador de cenário também produz peças centradas e com base em Y=0.

`EDITOR.grade` é 21 unidades do jogo e `dungeon.tile` é 42; assim, um tile do campo mede duas células de grade. Com a opção de ímã ligada, o editor arredonda X e Z para o múltiplo mais próximo de 21. A unidade não é metro nem centímetro. A convenção útil para assets modulares é medir footprints em células de 21 unidades (por exemplo, módulo com 2 células = 42 unidades), lembrando que o importador genérico ainda escala o maior eixo para 60. O importador atual não tem metadados de footprint e não redimensiona para encaixar automaticamente um asset inteiro numa célula.

Rotação é em torno de Y. Os atalhos Q/E e a roda do mouse usam `EDITOR.giro = 15°` por passo; o editor atual **não** limita automaticamente a 90°. A escala da peça também pode ser ajustada no inspetor/atalhos. A grade controla a posição do pivot, não valida colisões, alinhamento de faces ou medidas de cada modelo. Não conte com snap automático da rotação.

## 4. Nomes e categorias da biblioteca

Para os modelos importados, a chave é derivada do nome do arquivo: remove `.glb`, remove acentos, converte para minúsculas e substitui sequências não alfanuméricas por `_`. Exemplo: `Bancada Lapidária.glb` → chave `bancada_lapidaria`. O nome exibido é o nome original do arquivo sem a extensão, guardado no campo `nome`. Use nomes curtos, únicos, descritivos e estáveis; chaves repetidas colidem/substituem no índice.

Atualmente todo GLB de `modelos-novos/` recebe a categoria fixa **Meus modelos** (`importados`) e a camada `objetos`, com miniatura automática. O formato importado não inclui campo de categoria e não existe configuração de categoria por arquivo no pipeline atual. As categorias internas — Árvores, Plantas, Pedras e troncos, Acampamento, Vila, Itens e Estações — são montadas por código em [`src/data/editor.ts`](src/data/editor.ts) e [`src/editor/modelos.ts`](src/editor/modelos.ts), incluindo mapeamento de grupos e variantes. Não renomeie nem mova arquivos existentes para tentar categorizar um asset genérico: isso não muda sua categoria.

As miniaturas são calculadas na primeira exibição a partir da malha, com projeção inclinada aproximadamente 47° e um giro de prévia. Para referências, o código mostra `folhosa_1` como “Árvore 1” (grupo com variantes), e itens importados pelo nome de arquivo. Não é necessário criar PNG de thumbnail. Um erro ao desenhar a miniatura não impede definir o modelo, mas é um sinal para conferir a geometria/cores.

## 5. Registro gerado e exemplo

O registro real fica em `src/assets/editor/modelos.json`, lido por marcador `@inline-json` no editor e incorporado ao HTML do build. Cada entrada usa a chave normalizada do nome. O conversor gera campos binários codificados em Base64:

- `nome`: rótulo do arquivo sem `.glb`;
- `tam`: caixa delimitadora normalizada `[largura X, altura Y, profundidade Z]`, com maior dimensão = 1;
- `p`: posições Int16 quantizadas, na origem centrada descrita acima;
- `i`: índices Uint16 dos triângulos;
- `uv` + `tex`: UV Uint16 e caminho da textura WebP, quando textura única foi preservada;
- `c`: cores RGB Uint8 por vértice, quando não há textura preservada.

Exemplo esquemático da forma gerada (os valores Base64 são preenchidos pela ferramenta):

```json
{
  "modelos": {
    "bancada_lapidaria": {
      "nome": "bancada_lapidaria",
      "tam": [1, 0.58, 0.72],
      "p": "<posições Int16 em Base64>",
      "i": "<índices Uint16 em Base64>",
      "c": "<cores RGB Uint8 por vértice em Base64>"
    }
  }
}
```

O bloco é ilustrativo: dimensões e payload devem vir da conversão real, não ser copiados desse exemplo. Em uma entrada texturizada, `c` é substituído por `uv` e `tex`, seguindo a interface `Importado` de `src/editor/modelos.ts`.

## 6. Procedimento para adicionar um modelo

1. Exporte o modelo como GLB autocontido, sem Draco/meshopt; incorpore imagem base color no arquivo.
2. Ajuste a malha para Y para cima, chão em Y=0 e origem no centro horizontal. Verifique a orientação frontal em +Z se essa for a convenção que deseja usar.
3. Use uma malha triangulada, UV0 consistente se houver textura, e material com cor base PBR padrão. Considere o limite de 4.000 triângulos como alvo do importador e mantenha a topologia simples para que a redução funcione.
4. Dê ao arquivo um nome único e descritivo, preferencialmente `snake_case.glb` sem acentos.
5. Com o projeto aberto por `Abrir jogo ao vivo.bat`/Vite, copie o `.glb` para `modelos-novos/`.
6. Aguarde o processamento e confira a mensagem do editor. Abra F2 no campo, encontre o asset em **Meus modelos**, confira miniatura e proporções.
7. Coloque-o no mapa, teste escala e giro, compare a ocupação com a grade de 21 unidades e salve pelo sistema existente. O modelo está disponível também em builds seguintes porque o índice é incorporado na compilação.

Para um asset novo seguir categoria interna ou ter escala diferente de 60, não existe hoje configuração declarativa pelo arquivo GLB. A rota usada pelos assets próprios do jogo é um pipeline especializado com dados/planos versionados em `tools/modelos/` e consumo em `src/assets/models/`; ela exige trabalho de integração no código/tabela correspondente. Este documento não presume que o importador de “Meus modelos” realize essa integração.

## 7. Checklist de validação

- [ ] O arquivo é `.glb` binário autocontido, não GLTF externo, OBJ ou FBX.
- [ ] Não usa Draco, meshopt ou outras extensões de compressão não processadas pelo importador.
- [ ] As primitivas visíveis são triângulos; os dados de posição e índices estão presentes e válidos.
- [ ] Y aponta para cima; X/Z formam o chão; o modelo está com a fachada/direção desejada.
- [ ] A origem deixa a base em Y=0 e centraliza o footprint em X/Z.
- [ ] A proporção é correta quando o maior eixo é normalizado para 60 unidades do jogo.
- [ ] Se for peça modular, dimensões e faces foram comparadas com células de 21 unidades; não se presumiu que o importador aplique snap de footprint.
- [ ] UV0 e a única textura base color estão embutidas e funcionais, ou o visual continua legível em cor por vértice após o bake.
- [ ] Nome do arquivo é único e produz chave previsível; o item aparece com o rótulo esperado em “Meus modelos”.
- [ ] Miniatura não está vazia/escura, faces e cores estão visíveis, e escala/giro foram testados no campo.
- [ ] O modelo continua aceitável após redução para perto do alvo de 4.000 triângulos.

## Referências de implementação

- Importador e codificação GLB: [`tools/lib/importar.ts`](tools/lib/importar.ts)
- Vigia/endpoint de importação ao vivo: [`tools/vite-plugin-jogo.ts`](tools/vite-plugin-jogo.ts)
- Biblioteca, malhas, nomes e miniaturas: [`src/editor/modelos.ts`](src/editor/modelos.ts)
- Categorias, grade e tamanho padrão: [`src/data/editor.ts`](src/data/editor.ts)
- Transformação e desenho das peças: [`src/editor/cena.ts`](src/editor/cena.ts), [`src/render/gl/geometria.ts`](src/render/gl/geometria.ts)
- Natureza e escala dos exemplos: [`tools/modelos/cenario.json`](tools/modelos/cenario.json), [`src/render/gl/cenario.ts`](src/render/gl/cenario.ts)
- Prédios texturizados existentes: [`tools/modelos/vila.json`](tools/modelos/vila.json), [`src/render/gl/vila_tex.ts`](src/render/gl/vila_tex.ts)
