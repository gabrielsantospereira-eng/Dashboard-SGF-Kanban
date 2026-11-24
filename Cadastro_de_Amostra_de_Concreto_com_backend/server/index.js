// API HTTP sem framework. Inicie com: node server/index.js  (porta 3001, ou a definida em PORT)
import http from 'node:http';
import { abrirBanco } from './db.js';
import { conferirSenha, gerarToken, lerToken } from './auth.js';
import * as svc from './service.js';
import { HttpError } from './service.js';

const PERFIL_ROTULO = { fiscal: 'Fiscal de obra', gestor: 'Gestor', responsavel_tecnico: 'Responsável técnico' };

export function criarServidor(db) {
  const tentativas = new Map(); // limite simples de tentativas de login por IP + e-mail
  const bloqueado = (chave) => {
    const agora = Date.now();
    const lista = (tentativas.get(chave) || []).filter((t) => agora - t < 60_000);
    tentativas.set(chave, lista);
    return lista.length >= 8;
  };
  const registrarFalha = (chave) => tentativas.set(chave, [...(tentativas.get(chave) || []), Date.now()]);

  // [método, padrão, perfis permitidos (null = qualquer logado, 'publico' = sem login), função]
  const rotas = [
    ['POST', /^\/api\/login$/, 'publico', (c) => {
      const email = String(c.body.email || '').trim().toLowerCase();
      const chave = `${c.ip}|${email}`;
      if (bloqueado(chave)) throw new HttpError(429, 'Muitas tentativas. Aguarde um minuto.');
      const u = db.prepare('SELECT * FROM usuario WHERE email = ?').get(email);
      if (!conferirSenha(String(c.body.senha || ''), u?.senha_hash)) {
        registrarFalha(chave);
        throw new HttpError(401, 'E-mail ou senha inválidos.');
      }
      return { token: gerarToken(u.id), usuario: publico(u) };
    }],
    ['GET', /^\/api\/me$/, null, (c) => ({ usuario: publico(c.usuario) })],
    ['GET', /^\/api\/obras$/, null, () => svc.listarObras(db)],
    ['POST', /^\/api\/obras$/, ['gestor', 'responsavel_tecnico'], (c) => [201, svc.criarObra(db, c.body)]],
    ['GET', /^\/api\/dashboard$/, null, (c) => svc.dashboard(db, { obra: c.query.get('obra'), periodo: c.query.get('periodo') })],
    ['GET', /^\/api\/amostras$/, null, (c) => svc.listarAmostras(db, {
      obra: c.query.get('obra'), situacao: c.query.get('situacao'), q: c.query.get('q'),
    })],
    ['POST', /^\/api\/amostras$/, ['fiscal', 'responsavel_tecnico'], (c) => [201, svc.criarAmostra(db, c.usuario, c.body)]],
    ['GET', /^\/api\/amostras\/pendentes$/, ['responsavel_tecnico'], () => svc.listarPendentes(db)],
    ['GET', /^\/api\/amostras\/(\d+)$/, null, (c) => {
      const a = svc.obterAmostra(db, Number(c.params[0]));
      if (!a) throw new HttpError(404, 'Amostra não encontrada.');
      return a;
    }],
    ['POST', /^\/api\/amostras\/(\d+)\/resultado$/, ['fiscal', 'responsavel_tecnico'], (c) => svc.registrarResultado(db, c.usuario, Number(c.params[0]), c.body)],
    ['POST', /^\/api\/amostras\/(\d+)\/aprovar$/, ['responsavel_tecnico'], (c) => svc.decidir(db, c.usuario, Number(c.params[0]), true, c.body)],
    ['POST', /^\/api\/amostras\/(\d+)\/reprovar$/, ['responsavel_tecnico'], (c) => svc.decidir(db, c.usuario, Number(c.params[0]), false, c.body)],
  ];

  function publico(u) {
    return { id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, perfilRotulo: PERFIL_ROTULO[u.perfil] };
  }

  async function lerCorpo(req) {
    const partes = [];
    let tamanho = 0;
    for await (const parte of req) {
      tamanho += parte.length;
      if (tamanho > 1_000_000) throw new HttpError(413, 'Corpo da requisição grande demais.');
      partes.push(parte);
    }
    if (!partes.length) return {};
    try {
      const v = JSON.parse(Buffer.concat(partes).toString());
      return v && typeof v === 'object' ? v : {};
    } catch {
      throw new HttpError(400, 'JSON inválido.');
    }
  }

  return http.createServer(async (req, res) => {
    const enviar = (status, corpo) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': process.env.SGF_CORS || 'http://localhost:5173',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      });
      res.end(JSON.stringify(corpo));
    };
    try {
      if (req.method === 'OPTIONS') return enviar(204, {});
      const url = new URL(req.url, 'http://localhost');
      const rota = rotas.find(([m, re]) => m === req.method && re.test(url.pathname));
      if (!rota) {
        const existe = rotas.some(([, re]) => re.test(url.pathname));
        throw new HttpError(existe ? 405 : 404, existe ? 'Método não permitido.' : 'Rota não encontrada.');
      }
      const [, re, perfis, funcao] = rota;
      const ctx = {
        query: url.searchParams,
        params: url.pathname.match(re).slice(1),
        ip: req.socket.remoteAddress,
        body: req.method === 'POST' ? await lerCorpo(req) : {},
        usuario: null,
      };
      if (perfis !== 'publico') {
        const cab = req.headers.authorization || '';
        const dados = lerToken(cab.startsWith('Bearer ') ? cab.slice(7) : '');
        const u = dados && db.prepare('SELECT * FROM usuario WHERE id = ?').get(dados.sub);
        if (!u) throw new HttpError(401, 'Sessão inválida ou expirada. Entre novamente.');
        if (perfis && !perfis.includes(u.perfil)) throw new HttpError(403, 'Seu perfil não tem permissão para esta ação.');
        ctx.usuario = u;
      }
      const resultado = funcao(ctx);
      if (Array.isArray(resultado) && typeof resultado[0] === 'number') return enviar(resultado[0], resultado[1]);
      return enviar(200, resultado);
    } catch (e) {
      if (e instanceof HttpError) return enviar(e.status, { erro: e.message });
      console.error(e);
      return enviar(500, { erro: 'Erro interno do servidor.' });
    }
  });
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const porta = Number(process.env.PORT) || 3001;
  const db = abrirBanco();
  criarServidor(db).listen(porta, () => console.log(`API do SGF em http://localhost:${porta}`));
}
