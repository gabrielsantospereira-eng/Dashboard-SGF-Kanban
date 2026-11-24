// Regras de negócio e consultas. Nenhuma regra fica na interface: o servidor valida e decide.
import { SITUACOES } from './db.js';

export class HttpError extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const agora = () => new Date().toISOString();
const diaISO = (diasAtras = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().slice(0, 10);
};

const SELECT_AMOSTRA = `
SELECT a.id, a.codigo, a.observacoes, a.resistencia_mpa AS resistenciaMpa, a.criado_em AS criadoEm,
       a.resultado_em AS resultadoEm, a.decidido_em AS decididoEm, a.justificativa,
       s.descricao AS situacao, l.identificacao AS lote, l.tipo_local AS tipoLocal,
       l.local_descricao AS localDescricao, l.data_concretagem AS data, o.nome AS obra,
       uc.nome AS cadastradoPor, ud.nome AS decididoPor
FROM amostra a
JOIN situacao s ON s.id = a.id_situacao
JOIN lote l ON l.id = a.id_lote
JOIN obra o ON o.id = l.id_obra
JOIN usuario uc ON uc.id = a.criado_por
LEFT JOIN usuario ud ON ud.id = a.decidido_por`;

function formatar(r) {
  if (!r) return null;
  const local = r.tipoLocal === 'Outro' ? r.localDescricao : `${r.tipoLocal} ${r.localDescricao}`;
  return { ...r, local };
}

// ---------- validação ----------
const texto = (v) => (typeof v === 'string' ? v.trim() : '');

function exigir(cond, mensagem, status = 400) {
  if (!cond) throw new HttpError(status, mensagem);
}

function separarLocal(local) {
  const [primeira, ...resto] = local.split(/\s+/);
  const chave = primeira.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const tipos = { pilar: 'Pilar', laje: 'Laje', viga: 'Viga', fundacao: 'Fundação', sapata: 'Fundação', radier: 'Fundação' };
  if (tipos[chave] && resto.length) return { tipo: tipos[chave], descricao: resto.join(' ') };
  return { tipo: 'Outro', descricao: local };
}

// ---------- consultas ----------
export function listarObras(db) {
  return db.prepare('SELECT id, nome FROM obra ORDER BY nome').all();
}

export function criarObra(db, body) {
  const nome = texto(body.nome);
  exigir(nome.length >= 3 && nome.length <= 80, 'Informe o nome da obra (3 a 80 caracteres).');
  exigir(!db.prepare('SELECT 1 FROM obra WHERE nome = ?').get(nome), 'Já existe uma obra com esse nome.', 409);
  const id = db.prepare('INSERT INTO obra (nome) VALUES (?)').run(nome).lastInsertRowid;
  return { id: Number(id), nome };
}

export function obterAmostra(db, id) {
  return formatar(db.prepare(`${SELECT_AMOSTRA} WHERE a.id = ?`).get(id));
}

