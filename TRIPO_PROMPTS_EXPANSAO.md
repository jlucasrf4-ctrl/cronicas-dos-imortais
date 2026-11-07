# Expansão do kit medieval — 29 prompts adicionais

Esta expansão leva o kit a **37 modelos individuais**: os 8 do [kit inicial](TRIPO_PROMPTS_KIT_CONSTRUCAO.md) mais os 29 prompts abaixo. Gere cada bloco como um asset separado; não peça uma folha com vários modelos em uma única geração.

## Pranchas para anexar

- Construção: [REFERENCIA_MODULOS_CONSTRUCAO_TRIPO.png](REFERENCIA_MODULOS_CONSTRUCAO_TRIPO.png). Anexe-a ao gerar pisos, paredes, pilares, plataformas, telhado e chaminé.
- Oficina/interior: [REFERENCIA_MOVEIS_OFICINA_TRIPO.png](REFERENCIA_MOVEIS_OFICINA_TRIPO.png). Anexe-a ao gerar bancadas, móveis e decoração.

Use o **Prompt-base** de [TRIPO_PROMPTS_KIT_CONSTRUCAO.md](TRIPO_PROMPTS_KIT_CONSTRUCAO.md) antes de cada prompt individual. Ele especifica estilo, eixos, pivot, GLB autocontido e materiais. Nos itens abaixo, os nomes de arquivo são os nomes sugeridos para a pasta `modelos-novos/`.

As dimensões são alvos nominais em unidades do jogo, usando a célula atual de 21 unidades; não são medidas absolutas do Tripo. O importador normaliza a maior dimensão para 60, por isso a escala indicada é o primeiro valor a experimentar no editor, calculado como dimensão máxima nominal ÷ 60.

## Construção

### 9. Piso de pedra — `piso_pedra_1x1.glb` · escala inicial 0,70

```text
Create one square medieval stone floor tile, nominal size 42 wide (X) × 42 deep (Z) × 4 thick (Y), with a 2-by-2-cell footprint on a 21-unit grid. Use a small number of large, irregular warm-gray stone slabs fitted tightly together, with a clean square perimeter and a flat underside. No dirt, moss tufts, border, wall, or extra stones outside the tile. Y=0 at the bottom, footprint centered at X=0, Z=0, front toward +Z. Repeatable edge-to-edge without overhangs.
```

### 10. Parede de pedra — `parede_pedra_2x4.glb` · escala inicial 1,40

```text
Create one straight solid medieval stone wall module, nominal size 42 wide (X) × 84 high (Y) × 12 deep (Z). Build it from chunky fitted warm-gray masonry blocks with restrained variation and a readable, mostly flat front and back. Keep the top and side boundaries square and flush for joining identical modules. No doorway, window, arch, battlements, vines, roof, or foundation wider than the module. Y=0 at the bottom; center the footprint on X=0, Z=0; front toward +Z.
```

### 11. Pilar de canto em madeira — `pilar_canto_madeira_2x4.glb` · escala inicial 1,40

```text
Create one standalone heavy medieval oak corner post, nominal size 8 × 84 × 8. Use a square timber column with simple carved joinery and a few broad cross-brace sockets, but no attached wall panels. Keep all sides readable and the square footprint exact. Bottom at Y=0, footprint centered at X=0, Z=0, no overhanging cap, front detail toward +Z.
```

### 12. Pilar de canto em pedra — `pilar_canto_pedra_2x4.glb` · escala inicial 1,40

```text
Create one standalone square medieval stone corner pillar, nominal size 16 × 84 × 16. Use large warm-gray masonry blocks with restrained hand-painted seams, a flat top and flat bottom, and straight square sides suitable for a building corner. No wall attached, no statue, no plant, no broad capital. Bottom at Y=0, footprint centered at X=0, Z=0.
```

### 13. Plataforma elevada — `plataforma_madeira_1x1.glb` · escala inicial 0,70

