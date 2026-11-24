import { useCallback, useEffect, useState } from "react";
import { api, formatarData, formatarMpa, type Amostra } from "./api";

function Cartao({ a, onDecidido }: { a: Amostra; onDecidido: () => void }) {
  const [reprovando, setReprovando] = useState(false);
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  const decidir = async (aprovar: boolean) => {
    setErro("");
    setEnviando(true);
    try {
      if (aprovar) await api.aprovar(a.id);
      else await api.reprovar(a.id, justificativa);
      onDecidido();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar a decisão.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-4 space-y-3" data-testid="cartao-pendente">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-slate-800 text-base" style={{ fontFamily: "monospace" }}>{a.codigo}</p>
          <p className="text-xs text-blue-600 font-semibold mt-0.5">{a.obra}</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
          Pendente de aprovação
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
        <dt>Local</dt><dd className="text-slate-800 font-semibold text-right">{a.local}</dd>
        <dt>Lote</dt><dd className="text-slate-800 font-semibold text-right">{a.lote}</dd>
        <dt>Concretagem</dt><dd className="text-slate-800 font-semibold text-right">{formatarData(a.data)}</dd>
        <dt>Resistência</dt>
        <dd className="text-slate-800 font-semibold text-right">{a.resistenciaMpa !== null ? formatarMpa(a.resistenciaMpa) : "—"}</dd>
        <dt>Cadastrada por</dt><dd className="text-slate-800 font-semibold text-right">{a.cadastradoPor}</dd>
      </dl>
      {a.observacoes && <p className="text-xs text-slate-500">Observações: {a.observacoes}</p>}

      {reprovando && (
        <div>
          <label htmlFor={`just-${a.id}`} className="block text-xs font-semibold text-slate-700 mb-1">Justificativa da reprovação</label>
          <textarea
            id={`just-${a.id}`}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
      )}
      {erro && <p role="alert" className="text-red-600 text-xs">{erro}</p>}

      <div className="flex gap-2">
        {!reprovando ? (
          <>
            <button disabled={enviando} onClick={() => decidir(true)}
              className="flex-1 rounded-xl bg-emerald-600 text-white py-2.5 text-sm font-bold disabled:opacity-60">
              Aprovar
            </button>
            <button disabled={enviando} onClick={() => setReprovando(true)}
              className="flex-1 rounded-xl border-2 border-red-500 text-red-600 py-2.5 text-sm font-bold disabled:opacity-60">
              Reprovar
            </button>
          </>
        ) : (
          <>
            <button disabled={enviando} onClick={() => { setReprovando(false); setErro(""); }}
              className="flex-1 rounded-xl border-2 border-slate-200 text-slate-600 py-2.5 text-sm font-semibold">
              Voltar
            </button>
            <button disabled={enviando} onClick={() => decidir(false)}
              className="flex-[2] rounded-xl bg-red-600 text-white py-2.5 text-sm font-bold disabled:opacity-60">
              Confirmar reprovação
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function ApprovalScreen({ onAlterado }: { onAlterado: () => void }) {
  const [itens, setItens] = useState<Amostra[] | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(() => {
    api.pendentes().then(setItens).catch((e) => setErro(e instanceof Error ? e.message : "Erro ao carregar."));
  }, []);
  useEffect(carregar, [carregar]);

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="bg-[#1e40af] text-white px-4 pt-12 pb-5 md:px-8 md:pt-8 md:pb-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">SGF</p>
          <h1 className="text-xl font-bold md:text-2xl" style={{ fontFamily: "'Work Sans', sans-serif" }}>Pendentes de aprovação</h1>
          <p className="text-blue-200 text-xs">Decisão exclusiva do responsável técnico</p>
        </div>
      </div>
      <div className="px-4 pt-4 space-y-3 max-w-7xl mx-auto md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:px-8 md:pt-6">
        {erro && <p role="alert" className="text-red-600 text-sm md:col-span-2">{erro}</p>}
        {itens === null && !erro && <p className="text-sm text-slate-500 md:col-span-2">Carregando...</p>}
        {itens?.length === 0 && (
          <p className="text-center text-slate-500 text-sm py-16 md:col-span-2">Nenhuma amostra aguardando aprovação.</p>
        )}
        {itens?.map((a) => (
          <Cartao key={a.id} a={a} onDecidido={() => { carregar(); onAlterado(); }} />
        ))}
      </div>
    </div>
  );
}