export function listarAmostras(db, { obra, situacao, q, limite = 200 } = {}) {
  const where = [];
  const params = [];
  if (obra && obra !== 'todas') { where.push('o.nome = ?'); params.push(obra); }
  if (situacao && situacao !== 'todas') { where.push('s.descricao = ?'); params.push(situacao); }
  if (q) {
    where.push('(a.codigo LIKE ? OR l.identificacao LIKE ? OR o.nome LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  const sql = `${SELECT_AMOSTRA} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY a.id DESC LIMIT ?`;
  return db.prepare(sql).all(...params, Math.min(Number(limite) || 200, 500)).map(formatar);
}

export function listarPendentes(db) {
  return db
    .prepare(`${SELECT_AMOSTRA} WHERE s.descricao = 'Pendente de aprovação' ORDER BY a.resultado_em ASC`)
    .all()
    .map(formatar);
}

// ---------- comandos ----------
export function criarAmostra(db, usuario, body) {
  const nomeObra = texto(body.obra);
  const local = texto(body.local);
  const data = texto(body.data);
  const codigo = texto(body.codigo);
  const lote = texto(body.lote);
  const observacoes = texto(body.observacoes);

  exigir(nomeObra, 'Obra é obrigatória.');
  exigir(local, 'Local é obrigatório.');
  exigir(data, 'Data é obrigatória.');
  exigir(codigo, 'Código é obrigatório.');
  exigir(lote, 'Lote é obrigatório.');
  exigir(/^\d{4}-\d{2}-\d{2}$/.test(data) && !Number.isNaN(Date.parse(data)), 'Data inválida (use AAAA-MM-DD).');
  exigir(data <= diaISO(-1), 'A data da concretagem não pode estar no futuro.');
  exigir(/^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(codigo), 'Código inválido (3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado).');
  exigir(/^[A-Za-z0-9][A-Za-z0-9._ -]{0,39}$/.test(lote), 'Lote inválido (até 40 caracteres: letras, números, ponto, hífen ou sublinhado).');
  exigir(local.length >= 2 && local.length <= 60, 'Local deve ter de 2 a 60 caracteres.');
  exigir(observacoes.length <= 500, 'Observações podem ter no máximo 500 caracteres.');

  const obra = db.prepare('SELECT id FROM obra WHERE nome = ?').get(nomeObra);
  exigir(obra, 'Obra não cadastrada.', 400);
  exigir(!db.prepare('SELECT 1 FROM amostra WHERE codigo = ?').get(codigo), 'Já existe uma amostra com esse código.', 409);

  const { tipo, descricao } = separarLocal(local);
  const situacao = db.prepare('SELECT id FROM situacao WHERE descricao = ?').get('Aguardando rompimento').id;

  db.exec('BEGIN');
  try {
    // Regra (hipótese do DER): um lote pertence a uma obra, um local e uma data.
    let l = db.prepare('SELECT id, tipo_local, local_descricao, data_concretagem FROM lote WHERE id_obra = ? AND identificacao = ?').get(obra.id, lote);
    if (l) {
      exigir(
        l.tipo_local === tipo && l.local_descricao === descricao && l.data_concretagem === data,
        'Esse lote já existe nesta obra com outro local ou outra data.',
        409,
      );
    } else {
      l = {
        id: db
          .prepare('INSERT INTO lote (identificacao, id_obra, tipo_local, local_descricao, data_concretagem) VALUES (?,?,?,?,?)')
          .run(lote, obra.id, tipo, descricao, data).lastInsertRowid,
      };
    }
    const id = db
      .prepare('INSERT INTO amostra (codigo, id_lote, id_situacao, observacoes, criado_por, criado_em) VALUES (?,?,?,?,?,?)')
      .run(codigo, l.id, situacao, observacoes || null, usuario.id, agora()).lastInsertRowid;
    db.exec('COMMIT');
    return obterAmostra(db, Number(id));
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function carregar(db, id) {
  const a = obterAmostra(db, id);
  exigir(a, 'Amostra não encontrada.', 404);
  return a;
}

export function registrarResultado(db, usuario, id, body) {
  const a = carregar(db, id);
  exigir(a.situacao === 'Aguardando rompimento', 'O resultado só pode ser registrado para amostra aguardando rompimento.', 409);
  const mpa = Number(body.resistenciaMpa);
  exigir(Number.isFinite(mpa) && mpa > 0 && mpa <= 150, 'Informe a resistência em MPa (maior que 0 e até 150).');
  const pendente = db.prepare('SELECT id FROM situacao WHERE descricao = ?').get('Pendente de aprovação').id;
  db.prepare('UPDATE amostra SET resistencia_mpa = ?, resultado_por = ?, resultado_em = ?, id_situacao = ? WHERE id = ?')
    .run(mpa, usuario.id, agora(), pendente, id);
  return obterAmostra(db, id);
}

export function decidir(db, usuario, id, aprovar, body) {
  const a = carregar(db, id);
  exigir(a.situacao === 'Pendente de aprovação', 'Só é possível decidir amostras pendentes de aprovação.', 409);
  const justificativa = texto(body.justificativa);
  if (!aprovar) exigir(justificativa.length >= 5, 'Informe a justificativa da reprovação (mínimo de 5 caracteres).');
  exigir(justificativa.length <= 500, 'A justificativa pode ter no máximo 500 caracteres.');
  const nova = db.prepare('SELECT id FROM situacao WHERE descricao = ?').get(aprovar ? 'Aprovada' : 'Reprovada').id;
  db.prepare('UPDATE amostra SET id_situacao = ?, decidido_por = ?, decidido_em = ?, justificativa = ? WHERE id = ?')
    .run(nova, usuario.id, agora(), justificativa || null, id);
  return obterAmostra(db, id);
}

// ---------- dashboard: tudo calculado a partir dos registros ----------
const PLURAL = { Pilar: 'Pilares', Laje: 'Lajes', Viga: 'Vigas', Fundação: 'Fundação', Outro: 'Outros' };
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function dashboard(db, { obra, periodo } = {}) {
  const dias = [7, 30, 90].includes(Number(periodo)) ? Number(periodo) : 30;
  const desde = diaISO(dias - 1);
  const where = ['l.data_concretagem >= ?'];
  const params = [desde];
  if (obra && obra !== 'todas') { where.push('o.nome = ?'); params.push(obra); }
  const base = `FROM amostra a JOIN lote l ON l.id = a.id_lote JOIN obra o ON o.id = l.id_obra JOIN situacao s ON s.id = a.id_situacao WHERE ${where.join(' AND ')}`;

  const porSituacaoBruto = Object.fromEntries(
    db.prepare(`SELECT s.descricao AS nome, COUNT(*) AS qtd ${base} GROUP BY s.descricao`).all(...params).map((r) => [r.nome, r.qtd]),
  );
  const porSituacao = SITUACOES.map((nome) => ({ nome, qtd: porSituacaoBruto[nome] || 0 }));
  const total = porSituacao.reduce((s, x) => s + x.qtd, 0);

  const limiteNovas = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const novas = db.prepare(`SELECT COUNT(*) AS n ${base} AND a.criado_em >= ?`).get(...params, limiteNovas).n;

  const porDiaBruto = Object.fromEntries(
    db.prepare(`SELECT l.data_concretagem AS dia, COUNT(*) AS qtd ${base} GROUP BY l.data_concretagem`).all(...params).map((r) => [r.dia, r.qtd]),
  );
  const todosDias = Array.from({ length: dias }, (_, i) => diaISO(dias - 1 - i));
  let porDia;
  if (dias <= 30) {
    porDia = todosDias.map((d) => ({ dia: ddmm(d), qtd: porDiaBruto[d] || 0 }));
  } else {
    porDia = [];
    for (let i = 0; i < todosDias.length; i += 7) {
      const grupo = todosDias.slice(i, i + 7);
      porDia.push({ dia: ddmm(grupo[0]), qtd: grupo.reduce((s, d) => s + (porDiaBruto[d] || 0), 0) });
    }
  }

  const porLocal = db
    .prepare(`SELECT l.tipo_local AS tipo, COUNT(*) AS qtd ${base} GROUP BY l.tipo_local ORDER BY qtd DESC`)
    .all(...params)
    .map((r) => ({ nome: PLURAL[r.tipo] || r.tipo, qtd: r.qtd }));
  const porObra = db.prepare(`SELECT o.nome AS nome, COUNT(*) AS qtd ${base} GROUP BY o.nome ORDER BY qtd DESC`).all(...params);
  const recentes = db.prepare(`${SELECT_AMOSTRA} WHERE a.id IN (SELECT a.id ${base}) ORDER BY a.id DESC LIMIT 3`).all(...params).map(formatar);

  return {
    filtro: { obra: obra || 'todas', periodo: dias },
    cards: {
      total,
      aguardando: porSituacaoBruto['Aguardando rompimento'] || 0,
      pendentes: porSituacaoBruto['Pendente de aprovação'] || 0,
      aprovadas: porSituacaoBruto['Aprovada'] || 0,
      reprovadas: porSituacaoBruto['Reprovada'] || 0,
      novas,
    },
    porDia, porSituacao, porLocal, porObra, recentes,
  };
}
