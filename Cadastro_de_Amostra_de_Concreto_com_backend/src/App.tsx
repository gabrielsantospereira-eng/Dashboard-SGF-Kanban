import { useCallback, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  api,
  definirAoExpirar,
  formatarData,
  getToken,
  setToken,
  SITUACOES,
  type Amostra,
  type Dashboard,
  type Perfil,
  type Usuario,
} from "./api";
import LoginScreen from "./LoginScreen";
import ApprovalScreen from "./ApprovalScreen";
import DetalhesAmostra from "./DetalhesAmostra";

type Screen = "dashboard" | "form" | "success" | "history" | "approvals";

const TODAS = "Todas as obras";

const PERIODOS = [
  { label: "Últimos 7 dias", dias: 7 },
  { label: "Últimos 30 dias", dias: 30 },
  { label: "Últimos 90 dias", dias: 90 },
];

const COR_SITUACAO: Record<string, string> = {
  "Aguardando rompimento": "#f59e0b",
  "Pendente de aprovação": "#3b82f6",
  Aprovada: "#16a34a",
  Reprovada: "#ef4444",
};

const COR_BADGE: Record<string, string> = {
  "Aguardando rompimento": "warning",
  "Pendente de aprovação": "info",
  Aprovada: "success",
  Reprovada: "danger",
};

const podeCadastrar = (p: Perfil) => p === "fiscal" || p === "responsavel_tecnico";

// Esconde "Nova Amostra" de quem não pode cadastrar e mostra "Aprovações" só para o responsável técnico.
function abasVisiveis<T extends { id: Screen }>(tabs: T[], perfil: Perfil, aprovacoes: T): T[] {
  const base = podeCadastrar(perfil) ? tabs : tabs.filter((t) => t.id !== "form");
  return perfil === "responsavel_tecnico" ? [...base, aprovacoes] : base;
}

// ─── Shared components ────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    info: "bg-blue-50 text-blue-700 border border-blue-200",
    danger: "bg-red-50 text-red-700 border border-red-200",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${styles[COR_BADGE[status]] ?? styles.info}`}>
      {status}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"
      style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {children}
    </h3>
  );
}

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all";

// ─── Bottom Navigation ────────────────────────────────────────────────────────

function DesktopSidebar({
  active,
  usuario,
  pendentes,
  onLogout,
  onNavigate,
}: {
  active: Screen;
  usuario: Usuario;
  pendentes: number;
  onLogout: () => void;
  onNavigate: (s: Screen) => void;
}) {
  const todasTabs = [
    {
      id: "dashboard" as Screen,
      label: "Dashboard",
      description: "Visão geral",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: "form" as Screen,
      label: "Nova Amostra",
      description: "Cadastrar ensaio",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
    },
    {
      id: "history" as Screen,
      label: "Histórico",
      description: "Todas as amostras",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
  ];
  const tabs = abasVisiveis(todasTabs, usuario.perfil, {
    id: "approvals" as Screen,
    label: pendentes > 0 ? `Aprovações (${pendentes})` : "Aprovações",
    description: "Pendentes de decisão",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  });

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand text-white shadow-xl md:flex">
      <div className="border-b border-white/10 px-6 py-7">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
          <span className="font-display text-sm font-extrabold">SGF</span>
        </div>
        <p className="font-display text-lg font-bold">Qualidade do Concreto</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-200">Controle tecnológico de obras</p>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-6">
        {tabs.map((tab) => {
          const isActive = active === tab.id || (active === "success" && tab.id === "form");
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                isActive ? "bg-white text-brand shadow-sm" : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${isActive ? "bg-blue-50" : "bg-white/10"}`}>
                {tab.icon}
              </span>
              <span>
                <span className="block font-display text-sm font-bold">{tab.label}</span>
                <span className={`block text-xs ${isActive ? "text-slate-500" : "text-blue-200"}`}>{tab.description}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-6 py-5">
        <p className="text-sm font-semibold text-white">{usuario.nome}</p>
        <p className="mt-0.5 text-xs text-blue-200">{usuario.perfilRotulo}</p>
        <button onClick={onLogout} className="mt-3 text-xs font-semibold text-blue-100 underline hover:text-white">
          Sair
        </button>
      </div>
    </aside>
  );
}