```text
Create one square raised medieval timber platform, nominal footprint 42 × 42 and total height 10. Top made from tightly fitted dark oak planks; four stout supports are directly below the corners and remain inside the 42 × 42 footprint. Keep the top level and perimeter square so identical pieces can meet flush. No stairs, railings, walls, furniture, or objects on top. Bottom at Y=0, footprint centered at X=0, Z=0.
```

### 14. Segmento de guarda-corpo — `guarda_corpo_madeira_2x2.glb` · escala inicial 0,70

```text
Create one straight medieval oak guardrail segment, nominal size 42 wide (X) × 42 high (Y) × 5 deep (Z), for the edge of a raised landing. Use two square posts contained within the 42-unit width, one top rail and one simple middle rail; leave the spaces open. Keep ends square and suitable for adjoining identical segments. No stairs or platform attached. Bottom at Y=0, center the footprint at X=0, Z=0, front toward +Z.
```

### 15. Parede com arco de pedra — `parede_arco_pedra_2x4.glb` · escala inicial 1,40

```text
Create one straight medieval stone wall module, nominal outer size 42 wide × 84 high × 12 deep, with one centered open round-topped archway. The opening is 30 wide and 72 high, starts at floor level Y=0, and passes fully through the entire wall depth. Use chunky warm-gray stones and a simple wedge-stone arch ring contained inside the outer width. No door, gate, room, trim projecting beyond the wall module, or scenery. Bottom at Y=0; footprint centered on X=0, Z=0; front toward +Z.
```

### 16. Chaminé de pedra — `chamine_pedra_1x1x4.glb` · escala inicial 1,40

```text
Create one standalone medieval square stone chimney stack, nominal size 16 × 16 × 84, with a simple hollow square flue visible at the top and a restrained stone cap. Make it a single coherent architectural prop with a flat base, straight shaft and no smoke. No roof attached, no fire, no bricks scattered around it. Bottom at Y=0; center footprint at X=0, Z=0.
```

### 17. Cumeeira de telhado — `cumeeira_telhas_madeira_2x1.glb` · escala inicial 0,70

```text
Create one short medieval wooden-shingle roof ridge-cap segment, nominal size 42 long along Z × 8 wide across X × 8 high. It is a separate cap piece that sits over the seam between two sloping shingle panels. Use dark weathered wooden shingles, a clean inverted-V profile and straight ends so multiple segments can repeat along the ridge. No roof slopes attached, no rafters, no chimney. Bottom contact edge at Y=0; center footprint at X=0, Z=0.
```

### 18. Viga estrutural — `viga_madeira_2x4.glb` · escala inicial 1,40

```text
Create one straight heavy dark-oak structural beam, nominal size 8 × 8 × 84, with a simple square cross-section and subtle hand-hewn facets. Keep it straight, with flat square ends and no attached brackets, wall, rope, nails protruding, or decorative carving. Center its horizontal footprint at X=0, Z=0 and put its bottom at Y=0.
```

## Mobiliário e oficina

### 19. Bancada de lapidação — `bancada_lapidacao.glb` · escala inicial 0,70

```text
Create one standalone medieval lapidary workbench, nominal size 42 wide × 20 deep × 30 high. Dark oak trestle legs and a thick worktop; include one compact hand-cranked grinding wheel firmly mounted at one end and a shallow work area, but no loose tools, gems, drawers full of items, stool, or person. Keep everything within the footprint. Bottom at Y=0, center footprint at X=0, Z=0, working side faces +Z.
```

### 20. Rebolo manual — `rebolo_manual.glb` · escala inicial 0,58

```text
Create one separate medieval foot-powered stone grinding wheel, nominal size 21 wide × 35 high × 21 deep. One large pale-gray abrasive wheel mounted in a sturdy dark-oak A-frame with a simple pedal and crank. Clearly one machine, with no workbench, no loose tools, no gems, and no worker. Keep the base flat at Y=0; center the footprint at X=0, Z=0; front toward +Z.
```

### 21. Balcão comercial — `balcao_comercial.glb` · escala inicial 0,70

