// Testes de integração: node --test server/test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco } from './db.js';
import { criarServidor } from './index.js';

const db = abrirBanco(':memory:');
const servidor = criarServidor(db);
await new Promise((r) => servidor.listen(0, r));
const base = `http://localhost:${servidor.address().port}`;

async function api(metodo, caminho, { token, corpo } = {}) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, dados: await r.json() };
}
const login = async (email, senha) => (await api('POST', '/api/login', { corpo: { email, senha } })).dados.token;

const fiscal = await login('fiscal@sgf.com', 'fiscal123');
const gestor = await login('gestor@sgf.com', 'gestor123');
const rt = await login('rt@sgf.com', 'rt123');
const hoje = new Date().toISOString().slice(0, 10);
const nova = (extra = {}) => ({ obra: 'Edifício Alfa', local: 'Pilar P99', data: hoje, codigo: 'AM-TESTE-001', lote: 'LOTE-T1', observacoes: '', ...extra });

test.after(() => servidor.close());

test('login e sessão', async () => {
  assert.ok(fiscal && gestor && rt);
  assert.equal((await api('POST', '/api/login', { corpo: { email: 'fiscal@sgf.com', senha: 'errada' } })).status, 401);
  assert.equal((await api('POST', '/api/login', { corpo: { email: 'naoexiste@sgf.com', senha: 'x' } })).status, 401);
  assert.equal((await api('GET', '/api/amostras')).status, 401);
  assert.equal((await api('GET', '/api/amostras', { token: 'lixo.lixo' })).status, 401);
  const me = await api('GET', '/api/me', { token: rt });
  assert.equal(me.dados.usuario.perfil, 'responsavel_tecnico');
  assert.equal(me.dados.usuario.senha_hash, undefined);
});

test('cadastro valida e persiste, e o dashboard atualiza', async () => {
  const antes = (await api('GET', '/api/dashboard?periodo=30', { token: gestor })).dados;
  const r = await api('POST', '/api/amostras', { token: fiscal, corpo: nova() });
  assert.equal(r.status, 201);
  assert.equal(r.dados.situacao, 'Aguardando rompimento');
  assert.equal(r.dados.local, 'Pilar P99');
  const depois = (await api('GET', '/api/dashboard?periodo=30', { token: gestor })).dados;
  assert.equal(depois.cards.total, antes.cards.total + 1);
  assert.equal(depois.cards.aguardando, antes.cards.aguardando + 1);
  assert.equal(depois.cards.novas, antes.cards.novas + 1);
  const lista = (await api('GET', '/api/amostras?q=AM-TESTE-001', { token: gestor })).dados;
  assert.equal(lista.length, 1);
});

test('rejeita dados inválidos', async () => {
  const t = (corpo) => api('POST', '/api/amostras', { token: fiscal, corpo });
  assert.equal((await t(nova({ codigo: 'AM-TESTE-001' }))).status, 409, 'código duplicado');
  assert.equal((await t(nova({ codigo: 'X-1', obra: '' }))).status, 400, 'obra vazia');
  assert.equal((await t(nova({ codigo: 'AM-NOVO-2', obra: 'Obra Fantasma' }))).status, 400, 'obra inexistente');
  assert.equal((await t(nova({ codigo: 'AM-NOVO-3', data: '2999-01-01' }))).status, 400, 'data futura');
  assert.equal((await t(nova({ codigo: 'AM-NOVO-4', data: '31/12/2026' }))).status, 400, 'data em formato errado');
  assert.equal((await t(nova({ codigo: "AM'; DROP TABLE amostra;--" }))).status, 400, 'código com caracteres perigosos');
  assert.equal((await t(nova({ codigo: 'AM-NOVO-5', lote: 'LOTE-T1', local: 'Viga V1' }))).status, 409, 'lote com outro local');
  assert.equal((await t(nova({ codigo: 'AM-NOVO-6', lote: 'LOTE-T1' }))).status, 201, 'mesmo lote, mesmo local e data');
});

test('permissões por perfil', async () => {
  assert.equal((await api('POST', '/api/amostras', { token: gestor, corpo: nova({ codigo: 'AM-G-1' }) })).status, 403);
  assert.equal((await api('GET', '/api/amostras/pendentes', { token: fiscal })).status, 403);
  assert.equal((await api('GET', '/api/amostras/pendentes', { token: gestor })).status, 403);
  assert.equal((await api('GET', '/api/amostras/pendentes', { token: rt })).status, 200);
});

