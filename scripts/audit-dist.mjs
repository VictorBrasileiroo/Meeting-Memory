import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import ts from 'typescript';

const root = resolve(process.argv[2] ?? 'dist');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.background.type, 'module');
assert.deepEqual(manifest.permissions, ['storage', 'activeTab', 'tabCapture', 'offscreen']);
assert.deepEqual(manifest.host_permissions, ['https://generativelanguage.googleapis.com/*']);
for (const key of ['content_scripts', 'externally_connectable']) assert.equal(manifest[key], undefined, `Permissão inesperada: ${key}`);
const csp = manifest.content_security_policy.extension_pages;
assert.ok(csp.includes("script-src 'self'"));
assert.ok(csp.includes('connect-src https://generativelanguage.googleapis.com'));
assert.ok(!/unsafe-eval|unsafe-inline|localhost|<all_urls>/.test(csp));
const entries = [manifest.action.default_popup, manifest.options_ui.page, manifest.background.service_worker, 'src/session/session.html', 'src/offscreen/offscreen.html', 'src/microphone/microphone.html', 'src/review/review.html'];
entries.push('src/library/library.html');
entries.forEach((entry) => assert.ok(existsSync(join(root, entry)), `Entrypoint ausente: ${entry}`));

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const files = walk(root).filter((file) => /\.(html|js|css|json)$/.test(file));
const offscreenBundle = readFileSync(join(root, 'offscreen.js'), 'utf8');
if (root.endsWith('dist')) { assert.ok(offscreenBundle.includes('CHUNK_PRODUCTION_29_30')); assert.ok(!offscreenBundle.includes('CHUNK_TEST_10_SECONDS')); }
if (root.endsWith('dist-chunk-test')) assert.ok(offscreenBundle.includes('CHUNK_TEST_10_SECONDS'));
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const label = relative(root, file);
  if (!root.endsWith('dist-diagnostic')) assert.ok(!text.includes('MM_TRANSCRIPTION_STRUCTURE_DEV_ONLY') && !text.includes('annotationFields'), `Diagnóstico em produção: ${label}`);
  assert.ok(!/localhost|127\.0\.0\.1|@vite\/client|react-refresh/.test(text), `Código dev: ${label}`);
  assert.ok(!/AIza[\w-]{30,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(text), `Possível secret: ${label}`);
  assert.ok(!/\beval\s*\(|new Function\s*\(/.test(text), `Eval proibido: ${label}`);
  if (/generativelanguage\.googleapis|@google\/genai/.test(text)) assert.ok(/local-worker-|manifest\.json/.test(label), `Rede Gemini fora do worker: ${label}`);
  if (file.endsWith('.html')) {
    assert.ok(!/<script[^>]*>\s*[^<\s]/.test(text), `Script inline: ${label}`);
    for (const match of text.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const target = match[1];
      assert.ok(!/^(https?:|\/\/|data:)/.test(target), `Asset remoto: ${label}`);
      assert.ok(existsSync(resolve(dirname(file), target)), `Referência ausente em ${label}: ${target}`);
    }
  }
  if (file.endsWith('.css')) assert.ok(!/(?:@import|url\()[^;]*https?:/.test(text), `CSS remoto: ${label}`);
  if (file.endsWith('.js')) {
    // Parse actual imports: Tailwind Merge contains ordinary strings named
    // "from". A text regex incorrectly treated those strings as module imports.
    const moduleSpecifiers = [];
    const syntax = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function inspectImport(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        assert.ok(ts.isStringLiteral(node.moduleSpecifier), `Import não literal: ${label}`);
        moduleSpecifiers.push(node.moduleSpecifier.text);
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        assert.ok(node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0]), `Import dinâmico não literal: ${label}`);
        moduleSpecifiers.push(node.arguments[0].text);
      }
      ts.forEachChild(node, inspectImport);
    }
    inspectImport(syntax);
    for (const target of moduleSpecifiers) {
      assert.ok(target.startsWith('./') || target.startsWith('../'), `Import externo: ${label}`);
      assert.ok(existsSync(resolve(dirname(file), target)), `Módulo ausente em ${label}: ${target}`);
    }
    // Namespaces DOM, links de erro React e declarações de schema/parser Zod são inertes.
    for (const match of text.matchAll(/https?:\/\/[^\s"'`<>\\)]+/g)) {
      const url = match[0];
      const sdkWorker = /local-worker-/.test(label);
      const inertUrl = /^(?:http:\/\/www\.w3\.org\/|https:\/\/react\.dev\/errors\/)/.test(url)
        || url === 'https://aistudio.google.com/usage'
        || ['http://json-schema.org/draft-04/schema#', 'http://json-schema.org/draft-07/schema#', 'https://json-schema.org/draft/2020-12/schema'].includes(url)
        || /^http:\/\/\[\$\{[a-zA-Z_$][\w$]*\}\]$/.test(url)
        || (sdkWorker && (/^(?:https:\/\/(?:generativelanguage\.googleapis\.com|aiplatform\.|ai\.google\.dev|docs\.cloud\.google\.com)|http:\/\/dummy\.com)/.test(url) || url.includes('aiplatform.googleapis.com')));
      assert.ok(inertUrl, `URL inesperada no bundle: ${label}: ${url.slice(0, 160)}`);
    }
    if (/\bfetch\s*\(|XMLHttpRequest|new WebSocket/.test(text)) assert.ok(/local-worker-/.test(label), `Transporte remoto fora do worker: ${label}`);
  }
  if (root.endsWith('dist')) assert.ok(!/Conversa de exemplo|Este trecho é um exemplo fictício|Simulação de desenvolvimento|Transcrever uma parte de teste|MM_UI_FOUNDATION_PREVIEW_ONLY|Revisar esta base visual/.test(text), `Fixture/controle de teste em produção: ${label}`);
}
if (root.endsWith('dist')) assert.ok(!existsSync(join(root, 'src/design-preview/design-preview.html')), 'Galeria de UI em produção.');
if (root.endsWith('dist')) assert.ok(!files.some(file => /library-fixtures-/.test(file)), 'Fixtures de gerenciamento em produção.');
console.log(`PASS: manifest MV3, ${entries.length} entrypoints, ${files.length} artefatos locais; Gemini restrito ao worker e host específico; sem padrões de secret detectados.`);
