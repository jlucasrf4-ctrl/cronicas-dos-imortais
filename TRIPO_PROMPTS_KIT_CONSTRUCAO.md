# Kit medieval modular — prompts para Tripo

Pacote inicial derivado da referência enviada: uma pequena casa/loja medieval de madeira escura, pedra cinza quente, telhas de madeira e acabamento low-poly pintado à mão. Use a imagem anexada como **referência visual de estilo** no Tripo. Gere cada item abaixo separadamente; a imagem de referência mostra uma composição completa, mas o pedido de cada geração é somente uma peça individual.

## Como enviar

1. Abra uma geração nova no Tripo e anexe a imagem de referência para orientar estilo, paleta, proporções visuais e acabamento.
2. Gere um único item por vez, copiando o bloco “Prompt-base” e acrescentando um prompt de asset da lista.
3. Exporte cada resultado como `.glb` com os dados e a textura embutidos, sem Draco nem meshopt.
4. Use o nome de arquivo indicado e coloque o GLB em `modelos-novos/` na raiz do projeto.
5. Confira o resultado no editor antes de pedir a próxima variação. O importador reduz a malha e normaliza a maior dimensão para 60 unidades; a escala exata é ajustada no editor.

Os prompts estão em inglês para facilitar o uso direto no gerador. As medidas em “game units” são proporções nominais para que peças correspondentes encaixem. O importador não lê metros nem mantém a escala absoluta do Tripo.

## Prompt-base

Cole este texto antes de cada prompt individual:

```text
Create exactly ONE isolated, game-ready 3D asset, not a scene, not a full building, and not a collection or sheet of objects. Use the attached reference image only for its visual style: medieval fantasy craftsmanship, dark aged oak beams, warm muted brown timber, weathered warm-gray stone, hand-painted low-poly surfaces, readable chunky shapes, restrained detail, soft crafted edges, coherent with a small medieval lapidary shop. Keep the silhouette clear from an isometric 3/4 camera view and make the model visually readable at small game scale.

Model as a single modular prop with clean, closed geometry where appropriate. Use Y-up coordinates; X and Z lie on the ground plane. Put the bottom contact surface at Y=0 and center the footprint around X=0, Z=0. Keep the intended front facing local +Z. Do not add a ground plane, pedestal, diorama, background, border, labels, lettering, watermark, people, extra props, lighting effects, or floating parts. Do not combine this asset with any other kit part. Avoid tiny loose details that will disappear after mesh reduction.

Use one PBR material with one embedded base-color texture and clean UV0 if texturing is used. Keep the palette and roughness natural and matte. Do not rely on normal, metallic/roughness, emissive, transparency, or custom shader maps for essential visual information. Export a self-contained, uncompressed binary GLB with embedded geometry and texture; no external image files, Draco, or meshopt compression.
```

## Peças do primeiro kit

As dimensões abaixo são **alvos nominais em unidades do jogo**, baseadas na grade atual de 21 unidades. Cada prompt pede que o Tripo respeite as proporções. A escala de origem será descartada pelo importador; no editor, comece com os fatores indicados e ajuste após verificar o encaixe.

### 1. Piso quadrado de madeira — `piso_madeira_1x1.glb`

```text
Asset: one square medieval plank floor tile. Nominal proportions: 42 game units wide on X, 42 deep on Z, 3 thick on Y (a 2-by-2-cell footprint on the current 21-unit construction grid). Top surface is dark oak planks with subtle hand-painted grain; the edge shows a simple solid timber subframe. Keep all four sides straight, square, and flush so identical tiles can be placed edge to edge without gaps or overhangs. No nails protruding, no stones, no furniture. Bottom is flat at Y=0. This is one reusable floor tile, not a platform or room. Suggested initial editor scale: 0.70.
```

### 2. Parede de madeira fechada — `parede_madeira_2x4.glb`

