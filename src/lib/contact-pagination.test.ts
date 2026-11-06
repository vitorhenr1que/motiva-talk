import assert from 'node:assert/strict';
import test from 'node:test';
import { buildContactPage, decodeContactCursor, encodeContactCursor, escapeContactSearch, normalizeContactSearch } from './contact-pagination';

test('busca exige dois caracteres e limpar restaura a chave normal', () => {
  for (const input of ['', ' ', ' a ']) assert.equal(normalizeContactSearch(input), '');
  assert.equal(normalizeContactSearch('  Ana  '), 'Ana');
});

test('cursor preserva nomes repetidos, acentos e caracteres de filtros', () => {
  const cursor = { name: 'João "Silva", (A) \\', id: 'contact-30', search: 'Jo' };
  assert.deepEqual(decodeContactCursor(encodeContactCursor(cursor), 'Jo'), cursor);
});

test('recusa cursor inválido, incompleto e de outra pesquisa', () => {
  for (const cursor of ['', 'not+base64', 'e30', 'a'.repeat(16385)]) {
    assert.throws(() => decodeContactCursor(cursor, ''));
  }
  assert.throws(() => decodeContactCursor(encodeContactCursor({ name: 'Ana', id: '1', search: 'An' }), 'Jo'));
});

test('retorna 30 registros e o cursor do último exibido, sem consumir o lookahead', () => {
  const rows = Array.from({ length: 31 }, (_, i) => ({ id: String(i), name: 'Ana', phone: '5511999999999' }));
  const page = buildContactPage(rows, 'An');
  assert.equal(page.data.length, 30);
  assert.deepEqual(decodeContactCursor(page.nextCursor!, 'An'), { name: 'Ana', id: '29', search: 'An' });
  assert.equal(page.data.some(row => row.id === '30'), false);
});

test('lista vazia, página incompleta e exatamente 30 contatos encerram sem outra consulta', () => {
  for (const length of [0, 1, 29, 30]) {
    const rows = Array.from({ length }, (_, i) => ({ id: String(i), name: 'Ana', phone: '' }));
    assert.equal(buildContactPage(rows, '').nextCursor, null);
  }
});

test('porcentagem, sublinhado e barra são literais no ILIKE', () => {
  assert.equal(escapeContactSearch('50%_\\'), '50\\%\\_\\\\');
  assert.equal(escapeContactSearch("D'Ávila, (Ana)"), "D'Ávila, (Ana)");
});
