@echo off
rem Abre o jogo no modo "ao vivo": cada arquivo salvo (pelo Claude ou pelo Modo Editor) aparece sozinho no navegador.
rem Deixe esta janela preta aberta enquanto joga; fechar a janela desliga o modo ao vivo.
title Cronicas - jogo ao vivo
cd /d "%~dp0"
set "PATH=C:\nvm4w\nodejs;%PATH%"
if not exist node_modules (
  echo Instalando o que o jogo precisa, so na primeira vez...
  call npm ci
)
echo.
echo  Abrindo o jogo em http://localhost:5173/  (F2 no campo = Modo Editor)
echo  Para desligar, feche esta janela.
echo.
call npx vite --port 5173 --open
pause