function BottomNav({
  active,
  perfil,
  pendentes,
  onLogout,
  onNavigate,
}: {
  active: Screen;
  perfil: Perfil;
  pendentes: number;
  onLogout: () => void;
  onNavigate: (s: Screen) => void;
}) {
  const todasTabs = [
    {
      id: "dashboard" as Screen,
      label: "Dashboard",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: "form" as Screen,
      label: "Nova Amostra",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="16" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      ),
    },
    {
      id: "history" as Screen,
      label: "Histórico",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
  ];
  const tabs = abasVisiveis(todasTabs, perfil, {
    id: "approvals" as Screen,
    label: pendentes > 0 ? `Aprovações (${pendentes})` : "Aprovações",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto bg-white border-t border-slate-200 flex items-stretch shadow-lg z-20 md:hidden">
      {tabs.map((tab) => {
        const isActive = active === tab.id || (tab.id === "dashboard" && active === "success");
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate(tab.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors ${
              isActive ? "text-blue-700" : "text-slate-400"
            }`}
          >
            <div className={isActive ? "text-blue-700" : "text-slate-400"}>{tab.icon}</div>
            <span className={`text-[10px] font-semibold ${isActive ? "text-blue-700" : "text-slate-400"}`}
              style={{ fontFamily: "'Work Sans', sans-serif" }}>
              {tab.label}
            </span>
            {isActive && <div className="absolute bottom-0 w-8 h-0.5 bg-blue-600 rounded-full" />}
          </button>
        );
      })}
      <button
        onClick={onLogout}
        className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-slate-400"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="text-[10px] font-semibold" style={{ fontFamily: "'Work Sans', sans-serif" }}>Sair</span>
      </button>
    </nav>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────

function DashboardScreen({ obras, perfil, onNavigate }: { obras: string[]; perfil: Perfil; onNavigate: (s: Screen) => void }) {
  const [obra, setObra] = useState(TODAS);
  const [periodo, setPeriodo] = useState("Últimos 30 dias");
  const [dados, setDados] = useState<Dashboard | null>(null);
  const [erro, setErro] = useState("");

  // Tudo no Dashboard vem do servidor e é recalculado quando os filtros mudam ou a tela é aberta.
  useEffect(() => {
    const dias = PERIODOS.find((p) => p.label === periodo)?.dias ?? 30;
    let ativo = true;
    api
      .dashboard(obra, dias)
      .then((d) => { if (ativo) { setDados(d); setErro(""); } })
      .catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : "Erro ao carregar o Dashboard."); });
    return () => { ativo = false; };
  }, [obra, periodo]);

  const showObrasSection = obra === TODAS;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg">
          <p className="text-xs text-slate-500 mb-0.5">{label}</p>
          <p className="text-sm font-bold text-slate-800">{payload[0].value} amostras</p>
        </div>
      );
    }
    return null;
  };

  if (!dados) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6 text-sm" style={{ fontFamily: "'Inter', sans-serif" }}>
        {erro ? <p role="alert" className="text-red-600">{erro}</p> : <p className="text-slate-500">Carregando...</p>}
      </div>
    );
  }
  const situacaoData = dados.porSituacao.map((s) => ({ name: s.nome, value: s.qtd, color: COR_SITUACAO[s.nome] ?? "#94a3b8" }));
  const maxLocal = Math.max(1, ...dados.porLocal.map((l) => l.qtd));

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#1e40af] text-white px-4 pt-12 pb-5 md:px-8 md:pt-8 md:pb-6">
        <div className="flex items-center justify-between mb-4 max-w-7xl mx-auto">
          <div>
            <p className="text-blue-200 text-[10px] font-bold uppercase tracking-widest">SGF</p>
            <h1 className="text-xl font-bold md:text-2xl" style={{ fontFamily: "'Work Sans', sans-serif" }}>Dashboard</h1>
            <p className="text-blue-200 text-xs">Qualidade do Concreto</p>
          </div>
          {podeCadastrar(perfil) && (<button
            onClick={() => onNavigate("form")}
            className="flex items-center gap-1.5 bg-white text-[#1e40af] text-xs font-bold px-3.5 py-2 rounded-xl shadow-md active:scale-95 transition-transform"
            style={{ fontFamily: "'Work Sans', sans-serif" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova Amostra
          </button>)}
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide max-w-7xl mx-auto">
          <div className="relative flex-shrink-0">
            <select
              value={obra}
              onChange={(e) => setObra(e.target.value)}
              className="bg-white/20 text-white text-xs font-semibold rounded-lg pl-3 pr-7 py-2 appearance-none focus:outline-none cursor-pointer"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              {[TODAS, ...obras].map((o) => <option key={o} value={o} className="text-slate-800 bg-white">{o}</option>)}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
          <div className="relative flex-shrink-0">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-white/20 text-white text-xs font-semibold rounded-lg pl-3 pr-7 py-2 appearance-none focus:outline-none cursor-pointer"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              {PERIODOS.map((p) => <option key={p.label} value={p.label} className="text-slate-800 bg-white">{p.label}</option>)}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-6 max-w-7xl mx-auto md:grid md:grid-cols-12 md:gap-6 md:space-y-0 md:px-8 md:py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 md:col-span-12 md:grid-cols-4 md:gap-5">
          {/* Total */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-slate-800" style={{ fontFamily: "'Work Sans', sans-serif" }}>{dados.cards.total}</p>
            <p className="text-xs text-slate-500 mt-1 leading-tight">Amostras cadastradas</p>
          </div>

          {/* Aguardando */}
          <div className="bg-white rounded-2xl p-4 border border-amber-100 shadow-sm">
            <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-amber-600" style={{ fontFamily: "'Work Sans', sans-serif" }}>{dados.cards.aguardando}</p>
            <p className="text-xs text-slate-500 mt-1 leading-tight">Aguardando rompimento</p>
          </div>

          {/* Resultado */}
          <div className="bg-white rounded-2xl p-4 border border-emerald-100 shadow-sm">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-emerald-600" style={{ fontFamily: "'Work Sans', sans-serif" }}>{dados.cards.aprovadas}</p>
            <p className="text-xs text-slate-500 mt-1 leading-tight">Aprovadas</p>
          </div>

          {/* Novas */}
          <div className="bg-white rounded-2xl p-4 border border-blue-100 shadow-sm">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-blue-500" style={{ fontFamily: "'Work Sans', sans-serif" }}>{dados.cards.pendentes}</p>
            <p className="text-xs text-slate-500 mt-1 leading-tight">Pendentes de aprovação</p>
          </div>
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:col-span-8 md:p-5">
          <SectionTitle>Amostras cadastradas</SectionTitle>
          <p className="text-xs text-slate-400 -mt-2 mb-4">Registros por dia</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dados.porDia} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Inter, sans-serif" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8", fontFamily: "Inter, sans-serif" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f1f5f9", radius: 6 }} />
              <Bar dataKey="qtd" radius={[4, 4, 0, 0]}>
                {dados.porDia.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={i === dados.porDia.length - 1 ? "#1e40af" : "#bfdbfe"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Situação — donut */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:col-span-4 md:p-5">
          <SectionTitle>Situação das amostras</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <PieChart width={120} height={120}>
                <Pie
                  data={situacaoData}
                  cx={55}
                  cy={55}
                  innerRadius={36}
                  outerRadius={54}
                  paddingAngle={3}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {situacaoData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </div>
            <div className="flex-1 space-y-2.5">
              {situacaoData.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 leading-tight truncate">{s.name}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-800 flex-shrink-0"
                    style={{ fontFamily: "'Work Sans', sans-serif" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Amostras por local */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:col-span-6 md:p-5">
          <SectionTitle>Amostras por local</SectionTitle>
          <div className="space-y-3">
            {dados.porLocal.map((l) => (
              <div key={l.nome}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-slate-700 font-medium">{l.nome}</span>
                  <span className="text-sm font-bold text-slate-800" style={{ fontFamily: "'Work Sans', sans-serif" }}>{l.qtd}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1e40af] transition-all"
                    style={{ width: `${(l.qtd / maxLocal) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Amostras por obra (only when "Todas") */}
        {showObrasSection && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 md:col-span-6 md:p-5">
            <SectionTitle>Amostras por obra</SectionTitle>
            <div className="space-y-3">
              {dados.porObra.map((o) => (
                <button
                  key={o.nome}
                  onClick={() => setObra(o.nome)}
                  className="w-full flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 hover:border-blue-200 hover:bg-blue-50 active:scale-[0.98] transition-all"
                >
                  <span className="text-sm font-semibold text-slate-700">{o.nome}</span>
                  <span className="text-sm font-bold text-blue-700 flex items-center gap-1"
                    style={{ fontFamily: "'Work Sans', sans-serif" }}>
                    {o.qtd} amostras
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amostras recentes */}
        <div className="md:col-span-12">
          <div className="flex items-center justify-between mb-3">
            <SectionTitle>Amostras recentes</SectionTitle>
            <button
              onClick={() => onNavigate("history")}
              className="text-xs font-semibold text-blue-600 flex items-center gap-1 active:opacity-70"
              style={{ fontFamily: "'Work Sans', sans-serif" }}
            >
              Ver todas
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </div>
          <div className="space-y-2.5">
            {dados.recentes.map((item) => (
              <div key={item.codigo} className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-slate-800 text-sm" style={{ fontFamily: "monospace" }}>{item.codigo}</p>
                    <p className="text-xs text-blue-600 font-semibold">{item.obra}</p>
                  </div>
                  <StatusBadge status={item.situacao} />
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    {item.local}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                    {formatarData(item.data)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Form Screen ──────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5"
      style={{ fontFamily: "'Work Sans', sans-serif" }}>
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function FormScreen({ obras, onBack, onSave }: { obras: string[]; onBack: () => void; onSave: (a: Amostra) => void }) {
  const [form, setForm] = useState({
    obra: "",
    local: "",
    data: new Date().toISOString().slice(0, 10),
    codigo: "",
    lote: "",
    observacoes: "",
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [erroServidor, setErroServidor] = useState("");
  const [enviando, setEnviando] = useState(false);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: false }));
    setErroServidor("");
  };

  const handleSave = async () => {
    const required = ["obra", "local", "data", "codigo", "lote"];
    const newErrors: Record<string, boolean> = {};
    required.forEach((k) => { if (!form[k as keyof typeof form]) newErrors[k] = true; });
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
    setEnviando(true);
    try {
      // O servidor valida de novo e grava; só avançamos se o cadastro foi aceito.
      onSave(await api.criar(form));
    } catch (e) {
      setErroServidor(e instanceof Error ? e.message : "Não foi possível salvar a amostra.");
    } finally {
      setEnviando(false);
    }
  };

  const fieldErr = (k: string) => errors[k] ? "border-red-400 focus:ring-red-400" : "";

  return (
    <div className="min-h-screen bg-slate-50 pb-36 md:pb-0" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="bg-[#1e40af] text-white px-4 pt-12 pb-5 sticky top-0 z-10 shadow-md md:px-8 md:pt-8 md:pb-6">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div>
            <h1 className="text-lg font-bold md:text-2xl" style={{ fontFamily: "'Work Sans', sans-serif" }}>Nova Amostra</h1>
            <p className="text-blue-200 text-xs">Cadastro de Amostra de Concreto</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-6 space-y-5 max-w-4xl mx-auto md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-5 md:space-y-0 md:px-8 md:py-8">
        <div>
          <FieldLabel required>Obra</FieldLabel>
          <div className="relative">
            <select value={form.obra} onChange={(e) => set("obra", e.target.value)}
              className={`${inputBase} appearance-none pr-10 ${fieldErr("obra")}`}>
              <option value="">Selecione a obra</option>
              {obras.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
          {errors.obra && <p className="text-red-500 text-xs mt-1">Campo obrigatório</p>}
        </div>

        <div>
          <FieldLabel required>Local da Concretagem</FieldLabel>
          <input type="text" value={form.local} onChange={(e) => set("local", e.target.value)}
            placeholder="Ex.: Pilar P12" className={`${inputBase} ${fieldErr("local")}`} />
          {errors.local && <p className="text-red-500 text-xs mt-1">Campo obrigatório</p>}
        </div>

        <div>
          <FieldLabel required>Data da Concretagem</FieldLabel>
          <div className="relative">
            <input type="date" value={form.data} onChange={(e) => set("data", e.target.value)}
              className={`${inputBase} pr-10 ${fieldErr("data")}`} />
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
          </div>
          {errors.data && <p className="text-red-500 text-xs mt-1">Campo obrigatório</p>}
        </div>

        <div>
          <FieldLabel required>Código da Amostra</FieldLabel>
          <input type="text" value={form.codigo} onChange={(e) => set("codigo", e.target.value)}
            placeholder="Ex.: AM-2026-001" className={`${inputBase} font-mono ${fieldErr("codigo")}`} />
          {errors.codigo && <p className="text-red-500 text-xs mt-1">Campo obrigatório</p>}
        </div>

        <div>
          <FieldLabel required>Identificação do Lote</FieldLabel>
          <input type="text" value={form.lote} onChange={(e) => set("lote", e.target.value)}
            placeholder="Ex.: LOTE-001" className={`${inputBase} font-mono ${fieldErr("lote")}`} />
          {errors.lote && <p className="text-red-500 text-xs mt-1">Campo obrigatório</p>}
        </div>

        <div className="md:col-span-2">
          <FieldLabel>Observações <span className="text-slate-400 font-normal text-xs">(opcional)</span></FieldLabel>
          <textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)}
            placeholder="Adicione informações relevantes sobre a amostra..." rows={4}
            className={`${inputBase} resize-none`} />
        </div>
      </div>

      {erroServidor && (
        <div className="px-4 max-w-4xl mx-auto md:px-8 md:pb-4">
          <p role="alert" className="text-red-600 text-sm">{erroServidor}</p>
        </div>
      )}
      <div className="fixed bottom-16 left-0 right-0 max-w-sm mx-auto bg-white border-t border-slate-200 px-4 py-4 flex gap-3 shadow-lg z-10 md:static md:max-w-4xl md:border-0 md:bg-transparent md:px-8 md:pb-10 md:pt-0 md:shadow-none">
        <button onClick={onBack}
          className="flex-1 rounded-xl border-2 border-slate-200 py-3.5 text-slate-600 font-semibold text-sm active:scale-[0.98] transition-transform"
          style={{ fontFamily: "'Work Sans', sans-serif" }}>
          Cancelar
        </button>
        <button onClick={handleSave} disabled={enviando}
          className="flex-[2] rounded-xl bg-[#1e40af] text-white py-3.5 font-bold text-sm shadow-lg shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          style={{ fontFamily: "'Work Sans', sans-serif" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
          Salvar Amostra
        </button>
      </div>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ amostra, onHistory, onNew }: { amostra: Amostra; onHistory: () => void; onNew: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 md:pb-0" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="bg-[#1e40af] h-2 w-full" />
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-xl w-full mx-auto">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6 shadow-md">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center" style={{ fontFamily: "'Work Sans', sans-serif" }}>
          Amostra cadastrada!
        </h2>
        <p className="text-slate-500 text-sm text-center mb-8">A amostra foi registrada com sucesso.</p>
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <div className="bg-blue-50 border-b border-slate-200 px-5 py-3">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Resumo do registro</p>
          </div>
          <div className="px-5 py-4 space-y-3.5">
            {[
              { label: "Código da amostra", value: amostra.codigo, mono: true },
              { label: "Obra", value: amostra.obra },
              { label: "Local", value: amostra.local },
              { label: "Lote", value: amostra.lote },
              { label: "Data", value: formatarData(amostra.data) },
            ].map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4">
                <p className="text-xs text-slate-500 font-medium pt-0.5">{r.label}</p>
                <p className={`text-sm font-semibold text-slate-800 text-right ${r.mono ? "font-mono" : ""}`}>{r.value}</p>
              </div>
            ))}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100">
              <p className="text-xs text-slate-500 font-medium">Status</p>
              <StatusBadge status={amostra.situacao} />
            </div>
          </div>
        </div>
        <div className="w-full space-y-3">
          <button onClick={onHistory}
            className="w-full rounded-xl bg-[#1e40af] text-white py-4 font-bold text-sm shadow-lg shadow-blue-200 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            style={{ fontFamily: "'Work Sans', sans-serif" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            Ver Histórico
          </button>
          <button onClick={onNew}
            className="w-full rounded-xl border-2 border-[#1e40af] text-[#1e40af] py-4 font-bold text-sm active:scale-[0.98] transition-transform"
            style={{ fontFamily: "'Work Sans', sans-serif" }}>
            + Cadastrar Nova Amostra
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── History Screen ───────────────────────────────────────────────────────────

function HistoryScreen({ obras, perfil, onBack, onNew }: { obras: string[]; perfil: Perfil; onBack: () => void; onNew: () => void }) {
  const [search, setSearch] = useState("");
  const [filterObra, setFilterObra] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [lista, setLista] = useState<Amostra[] | null>(null);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);

  // Busca e filtros são aplicados no servidor; o atraso evita uma requisição a cada letra digitada.
  useEffect(() => {
    let ativo = true;
    const t = setTimeout(() => {
      api
        .amostras({ obra: filterObra, situacao: filterStatus, q: search.trim() })
        .then((r) => { if (ativo) { setLista(r); setErro(""); } })
        .catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : "Erro ao carregar o histórico."); });
    }, 250);
    return () => { ativo = false; clearTimeout(t); };
  }, [search, filterObra, filterStatus, versao]);

  const filtered = lista ?? [];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-10" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="bg-[#1e40af] text-white px-4 pt-12 pb-5 sticky top-0 z-10 shadow-md md:px-8 md:pt-8 md:pb-6">
        <div className="flex items-center gap-3 max-w-7xl mx-auto">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold md:text-2xl" style={{ fontFamily: "'Work Sans', sans-serif" }}>Histórico de Amostras</h1>
            <p className="text-blue-200 text-xs">Controle Tecnológico do Concreto</p>
          </div>
          {podeCadastrar(perfil) && (<button onClick={onNew} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          </button>)}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 sticky top-[88px] bg-slate-50 z-10 border-b border-slate-200 shadow-sm md:top-[96px] md:flex md:items-center md:gap-3 md:space-y-0 md:px-8">
        <div className="relative md:flex-[2] max-w-7xl md:ml-auto">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar amostra..."
            className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          </div>
        </div>
        <div className="flex gap-2 md:flex-1 md:mr-auto">
          {[
            { val: filterObra, set: setFilterObra, placeholder: "Todas as obras", options: obras },
            { val: filterStatus, set: setFilterStatus, placeholder: "Todos os status", options: SITUACOES },
          ].map((f, i) => (
            <div key={i} className="relative flex-1">
              <select value={f.val} onChange={(e) => f.set(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 pr-7">
                <option value="">{f.placeholder}</option>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3 max-w-7xl mx-auto md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:px-8 md:pt-6">
        <p className="text-xs text-slate-500 font-medium md:col-span-2">{filtered.length} amostras encontradas</p>
        {erro && <p role="alert" className="text-red-600 text-sm md:col-span-2">{erro}</p>}
        {filtered.length === 0 ? (
          <div className="text-center py-16 md:col-span-2">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </div>
            <p className="text-slate-500 text-sm">Nenhuma amostra encontrada</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-bold text-slate-800 text-base" style={{ fontFamily: "monospace" }}>{item.codigo}</p>
                    <p className="text-xs text-blue-600 font-semibold mt-0.5">{item.obra}</p>
                  </div>
                  <StatusBadge status={item.situacao} />
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>{item.local}</span>
                  <span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /></svg>{formatarData(item.data)}</span>
                  <span className="flex items-center gap-1"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 3v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>{item.lote}</span>
                </div>
                <DetalhesAmostra item={item} perfil={perfil} onAlterado={() => setVersao((v) => v + 1)} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [verificando, setVerificando] = useState(Boolean(getToken()));
  const [obras, setObras] = useState<string[]>([]);
  const [pendentes, setPendentes] = useState(0);
  const [ultima, setUltima] = useState<Amostra | null>(null);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [navHistory, setNavHistory] = useState<Screen[]>([]);

  const sair = useCallback(() => {
    setToken(null);
    setUsuario(null);
    setScreen("dashboard");
    setNavHistory([]);
  }, []);

  // Sessão expirada (401 em qualquer chamada) volta para o login.
  useEffect(() => {
    definirAoExpirar(sair);
    return () => definirAoExpirar(null);
  }, [sair]);

  // Restaura a sessão a partir do token guardado.
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then((r) => setUsuario(r.usuario))
      .catch(() => setToken(null))
      .finally(() => setVerificando(false));
  }, []);

  useEffect(() => {
    if (!usuario) return;
    api.obras().then((o) => setObras(o.map((x) => x.nome))).catch(() => setObras([]));
  }, [usuario]);

  const atualizarPendentes = useCallback(() => {
    if (usuario?.perfil !== "responsavel_tecnico") return;
    api.pendentes().then((l) => setPendentes(l.length)).catch(() => undefined);
  }, [usuario]);
  useEffect(atualizarPendentes, [atualizarPendentes, screen]);

  if (verificando) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Carregando...</div>;
  }
  if (!usuario) {
    return <LoginScreen onLogin={(u) => { setUsuario(u); setScreen("dashboard"); setNavHistory([]); }} />;
  }

  const navigate = (to: Screen) => {
    if (to === "form" && !podeCadastrar(usuario.perfil)) return;
    setNavHistory((h) => [...h, screen]);
    setScreen(to);
  };

  const goBack = () => {
    const prev = navHistory[navHistory.length - 1] ?? "dashboard";
    setNavHistory((h) => h.slice(0, -1));
    setScreen(prev);
  };

  const irPara = (s: Screen) => {
    if (s === screen) return;
    setNavHistory([]);
    setScreen(s);
  };

  return (
    <div className="min-h-screen overflow-x-hidden relative bg-slate-50 md:pl-64">
      <DesktopSidebar active={screen} usuario={usuario} pendentes={pendentes} onLogout={sair} onNavigate={irPara} />
      {screen === "dashboard" && <DashboardScreen obras={obras} perfil={usuario.perfil} onNavigate={navigate} />}
      {screen === "form" && <FormScreen obras={obras} onBack={goBack} onSave={(a) => { setUltima(a); navigate("success"); }} />}
      {screen === "success" && ultima && (
        <SuccessScreen amostra={ultima} onHistory={() => navigate("history")} onNew={() => navigate("form")} />
      )}
      {screen === "history" && <HistoryScreen obras={obras} perfil={usuario.perfil} onBack={goBack} onNew={() => navigate("form")} />}
      {screen === "approvals" && usuario.perfil === "responsavel_tecnico" && <ApprovalScreen onAlterado={atualizarPendentes} />}
      <BottomNav active={screen} perfil={usuario.perfil} pendentes={pendentes} onLogout={sair} onNavigate={irPara} />
    </div>
  );
}
