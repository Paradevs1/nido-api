# Como regerar os diagramas

Os PNGs deste diretório foram gerados a partir dos fontes Mermaid em `src/*.mmd`,
usando o `@mermaid-js/mermaid-cli` com o Chrome do sistema.

## Pré-requisitos
- Node + npx
- Google Chrome instalado (`/usr/bin/google-chrome`)

## Gerar (flowcharts e sequência — renderizam direto)
```bash
cd diagramas
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
for f in src/*.mmd; do
  name=$(basename "$f" .mmd)
  npx -y @mermaid-js/mermaid-cli@latest -i "$f" -o "$name.png" \
    -p puppeteer.json -c config.json -b white -s 3
done
```

## Observação sobre o `01_maquina_estados`
Diagramas com aspecto mais vertical saem do mermaid-cli com `width="100%"` no SVG, o
que faz a rasterização para PNG **ladrilhar** a imagem. Workaround usado: renderizar em
SVG, fixar a largura em px e fotografar com o Chrome headless:

```bash
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
npx -y @mermaid-js/mermaid-cli@latest -i src/01_maquina_estados.mmd \
  -o 01_maquina_estados.svg -p puppeteer.json -c config.json -b white
# fixar width (use o valor do viewBox do próprio SVG; aqui ~736x839)
sed -i 's/width="100%"/width="736px" height="839px"/; s/max-width: [0-9.]*px;//' 01_maquina_estados.svg
google-chrome --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=3 --window-size=746,849 \
  --default-background-color=FFFFFFFF \
  --screenshot=01_maquina_estados.png "file://$PWD/01_maquina_estados.svg"
rm -f 01_maquina_estados.svg
```

## Arquivos
- `src/*.mmd` — fontes editáveis (fonte da verdade).
- `*.png` — imagens renderizadas (referenciadas em `../06_DIAGRAMAS.md`).
- `puppeteer.json` / `config.json` — flags do Chrome e tema do Mermaid.