```text
Create one standalone medieval shop counter, nominal size 42 wide × 21 deep × 32 high. Dark oak front panels, a sturdy top and one modest lower shelf; the customer-facing side is local +Z. Do not add merchandise, signs, stools, shelves, people, or a room. Keep the object within the 42 × 21 footprint and place the bottom at Y=0 with the footprint centered at X=0, Z=0.
```

### 22. Vitrine de cristais — `vitrine_cristais.glb` · escala inicial 0,70

```text
Create one standalone medieval tabletop crystal display cabinet, nominal size 42 wide × 18 deep × 32 high. A dark-oak counter base and a simple glass-topped case with one or two large faceted purple, pale-blue and red crystals inside. Keep the glass clear and low-detail, the case closed, and all geometry inside its footprint. No readable labels, no wall, no customer, no extra furniture. Bottom at Y=0; center footprint at X=0, Z=0; front toward +Z.
```

### 23. Mesa de trabalho — `mesa_trabalho.glb` · escala inicial 0,53

```text
Create one plain sturdy medieval dark-oak worktable, nominal size 32 wide × 32 deep × 30 high. Four simple legs, a thick square top and restrained hand-made edge detail. Keep the tabletop empty; no chairs, tools, food, books, cloth or scenery. Bottom at Y=0, footprint centered at X=0, Z=0.
```

### 24. Cadeira — `cadeira_madeira.glb` · escala inicial 0,50

```text
Create one simple medieval dark-oak chair, nominal size 16 wide × 18 deep × 30 high. A flat plank seat, four straight legs, and a modest slatted back. Keep the silhouette sturdy and readable, with no cushion, table, person, or surrounding scene. Bottom at Y=0; center the footprint at X=0, Z=0; front of seat toward +Z.
```

### 25. Banco baixo — `banco_baixo.glb` · escala inicial 0,27

```text
Create one small medieval oak three-legged stool, nominal size 14 wide × 14 deep × 16 high. One round solid seat and three sturdy legs, simple hand-hewn form, no backrest, no cushion, no table or person. Bottom at Y=0 and footprint centered at X=0, Z=0.
```

### 26. Cama simples — `cama_madeira.glb` · escala inicial 1,05

```text
Create one modest medieval single bed, nominal size 42 wide × 63 deep × 30 high. Dark-oak frame with a simple headboard at the -Z end, a thin muted blue-gray blanket and one plain pillow. Keep bedding compact within the frame; no canopy, nightstand, person, room, or extra objects. Bottom at Y=0; footprint centered at X=0, Z=0; foot of bed faces +Z.
```

### 27. Armário alto — `armario_madeira.glb` · escala inicial 1,00

```text
Create one standalone medieval dark-oak wardrobe, nominal size 32 wide × 24 deep × 60 high. Two simple plank doors with restrained dark-iron hinges and ring pulls, a flat top and a stable rectangular base. Closed doors, no contents visible, no wall, no surrounding furniture or floor. Bottom at Y=0, footprint centered at X=0, Z=0, front faces +Z.
```

### 28. Prateleira de parede — `prateleira_parede.glb` · escala inicial 0,70

```text
Create one wall-mounted medieval oak shelf, nominal size 42 wide × 14 deep × 20 high, with two simple plank shelves and sturdy small brackets. Add only a few large readable books and jars, leaving open space; all contents are fixed to this single prop and stay inside its footprint. No wall behind it, no room, no tiny clutter, no writing. Put its back plane at Z=-7, bottom at Y=0, front toward +Z.
```

### 29. Estante de livros — `estante_livros.glb` · escala inicial 1,00

```text
Create one freestanding medieval dark-oak bookcase, nominal size 42 wide × 18 deep × 60 high. Three shelves with a small number of large, simple books and a few plain storage jars. Keep all objects contained within the frame and clearly readable at small scale. No wall, no lettering on book spines, no room or floor. Bottom at Y=0; footprint centered at X=0, Z=0; front toward +Z.
```

### 30. Baú de madeira — `bau_madeira.glb` · escala inicial 0,43

