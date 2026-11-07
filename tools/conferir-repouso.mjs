import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const pasta = path.resolve('previas/repouso-2026-11-04');
await mkdir(pasta, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
  const erros = [];
  page.on('pageerror', e => erros.push(e.message));
  await page.goto(pathToFileURL(path.resolve('dist/vtest.html')).href);
  await page.waitForFunction('!!window.__t', { timeout: 60000 });
  await page.evaluate(`__t.enterGame(); window.__h=__t.createHero('Ayla',__t.bornFromSeed(777)); __t.gsRun('MODELOS')`);
  await page.waitForTimeout(1200);
  for (const modelo of ['heroina', 'corpo_f02']) {
    const select = page.locator('#mt-modelo');
    const opcoes = await select.locator('option').evaluateAll(els => els.map(e => e.value));
    if (!opcoes.includes(modelo)) throw new Error('Modelo ausente: '+modelo+'; opções: '+opcoes.join(', '));
    await select.selectOption(modelo);
    await page.waitForTimeout(500);
    await page.locator('[data-mt="pausa"]').click();
    const canvas = page.locator('#modelos-teste canvas');
    const salvar = async vista => {
      const png = await canvas.evaluate(cv => cv.toDataURL('image/png').split(',')[1]);
      await writeFile(path.join(pasta, modelo+'-'+vista+'.png'), Buffer.from(png, 'base64'));
    };
    await salvar('frente');
    const b = await canvas.boundingBox();
    await page.mouse.move(b.x+b.width/2, b.y+b.height/2);
    await page.mouse.down();
    await page.mouse.move(b.x+b.width/2+Math.PI/2/0.012, b.y+b.height/2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(250);
    await salvar('perfil');
  }
  if (erros.length) throw new Error(erros.join('\n'));
  console.log('Prévia frontal e de perfil dos dois modelos sem erros de página:', pasta);
} finally {
  await browser.close();
}