test('fluxo de aprovação: só o responsável técnico decide', async () => {
  const criada = (await api('POST', '/api/amostras', { token: fiscal, corpo: nova({ codigo: 'AM-FLUXO-1', lote: 'LOTE-F1' }) })).dados;
  const id = criada.id;
  // não dá para aprovar antes do resultado
  assert.equal((await api('POST', `/api/amostras/${id}/aprovar`, { token: rt })).status, 409);
  // resultado inválido
  assert.equal((await api('POST', `/api/amostras/${id}/resultado`, { token: fiscal, corpo: { resistenciaMpa: -3 } })).status, 400);
  assert.equal((await api('POST', `/api/amostras/${id}/resultado`, { token: gestor, corpo: { resistenciaMpa: 30 } })).status, 403);
  const res = await api('POST', `/api/amostras/${id}/resultado`, { token: fiscal, corpo: { resistenciaMpa: 30.5 } });
  assert.equal(res.status, 200);
  assert.equal(res.dados.situacao, 'Pendente de aprovação');
  const pend = (await api('GET', '/api/amostras/pendentes', { token: rt })).dados;
  assert.ok(pend.some((a) => a.id === id));
  // quem não tem o cargo não aprova nem reprova
  for (const t of [fiscal, gestor]) {
    assert.equal((await api('POST', `/api/amostras/${id}/aprovar`, { token: t })).status, 403);
    assert.equal((await api('POST', `/api/amostras/${id}/reprovar`, { token: t, corpo: { justificativa: 'não pode' } })).status, 403);
  }
  assert.equal((await api('POST', `/api/amostras/${id}/reprovar`, { token: rt, corpo: {} })).status, 400, 'reprovar exige justificativa');
  const ok = await api('POST', `/api/amostras/${id}/aprovar`, { token: rt });
  assert.equal(ok.status, 200);
  assert.equal(ok.dados.situacao, 'Aprovada');
  assert.equal(ok.dados.decididoPor, 'Rita Responsável Técnica');
  assert.equal((await api('POST', `/api/amostras/${id}/reprovar`, { token: rt, corpo: { justificativa: 'tarde demais' } })).status, 409, 'não decide duas vezes');
  // reprovação com justificativa
  const outra = (await api('POST', '/api/amostras', { token: fiscal, corpo: nova({ codigo: 'AM-FLUXO-2', lote: 'LOTE-F2' }) })).dados.id;
  await api('POST', `/api/amostras/${outra}/resultado`, { token: fiscal, corpo: { resistenciaMpa: 12 } });
  const rep = await api('POST', `/api/amostras/${outra}/reprovar`, { token: rt, corpo: { justificativa: 'Resistência abaixo do especificado' } });
  assert.equal(rep.dados.situacao, 'Reprovada');
});

test('dashboard é coerente: todos os agrupamentos somam o total', async () => {
  for (const periodo of [7, 30, 90]) {
    for (const obra of ['todas', 'Edifício Alfa']) {
      const d = (await api('GET', `/api/dashboard?periodo=${periodo}&obra=${encodeURIComponent(obra)}`, { token: gestor })).dados;
      const soma = (l) => l.reduce((s, x) => s + x.qtd, 0);
      assert.equal(soma(d.porSituacao), d.cards.total, `situação ${periodo}/${obra}`);
      assert.equal(soma(d.porObra), d.cards.total, `obra ${periodo}/${obra}`);
      assert.equal(soma(d.porLocal), d.cards.total, `local ${periodo}/${obra}`);
      assert.equal(soma(d.porDia), d.cards.total, `dia ${periodo}/${obra}`);
      assert.equal(d.cards.aguardando + d.cards.pendentes + d.cards.aprovadas + d.cards.reprovadas, d.cards.total);
    }
  }
  const alfa = (await api('GET', '/api/dashboard?obra=Edif%C3%ADcio%20Alfa', { token: gestor })).dados;
  assert.ok(alfa.porObra.every((o) => o.nome === 'Edifício Alfa'));
});

test('filtros da lista e obra nova', async () => {
  const aprov = (await api('GET', '/api/amostras?situacao=Aprovada', { token: gestor })).dados;
  assert.ok(aprov.length > 0 && aprov.every((a) => a.situacao === 'Aprovada'));
  assert.equal((await api('POST', '/api/obras', { token: fiscal, corpo: { nome: 'Obra Nova' } })).status, 403);
  assert.equal((await api('POST', '/api/obras', { token: gestor, corpo: { nome: 'Obra Nova' } })).status, 201);
  assert.equal((await api('POST', '/api/obras', { token: gestor, corpo: { nome: 'Obra Nova' } })).status, 409);
  assert.equal((await api('GET', '/api/inexistente', { token: gestor })).status, 404);
});
