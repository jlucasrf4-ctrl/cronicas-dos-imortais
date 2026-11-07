# Ajustes pendentes

Lista de coisas para ajustar depois. Anotar aqui **não** significa começar agora: o Claude só lembra
o mantenedor no início das sessões e pega um item quando ele pedir. Marque `[x]` quando terminar
(com a data) e mova para "Feitos".

Formato: `- [ ] AAAA-MM-DD — <o que> (<onde, se souber>)`

## Abertos

- [ ] 2026-10-18 — **Caçador corcunda/curvado**: no jogo o caçador aparece com as costas curvadas para a frente
      (print do mantenedor, vista de cima no campo). Ver a pose/animação dele (`src/render/gl/cacador_anim.ts`,
      clipes do caçador) e o plano `tools/modelos/cacador.json` (`ajustes`) para descobrir se vem do modelo, da
      T-pose/rig ou do retarget das animações.
- [ ] 2026-10-18 — **Expedição como lugar no mapa**: pontos de interesse (toca de lobos, ruína, runa selvagem,
      boato da vila) com o balão "⚔" em cima; com a heroína selecionada, clique direito = explorar, e o preparo
      abre ao chegar. Complementa o balão de avisos do acampamento (feito em 2026-10-18, `ui/menu_base.ts`).
- [ ] 2026-10-18 — **Mais avisos no balão do acampamento** (se quiser): baú cheio, comida estragando, passo da
      campanha no acampamento. Hoje avisa só "heroína recuperada" e "receita da carpintaria ao alcance".

## Feitos

- [x] 2026-10-23 — **Rótulo "Caçador" com faixa escura sobre a cabeça** (print do mantenedor): no 3D a faixa de
      fundo do nome era projetada no chão e caía em cima da cabeça dele, enquanto o texto flutuava acima; agora o nome
      tem contorno escuro e não tem faixa (`introDraw2D` em `intro/cena.ts`). Provável causa do "Caçador corcunda"
      (aberto em 2026-10-18): nos previews das animações ele está reto. **Confirmar com o mantenedor.**
- [x] 2026-10-23 — **Objetivo da cena inicial em cima da heroína** (print do mantenedor): `#isc-obj` subiu para o alto
      da tela (`51_v8.0_intro_esquiva.css`, por cima da regra antiga de `28_v6.1_cena_inicial.css`).

- [x] 2026-10-18 — **Número na arma** (só visual): círculo com o **DPS inteiro** (arma sozinha, heroína padrão,
      atacando sem parar: combo inteiro, faca 2 cortes, clava carga + combo de 2, arco carga cheia + recarga; o
      mantenedor não quis número quebrado e achou o dano por golpe "fraco" na faca), na cor da qualidade (`QUAL`), na
      mochila e na dica; a qualidade aparece uma vez só na dica (nome sem "(Excelente)"); dica da arma
      curta (tipos, afixos, barra de durabilidade, peso, comparação); ficha completa em "📋 Fichas das armas" na mesa
      de análise. `items/dano_medio.ts`, `ui/inventario.ts` (`armaTipHtml`), `forja/analise.ts` (`anaFichas`), CSS
      `44_v7.7_dano_medio.css`; "Dano por golpe" da ficha da heroína agora é o golpe básico. Teste `dano-medio.spec.ts`.
      Quando o ranque C–SS entrar, trocar a cor do círculo.
- [x] 2026-10-18 — **Nerf do 3º golpe do combo**: `COMBO[2].mult` 1,2 → 0,8 (1º ×0,5, 2º ×0,55). Vale para
      espada/machado/lança (a clava tem o combo de 2 dela, `CLAVA_COMBO`, e a faca não tem combo).
