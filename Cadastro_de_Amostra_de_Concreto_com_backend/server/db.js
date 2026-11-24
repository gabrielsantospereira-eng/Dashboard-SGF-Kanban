// Banco SQLite (módulo nativo do Node 22.13+) com o modelo do DER: OBRA, LOTE, AMOSTRA, SITUACAO (+ USUARIO).
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { hashSenha } from './auth.js';

export const SITUACOES = ['Aguardando rompimento', 'Pendente de aprovação', 'Aprovada', 'Reprovada'];
export const PERFIS = ['fiscal', 'gestor', 'responsavel_tecnico'];

const ESQUEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS usuario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('fiscal','gestor','responsavel_tecnico'))
);
CREATE TABLE IF NOT EXISTS obra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS situacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS lote (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identificacao TEXT NOT NULL,
  id_obra INTEGER NOT NULL REFERENCES obra(id),
  tipo_local TEXT NOT NULL,
  local_descricao TEXT NOT NULL,
  data_concretagem TEXT NOT NULL,
  UNIQUE (id_obra, identificacao)
);
CREATE TABLE IF NOT EXISTS amostra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE,
  id_lote INTEGER NOT NULL REFERENCES lote(id),
  id_situacao INTEGER NOT NULL REFERENCES situacao(id),
  observacoes TEXT,
  criado_por INTEGER NOT NULL REFERENCES usuario(id),
  criado_em TEXT NOT NULL,
  resistencia_mpa REAL,
  resultado_por INTEGER REFERENCES usuario(id),
  resultado_em TEXT,
  decidido_por INTEGER REFERENCES usuario(id),
  decidido_em TEXT,
  justificativa TEXT
);
CREATE INDEX IF NOT EXISTS idx_amostra_situacao ON amostra(id_situacao);
CREATE INDEX IF NOT EXISTS idx_lote_data ON lote(data_concretagem);
`;

export function abrirBanco(caminho = process.env.SGF_DB || fileURLToPath(new URL('./sgf.db', import.meta.url))) {
  const db = new DatabaseSync(caminho);
  db.exec(ESQUEMA);
  for (const s of SITUACOES) db.prepare('INSERT OR IGNORE INTO situacao (descricao) VALUES (?)').run(s);
  if (db.prepare('SELECT COUNT(*) AS n FROM usuario').get().n === 0) semear(db);
  return db;
}

const isoDia = (diasAtras) => {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().slice(0, 10);
};

// Dados de demonstração (só quando o banco está vazio). Desative com SGF_SEED=0.
function semear(db) {
  const usuarios = [
    ['Fernanda Fiscal', 'fiscal@sgf.com', 'fiscal123', 'fiscal'],
    ['Gustavo Gestor', 'gestor@sgf.com', 'gestor123', 'gestor'],
    ['Rita Responsável Técnica', 'rt@sgf.com', 'rt123', 'responsavel_tecnico'],
  ];
  for (const [nome, email, senha, perfil] of usuarios) {
    db.prepare('INSERT INTO usuario (nome, email, senha_hash, perfil) VALUES (?,?,?,?)').run(nome, email, hashSenha(senha), perfil);
  }
  const obras = ['Edifício Alfa', 'Residencial Beta', 'Condomínio Gamma', 'Torre Delta', 'Shopping Épsilon'];
  for (const o of obras) db.prepare('INSERT INTO obra (nome) VALUES (?)').run(o);
  if (process.env.SGF_SEED === '0') return;

  const sit = Object.fromEntries(db.prepare('SELECT id, descricao FROM situacao').all().map((r) => [r.descricao, r.id]));
  const obra = Object.fromEntries(db.prepare('SELECT id, nome FROM obra').all().map((r) => [r.nome, r.id]));
  const fiscal = db.prepare("SELECT id FROM usuario WHERE perfil='fiscal'").get().id;
  const rt = db.prepare("SELECT id FROM usuario WHERE perfil='responsavel_tecnico'").get().id;

  // [obra, tipo, descrição, diasAtrás, situação, resistência]
  const exemplos = [
    ['Edifício Alfa', 'Pilar', 'P12', 0, 'Aguardando rompimento', null],
    ['Edifício Alfa', 'Laje', 'L03', 1, 'Aguardando rompimento', null],
    ['Residencial Beta', 'Viga', 'V05', 1, 'Aguardando rompimento', null],
    ['Edifício Alfa', 'Pilar', 'P08', 2, 'Pendente de aprovação', 31.2],
    ['Condomínio Gamma', 'Fundação', 'F02', 3, 'Pendente de aprovação', 28.4],
    ['Torre Delta', 'Laje', 'L11', 3, 'Aprovada', 35.8],
    ['Edifício Alfa', 'Viga', 'V02', 4, 'Aprovada', 33.1],
    ['Residencial Beta', 'Pilar', 'P03', 5, 'Reprovada', 19.6],
    ['Shopping Épsilon', 'Laje', 'L21', 5, 'Aprovada', 36.4],
    ['Torre Delta', 'Pilar', 'P15', 6, 'Aguardando rompimento', null],
    ['Condomínio Gamma', 'Viga', 'V09', 6, 'Aprovada', 32.7],
    ['Edifício Alfa', 'Fundação', 'F01', 7, 'Aprovada', 34.0],
  ];
  exemplos.forEach(([nomeObra, tipo, desc, dias, situ, mpa], i) => {
    const n = String(i + 1).padStart(3, '0');
    const data = isoDia(dias);
    const lote = db
      .prepare('INSERT INTO lote (identificacao, id_obra, tipo_local, local_descricao, data_concretagem) VALUES (?,?,?,?,?)')
      .run(`LOTE-${n}`, obra[nomeObra], tipo, desc, data).lastInsertRowid;
    const criado = `${data}T12:00:00.000Z`;
    const resultado = mpa ? criado : null;
    const decidido = situ === 'Aprovada' || situ === 'Reprovada' ? criado : null;
    db.prepare(
      `INSERT INTO amostra (codigo, id_lote, id_situacao, observacoes, criado_por, criado_em, resistencia_mpa, resultado_por, resultado_em, decidido_por, decidido_em, justificativa)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      `AM-2026-${n}`, lote, sit[situ], null, fiscal, criado, mpa, mpa ? fiscal : null, resultado,
      decidido ? rt : null, decidido, situ === 'Reprovada' ? 'Resistência abaixo da especificada.' : null,
    );
  });
}