```text
Asset: one straight, solid medieval timber wall segment. Nominal proportions: 42 wide on X, 84 high on Y, 6 deep on Z (2 grid cells wide, 4 cells high, 2/7 cell deep). Dark oak vertical infill boards held by thick structural beams. Keep the top, bottom, left, and right boundaries square and flush; do not add side posts wider than the nominal footprint. No door, no window, no roof, no stone foundation, no furniture. The front is local +Z. Bottom at Y=0; footprint centered horizontally. Suggested initial editor scale: 1.40.
```

### 3. Parede com vão de porta — `parede_madeira_porta_2x4.glb`

```text
Asset: one straight modular medieval timber wall segment with a clean, completely open doorway. Same outer nominal proportions as the closed wall: 42 wide on X, 84 high on Y, 6 deep on Z. Center the opening on X; make the clear opening 34 wide and 76 high, with its threshold beginning at Y=0. The opening must go through the full wall depth, with no hidden backing surface, and must have square vertical jambs and a simple oak lintel. Do not include a door leaf, handle, curtain, stairs, roof, foundation, or surrounding room. All outer segment boundaries must remain flush for neighboring wall segments. Front local +Z. Suggested initial editor scale: 1.40.
```

### 4. Porta separada — `porta_madeira_0-8x1-7.glb`

```text
Asset: one separate medieval oak door leaf that can fit inside the matching 34-by-76 doorway opening. Nominal door size: 30 wide on X, 72 high on Y, 3 thick on Z. Dark vertical oak planks, two restrained horizontal braces, small dark iron hinges and a simple iron latch. Keep the door rectangular and flat, with no frame, no wall, no arch, no knob that sticks far out, and no floor. Front surface faces local +Z. Bottom at Y=0 and footprint centered. Suggested initial editor scale: 1.20.
```

### 5. Parede com vão de janela — `parede_madeira_janela_2x4.glb`

```text
Asset: one straight modular timber wall segment with one centered square window opening. Same outer nominal proportions as the wall set: 42 wide on X, 84 high on Y, 6 deep on Z. Clear opening is 24 wide and 26 high, centered horizontally, with the bottom of the opening at Y=42 (two grid cells above the floor). The opening goes through the entire wall depth. Add only a simple oak lintel and sill integrated inside the segment footprint. No glass, shutters, curtains, door, roof, foundation, or room. Keep all four outer edges flush for modular placement. Front local +Z. Suggested initial editor scale: 1.40.
```

### 6. Janela separada — `janela_madeira_0-8x0-9.glb`

```text
Asset: one separate medieval timber window insert sized to fit the matching 24-by-26 wall opening. Nominal outer size: 20 wide on X, 22 high on Y, 4 deep on Z. A simple oak frame with two wooden crossbars and small muted amber glass panes; the frame must fit wholly inside the opening, leaving a small visible clearance. No wall, no stone, no curtain, no flowers, no shutter projecting beyond the frame, and no surrounding scene. Front faces local +Z. Center the frame around X=0 and Z=0; place its bottom edge at Y=0 so the importer keeps a floor-level pivot. Suggested initial editor scale: 0.37.
```

### 7. Escada reta entre pavimentos — `escada_madeira_2x4.glb`

```text
Asset: one straight, sturdy medieval wooden staircase with open risers and solid oak treads, matching the attached reference. Nominal footprint: 42 wide on X, 84 long on Z, rising 84 on Y (2-by-4 grid cells of run and 4 cells of rise). The bottom approach is at Z=+42 and Y=0; the upper landing is at Z=-42 and Y=84. Add simple side stringers, no handrails that extend outside the 42-unit width. The staircase must be one coherent mesh and have flat contact zones at the bottom and top. No room, floor tile, wall, people, furniture, or surrounding platform. Face the climb from local +Z toward local -Z. Suggested initial editor scale: 1.40.
```

### 8. Painel de telhado inclinado — `telhado_madeira_2x4.glb`

