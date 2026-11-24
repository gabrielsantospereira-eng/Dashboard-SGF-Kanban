// Autenticação sem dependências externas: senha com scrypt e token assinado com HMAC-SHA256.
import crypto from 'node:crypto';

const SEGREDO = process.env.SGF_SEGREDO || 'segredo-de-desenvolvimento-troque-em-producao';
if (!process.env.SGF_SEGREDO) {
  console.warn('[aviso] SGF_SEGREDO não definido: usando segredo de desenvolvimento. Defina a variável em produção.');
}
const VALIDADE_MS = 8 * 60 * 60 * 1000; // 8 horas

export function hashSenha(senha) {
  const sal = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(senha, sal, 64).toString('hex');
  return `${sal}:${hash}`;
}

// Sempre executa o scrypt, mesmo para usuário inexistente, para não revelar se o e-mail existe pelo tempo de resposta.
const HASH_FALSO = hashSenha('senha-falsa-para-igualar-tempo');
export function conferirSenha(senha, armazenado) {
  const [sal, hash] = (armazenado || HASH_FALSO).split(':');
  const calculado = crypto.scryptSync(String(senha), sal, 64);
  const esperado = Buffer.from(hash, 'hex');
  const ok = crypto.timingSafeEqual(calculado, esperado);
  return ok && Boolean(armazenado);
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const assinar = (dados) => crypto.createHmac('sha256', SEGREDO).update(dados).digest('base64url');

export function gerarToken(idUsuario) {
  const corpo = b64({ sub: idUsuario, exp: Date.now() + VALIDADE_MS });
  return `${corpo}.${assinar(corpo)}`;
}

export function lerToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [corpo, assinatura] = token.split('.');
  const esperada = assinar(corpo);
  const a = Buffer.from(assinatura || '');
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!dados.exp || dados.exp < Date.now()) return null;
    return dados;
  } catch {
    return null;
  }
}