```text
Create one compact medieval oak storage chest, nominal size 26 wide × 18 deep × 18 high. Plank construction, a gently curved lid, two simple iron straps and one centered latch. Closed, no contents, no key, no surrounding props. Bottom at Y=0, footprint centered at X=0, Z=0; front toward +Z.
```

### 31. Barril — `barril_madeira.glb` · escala inicial 0,47

```text
Create one small medieval wooden barrel, nominal size 18 wide × 18 deep × 28 high. Dark oak staves with two simple dark-iron hoops, flat stable bottom and a plain closed top. No spigot, no liquid, no nearby objects, no stack. Bottom at Y=0; center footprint at X=0, Z=0.
```

### 32. Caixote — `caixote_madeira.glb` · escala inicial 0,35

```text
Create one square medieval wooden shipping crate, nominal size 21 × 21 × 21. Dark-oak boards, reinforced corners, simple visible lid seams. Keep it closed and empty with no printed marks, no lettering, no rope and no other crates. Bottom at Y=0; footprint centered at X=0, Z=0.
```

### 33. Saco de estopa — `saco_estopa.glb` · escala inicial 0,33

```text
Create one tied medieval burlap sack, nominal size 14 wide × 14 deep × 20 high. A softly bulging coarse cloth sack with a gathered tied neck and simple muted tan fabric. One object only; no grain spilling, no other sacks, no labels, no scene. Bottom contact at Y=0; footprint centered at X=0, Z=0.
```

### 34. Tapete — `tapete_madeira.glb` · escala inicial 0,70

```text
Create one flat rectangular medieval woven rug, nominal size 42 wide × 42 deep and no more than 1 thick. Muted deep-red, ochre and dark-blue geometric woven pattern inspired by the attached style reference, with restrained short fringe contained inside the square footprint. Keep it perfectly flat, no rolled edge, no floor, no furniture, no letters. Bottom at Y=0; center at X=0, Z=0.
```

### 35. Lanterna de chão — `lanterna_metal.glb` · escala inicial 0,33

```text
Create one small medieval floor lantern, nominal size 8 wide × 8 deep × 20 high. Dark iron frame, simple warm amber glass panes and a compact hanging loop on top. No visible flame particle or smoke, no chain, no floor or other objects. Keep all parts connected; base at Y=0; footprint centered at X=0, Z=0.
```

### 36. Tocha de parede — `tocha_parede.glb` · escala inicial 0,40

```text
Create one medieval wall-mounted iron torch bracket with a short wooden torch, nominal size 8 wide × 12 deep × 24 high. A restrained small flame shape may be part of the mesh, but no smoke or light rays. Keep the bracket on a flat mounting back oriented toward local -Z, with the torch projecting toward +Z. No wall, no scene, no second torch. Bottom at Y=0; footprint centered at X=0, Z=0.
```

### 37. Suporte de ferramentas — `suporte_ferramentas.glb` · escala inicial 0,70

```text
Create one wall-mounted medieval wooden tool rack, nominal size 42 wide × 8 deep × 24 high, with a few large readable lapidary hand tools hanging neatly from hooks. Use simple iron tongs, a hammer and a chisel; avoid tiny details. All tools are fixed to and contained within this single rack. No wall behind it, no workbench, no person, no lettering. Back toward -Z, tools face +Z; bottom at Y=0; centered at X=0, Z=0.
```

## Ordem sugerida de geração

Para reduzir retrabalho, gere e confira primeiro **piso de pedra, parede de pedra, pilar, plataforma e guarda-corpo**. Depois faça **bancada de lapidação, balcão, vitrine, cadeira, cama e armário**. Por último gere os props pequenos de armazenamento e iluminação. Use a prancha de referência correspondente, mas sempre peça somente um objeto por geração.

Os fatores de escala são valores iniciais derivados do tamanho nominal e do importador do projeto; o resultado do Tripo pode se afastar do prompt. Após baixar cada GLB, verifique a miniatura, use o fator como ponto de partida e ajuste no editor sobre a grade de 21 unidades.