```text
Asset: one modular medieval roof slope panel, viewed from the exterior. The roof pitch must be built into the mesh because the editor rotates pieces around Y only. Nominal bounding dimensions: 42 across the horizontal roof run on X, 42 high on Y and 42 along the ridge on Z (a 2-by-2-cell module); the upper ridge edge rises from Y=0 at one eave side to Y=42 at the opposite ridge side. This makes a 45-degree roof pitch. Use overlapping dark weathered wooden shingles in neat horizontal courses with a sturdy timber edge frame. This is one side of a gabled roof, not a complete house; keep the two edges along the ridge/eave straight and clean so repeated panels meet without gaps. A 180-degree yaw rotation should make the mirrored opposite slope. No chimney, dormer, projecting rafters, house, background, or foliage. Center the footprint around X=0, Z=0 and keep the lowest eave contact at Y=0. Suggested initial editor scale: 0.70.
```

## Medidas de encaixe e pivots

- Piso: 42×42, equivalente a 2×2 células de grade. Comece em escala 0,70 e use o snap do editor para alinhar o centro em múltiplos de 21.
- Segmentos de parede: largura de 42, altura de 84, espessura de 6. Comece em escala 1,40. Como o pivot importado é o centro do footprint no chão, posicione o centro do segmento na célula desejada; ele não encaixa automaticamente pela extremidade.
- Porta e janela: são inserções independentes para permitir composição. Os vãos e as peças devem ser conferidos em cena após a normalização/escala do importador.
- Escada: dimensões-alvo 42×84×84, compatíveis com dois pavimentos separados por 84 unidades no MVP atual. Frente/entrada da escada fica em +Z e o patamar superior em -Z.
- Telhado: a inclinação precisa estar na própria malha; o editor só gira em torno de Y. O painel pode ser girado 180° para inverter o sentido do caimento. O snap existente atua em X/Z, não resolve encontros de telhado ou encaixes de borda.
- A rotação horizontal Q/E existente avança 15° por passo. Não conte com rotação automática em 90°.

Os fatores são apenas escalas iniciais calculadas a partir da dimensão máxima nominal: tamanho final ÷ 60. O importador centraliza todos os pivots em X/Z e põe a base em Y=0, portanto a origem de um batente importado não ficará na dobradiça. Para orientar portas/janelas exatamente no vão, use a posição e a rotação do editor e valide visualmente.

## Direção de arte baseada na referência

- Silhuetas simples e largas; contraste legível entre madeira escura e pedra cinza quente.
- Vigas estruturais visíveis, encaixes de carpintaria e bordas de telha com detalhes grandes o suficiente para sobreviver à redução.
- Textura pintada à mão com variação suave, sem depender de mapas PBR adicionais.
- Evitar objetos pequenos fundidos à geometria (lanternas, ferramentas, vasos, plantas, caixas e cristais da imagem devem ser gerados em arquivos próprios se forem necessários).
- A referência representa uma oficina/loja completa e serve para estilo. Não pedir ao Tripo que gere aquela casa inteira para este kit modular: esses itens independentes devem ser montados no editor.

## Conferência depois de cada geração

- [ ] O resultado contém somente o asset solicitado, sem cena/base de apresentação.
- [ ] A proporção visual bate com as dimensões nominais do prompt.
- [ ] Eixo Y para cima; segmento frontal para +Z; piso inferior em Y=0.
- [ ] Bordas modulares são retas e não têm enfeites que impeçam a junção.
- [ ] Aberturas de porta/janela atravessam toda a parede e as inserções correspondem aos vãos.
- [ ] GLB é autocontido e sem compressão Draco/meshopt.
- [ ] Textura base color está embutida e é a única textura essencial.
- [ ] Após soltar o arquivo em `modelos-novos/`, a miniatura e o modelo aparecem em “Meus modelos”.
- [ ] Escala inicial foi ajustada no editor e a peça foi conferida sobre a grade de 21 unidades.
