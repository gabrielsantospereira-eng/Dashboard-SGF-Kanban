// Cliente da API do SGF. Em desenvolvimento o Vite encaminha /api para o servidor (veja vite.config.ts).
const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;
const TOKEN_KEY = "sgf_token";

export type Perfil = "fiscal" | "gestor" | "responsavel_tecnico";
export type Situacao = "Aguardando rompimento" | "Pendente de aprovação" | "Aprovada" | "Reprovada";
export const SITUACOES: Situacao[] = ["Aguardando rompimento", "Pendente de aprovação", "Aprovada", "Reprovada"];

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  perfilRotulo: string;
}

export interface Amostra {
  id: number;
  codigo: string;
  obra: string;
  local: string;
  lote: string;
  data: string; // AAAA-MM-DD
  situacao: Situacao;
  observacoes: string | null;
  resistenciaMpa: number | null;
  cadastradoPor: string;
  criadoEm: string;
  resultadoEm: string | null;
  decididoPor: string | null;
  decididoEm: string | null;
  justificativa: string | null;
}

export interface Contagem {
  nome: string;
  qtd: number;
}

export interface Dashboard {
  cards: { total: number; aguardando: number; pendentes: number; aprovadas: number; reprovadas: number; novas: number };
  porDia: { dia: string; qtd: number }[];
  porSituacao: Contagem[];
  porLocal: Contagem[];
  porObra: Contagem[];
  recentes: Amostra[];
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let aoExpirar: (() => void) | null = null;
export const definirAoExpirar = (fn: (() => void) | null) => {
  aoExpirar = fn;
};

async function req<T>(metodo: "GET" | "POST", caminho: string, corpo?: unknown): Promise<T> {
  const token = getToken();
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      method: metodo,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ApiError(0, "Não foi possível conectar ao servidor. Verifique se a API está rodando.");
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    if (resposta.status === 401 && token && caminho !== "/login") {
      setToken(null);
      aoExpirar?.();
    }
    throw new ApiError(resposta.status, dados.erro ?? "Erro inesperado.");
  }
  return dados as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== "" && p.set(k, String(v)));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  login: (email: string, senha: string) => req<{ token: string; usuario: Usuario }>("POST", "/login", { email, senha }),
  me: () => req<{ usuario: Usuario }>("GET", "/me"),
  obras: () => req<{ id: number; nome: string }[]>("GET", "/obras"),
  dashboard: (obra: string, periodo: number) =>
    req<Dashboard>("GET", `/dashboard${qs({ obra: obra === "Todas as obras" ? "" : obra, periodo })}`),
  amostras: (f: { obra?: string; situacao?: string; q?: string }) => req<Amostra[]>("GET", `/amostras${qs(f)}`),
  pendentes: () => req<Amostra[]>("GET", "/amostras/pendentes"),
  criar: (d: { obra: string; local: string; data: string; codigo: string; lote: string; observacoes: string }) =>
    req<Amostra>("POST", "/amostras", d),
  registrarResultado: (id: number, resistenciaMpa: number) =>
    req<Amostra>("POST", `/amostras/${id}/resultado`, { resistenciaMpa }),
  aprovar: (id: number) => req<Amostra>("POST", `/amostras/${id}/aprovar`, {}),
  reprovar: (id: number, justificativa: string) => req<Amostra>("POST", `/amostras/${id}/reprovar`, { justificativa }),
};

export const formatarData = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
export const formatarMpa = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MPa`;
