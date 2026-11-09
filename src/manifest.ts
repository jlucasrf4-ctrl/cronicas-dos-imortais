/* Estilos do jogo (Fase 2 do ROADMAP). Gerado uma vez por tools/extract.ts; daqui em diante, edite à mão.
   Quem lê: tools/lib/montagem.ts (plugin do Vite e testes). Caminhos relativos à raiz do projeto.
   - estilos: cada bloco vira um <style> no <head>, na ordem; o texto é a concatenação exata dos arquivos.
     O bloco "ico-css" precisa continuar com esse id e com uma regra .ico-<chave>{background-image:url(...)} por
     linha: o jogo lê esse <style> com regex para montar o ICOS (ver src/inicio/modulos/v5.2_icones_pintados.ts).
   O JS não está aqui: é src/main.ts e o que ele importa (Fase 4). */

interface BlocoEstilo {
  id?: string;
  arquivos: string[];
}

export const estilos: BlocoEstilo[] = [
  {
    arquivos: [
      "src/styles/00_base.css",
      "src/styles/01_v3.7.css",
      "src/styles/02_v3.7b_aljava_unida_equipamento.css",
      "src/styles/03_v3.8.css",
      "src/styles/04_v3.9_janelas.css",
    ],
  },
  {
    arquivos: [
      "src/styles/05_v3.16_tela_de_titulo_historia_menus_hud.css",
      "src/styles/06_v4.4_absorcao_de_runas.css",
      "src/styles/07_v4.4_celular.css",
      "src/styles/08_v4.5_forja_e_desgaste.css",
      "src/styles/09_v4.7_menos_texto.css",
      "src/styles/10_v5.0_sala_de_treino_status.css",
      "src/styles/11_v5.2_icones_pintados.css",
      "src/styles/12_v5.4_encaixe_mais_facil_ao_arrastar.css",
      "src/styles/13_v5.8.css",
      "src/styles/14_v5.9_acampamento_e_sobrevivencia.css",
      "src/styles/15_v5.9.02.css",
      "src/styles/16_v5.9.03_mochila_continua_boneco.css",
      "src/styles/17_v5.9.04_tamandua.css",
      "src/styles/18_v5.9.05_proficiencias.css",
      "src/styles/19_v5.9.07.css",
      "src/styles/20_v5.9.08.css",
      "src/styles/21_v5.9.09_editor_de_botoes.css",
      "src/styles/22_v5.9.10_raridade_no_fundo_da_peca.css",
      "src/styles/23_v5.9.12_janela_de_acoes_da_base.css",
      "src/styles/24_v5.9.13_carpintaria.css",
      "src/styles/25_v5.9.14_mesa_de_analise.css",
      "src/styles/26_v5.9.15_carne_assada_brilho_e_animacao.css",
      "src/styles/27_v6.0_faca_e_corda_celular.css",
      "src/styles/28_v6.1_cena_inicial.css",
      "src/styles/29_v7.7_painel_de_acoes.css",
      "src/styles/30_v7.7_dicas.css",
      "src/styles/31_v7.7_tela_de_titulo.css",
      "src/styles/32_v7.7_zoom_do_mapa.css",
      "src/styles/33_v7.7_selecao.css",
      "src/styles/34_v7.7_campanha.css",
      "src/styles/35_v7.7_alvo_foco_rastreio.css",
      "src/styles/36_v7.7_botoes.css",
      "src/styles/37_v7.7_hud_campo.css",
      "src/styles/38_v7.7_mochila_campo.css",
      "src/styles/39_v7.7_mapa_ladrilhos.css",
      "src/styles/40_v7.7_mapa_rts.css",
      "src/styles/41_v7.7_transicao_campo.css",
      "src/styles/42_v7.7_cacada.css",
      "src/styles/43_v7.7_selecao_inv.css",
      "src/styles/44_v7.7_dano_medio.css",
      "src/styles/45_v7.7_preparo_tela.css",
      "src/styles/46_v7.7_grade_a2.css",
      "src/styles/47_v7.7_bau_infinito.css",
      "src/styles/48_v7.7_voidd.css",
      "src/styles/49_v7.7_menu_lobo.css",
      "src/styles/50_v8.0_diario.css",
      "src/styles/51_v8.0_intro_esquiva.css",
      "src/styles/52_v8.0_vila.css",
      "src/styles/53_v8.0_criacao.css",
      "src/styles/54_v8.0_camera_perto.css",
      "src/styles/55_v8.0_celular_imersivo.css",
      "src/styles/56_v8.0_transicao_celular.css",
      "src/styles/57_v8.1_progresso_armas.css",
      "src/styles/58_v8.1_acampamento_campo.css",
      "src/styles/59_v8.1_cla.css",
      "src/styles/60_v8.1_estados.css",
      "src/styles/61_v8.1_editor.css",
      "src/styles/62_v8.1_perigo.css",
      "src/styles/63_v8.1_hud_traco.css",
      "src/styles/64_v8.1_craft_rapido.css",
      "src/styles/65_v8.1_modelos_teste.css",
      "src/styles/66_v8.3_minimapa.css",
      "src/styles/67_v8.3_caderno.css",
      "src/styles/68_v8.3_armadilhas.css",
      "src/styles/69_v8.3_barra_xp.css",
    ],
  },
  { id: "ico-css", arquivos: ["src/styles/icones-pintados.css"] },
];
