import { useState } from "react";
import { api, formatarMpa, type Amostra, type Perfil } from "./api";

// Detalhes de uma amostra no histórico: resistência, decisão e o registro do resultado do rompimento.
export default function DetalhesAmostra({ item, perfil, onAlterado }: { item: Amostra; perfil: Perfil; onAlterado: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [mpa, setMpa] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const pode = (perfil === "fiscal" || perfil === "responsavel_tecnico") && item.situacao === "Aguardando rompimento";

  const salvar = async () => {
    setErro("");
    const valor = Number(mpa.replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      setErro("Informe a resistência em MPa.");
      return;
    }
    setEnviando(true);
    try {
      await api.registrarResultado(item.id, valor);
      setAberto(false);
      setMpa("");
      onAlterado();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível registrar o resultado.");
    } finally {
      setEnviando(false);
    }
  };

  const nada = item.resistenciaMpa === null && !item.decididoPor && !pode;
  if (nada) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      {item.resistenciaMpa !== null && (
        <p className="text-xs text-slate-600">Resistência: <b>{formatarMpa(item.resistenciaMpa)}</b></p>
      )}
      {item.decididoPor && (
        <p className="text-xs text-slate-600">
          {item.situacao} por {item.decididoPor}
          {item.justificativa ? `: ${item.justificativa}` : ""}
        </p>
      )}
      {pode && !aberto && (
        <button onClick={() => setAberto(true)} className="text-xs font-semibold text-blue-600">
          Registrar resultado do rompimento
        </button>
      )}
      {pode && aberto && (
        <div className="flex items-center gap-2">
          <input
            aria-label="Resistência em MPa"
            inputMode="decimal"
            value={mpa}
            onChange={(e) => setMpa(e.target.value)}
            placeholder="Resistência (MPa)"
            className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button disabled={enviando} onClick={salvar} className="rounded-lg bg-[#1e40af] text-white px-3 py-2 text-xs font-bold disabled:opacity-60">
            Salvar
          </button>
          <button onClick={() => { setAberto(false); setErro(""); }} className="text-xs text-slate-500">Cancelar</button>
        </div>
      )}
      {erro && <p role="alert" className="text-red-600 text-xs">{erro}</p>}
    </div>
  );
}
