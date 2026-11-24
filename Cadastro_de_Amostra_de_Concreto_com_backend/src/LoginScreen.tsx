import { useState } from "react";
import { api, setToken, type Usuario } from "./api";

export default function LoginScreen({ onLogin }: { onLogin: (u: Usuario) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    setEnviando(true);
    try {
      const r = await api.login(email, senha);
      setToken(r.token);
      onLogin(r.usuario);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao entrar.");
    } finally {
      setEnviando(false);
    }
  };

  const campo =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4" style={{ fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={entrar} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="text-center mb-2">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e40af] text-white">
            <span className="text-sm font-extrabold">SGF</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800" style={{ fontFamily: "'Work Sans', sans-serif" }}>
            Qualidade do Concreto
          </h1>
          <p className="text-xs text-slate-500 mt-1">Entre para continuar</p>
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">E-mail</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} required />
        </div>
        <div>
          <label htmlFor="senha" className="block text-sm font-semibold text-slate-700 mb-1.5">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} required />
        </div>
        {erro && <p role="alert" className="text-red-600 text-sm">{erro}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-xl bg-[#1e40af] text-white py-3.5 font-bold text-sm disabled:opacity-60"
        >
          {enviando ? "Entrando..." : "Entrar"}
        </button>
        {import.meta.env.DEV && (
          <p className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-100 pt-3">
            Contas de demonstração (somente desenvolvimento): fiscal@sgf.com / fiscal123, gestor@sgf.com / gestor123, rt@sgf.com / rt123.
          </p>
        )}
      </form>
    </div>
  );
}
