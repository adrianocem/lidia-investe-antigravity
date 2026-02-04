
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Investment, MarketRates } from './types';
import { InvestmentForm } from './components/InvestmentForm';
import { StatsCard } from './components/StatsCard';
import { FGCCard } from './components/FGCCard';
import { calculateFutureValue, formatCurrency, formatDate } from './utils/calculations';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Wallet, TrendingUp, Calendar, LayoutDashboard, List, Trash2, ShieldCheck, Plus, Pencil, Settings, Loader2, ChevronUp, ChevronDown, ArrowUpDown, Download, Bell, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  fetchInvestments,
  addInvestment,
  updateInvestment,
  deleteInvestment,
  fetchMarketRates,
  saveMarketRates,
  updateInvestmentValues
} from './services/investmentService';

const App: React.FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [marketRates, setMarketRates] = useState<MarketRates>({ cdi: 11.25, ipca: 4.5 });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'investments' | 'fgc' | 'settings'>('dashboard');
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [sortField, setSortField] = useState<'bank' | 'amount' | 'startDate' | 'dueDate' | 'netFutureValue'>('dueDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showUpdates, setShowUpdates] = useState(false);

  // Carregar dados do Supabase ao iniciar
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [investmentsData, ratesData] = await Promise.all([
          fetchInvestments(),
          fetchMarketRates()
        ]);
        setInvestments(investmentsData);
        setMarketRates(ratesData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Salvar taxas de mercado quando alteradas
  const handleMarketRatesChange = useCallback(async (newRates: MarketRates) => {
    setIsRecalculating(true);
    setMarketRates(newRates);
    await saveMarketRates(newRates);

    // Recalcular todos os investimentos com as novas taxas
    const updatedInvestments = investments.map(inv => {
      const { gross, net } = calculateFutureValue(inv, newRates);
      return {
        ...inv,
        futureValue: gross,
        netFutureValue: net
      };
    });

    // Atualizar no estado local
    setInvestments(updatedInvestments);

    // Salvar no banco em lote (para performance)
    try {
      await updateInvestmentValues(updatedInvestments);
    } catch (error) {
      console.error('Erro ao atualizar valores futuros no banco:', error);
    } finally {
      setIsRecalculating(false);
    }
  }, [investments]);

  const handleAddInvestment = async (inv: Investment) => {
    setIsSaving(true);
    const saved = await addInvestment(inv);
    if (saved) {
      setInvestments(prev => [...prev, saved]);
    }
    setIsSaving(false);
    setActiveTab('investments');
  };

  const handleUpdateInvestment = async (inv: Investment) => {
    if (!inv) {
      setEditingInvestment(null);
      return;
    }

    setIsSaving(true);
    const updated = await updateInvestment(inv);
    if (updated) {
      setInvestments(prev => prev.map(i => i.id === updated.id ? updated : i));
      setEditingInvestment(null);
    }
    setIsSaving(false);
  };

  const handleDeleteInvestment = async (id: string) => {
    if (confirm('Deseja realmente remover este investimento?')) {
      const success = await deleteInvestment(id);
      if (success) {
        setInvestments(prev => prev.filter(i => i.id !== id));
      }
    }
  };

  const stats = useMemo(() => {
    const totalInvested = investments.reduce((acc, curr) => acc + curr.amount, 0);
    const totalFutureNet = investments.reduce((acc, curr) => acc + (curr.netFutureValue || 0), 0);
    const nextDueDate = investments.length > 0
      ? [...investments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0].dueDate
      : null;

    return { totalInvested, totalFutureNet, nextDueDate };
  }, [investments]);

  const fgcExposure = useMemo(() => {
    const banks: Record<string, number> = {};
    investments.forEach(inv => {
      const bankName = inv.bank.trim().toUpperCase();
      banks[bankName] = (banks[bankName] || 0) + (inv.futureValue || 0);
    });
    return Object.entries(banks).sort((a, b) => b[1] - a[1]);
  }, [investments]);

  const sortedInvestments = useMemo(() => {
    return [...investments].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (typeof aValue === 'string') aValue = aValue.toLowerCase();
      if (typeof bValue === 'string') bValue = bValue.toLowerCase();

      if (sortField === 'startDate' || sortField === 'dueDate') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [investments, sortField, sortDirection]);

  const chartData = useMemo(() => {
    const byType: Record<string, number> = {};
    investments.forEach(inv => {
      byType[inv.type] = (byType[inv.type] || 0) + inv.amount;
    });
    return Object.entries(byType).map(([name, value]) => ({ name, value }));
  }, [investments]);

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const handleExportExcel = () => {
    // Definir dados com valores numéricos puros para o Excel tratar corretamente
    const exportData = investments.map(inv => ({
      'Corretora': inv.broker,
      'Banco Emissor': inv.bank,
      'Título': inv.title,
      'Rentabilidade': inv.type,
      'Valor Aplicado (R$)': inv.amount,
      'Quantidade': inv.quantity,
      'Taxa de Juros (%)': inv.interestRate / 100,
      'Data de Aplicação': new Date(inv.startDate),
      'Vencimento': new Date(inv.dueDate),
      'IR Estimado (%)': inv.incomeTax / 100,
      'Valor Bruto Futuro': inv.futureValue,
      'Valor Líquido Futuro': inv.netFutureValue
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Configurar formatos numéricos específicos (z) para colunas selecionadas
    // O formato abaixo é o "Contábil" aproximado:
    const currencyFormat = '_-R$ * #,##0.00_-;-R$ * #,##0.00_-;_-R$ * "-"??_-;_-@_-';
    const percentFormat = '0.00%';
    const dateFormat = 'dd/mm/yyyy';

    // Obter o range da planilha
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
      // Colunas de Moeda: E (4), K (10), L (11)
      [4, 10, 11].forEach(C => {
        const cell = worksheet[XLSX.utils.encode_cell({ c: C, r: R })];
        if (cell) {
          cell.t = 'n'; // Garante que é número
          cell.z = currencyFormat;
        }
      });

      // Colunas de Porcentagem: G (6), J (9)
      [6, 9].forEach(C => {
        const cell = worksheet[XLSX.utils.encode_cell({ c: C, r: R })];
        if (cell) {
          cell.t = 'n';
          cell.z = percentFormat;
        }
      });

      // Colunas de Data: H (7), I (8)
      [7, 8].forEach(C => {
        const cell = worksheet[XLSX.utils.encode_cell({ c: C, r: R })];
        if (cell) {
          cell.t = 'd';
          cell.z = dateFormat;
        }
      });
    }

    // Ajustar largura das colunas para os dados caberem
    worksheet['!cols'] = [
      { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 15 },
      { wch: 18 }, { wch: 10 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Meus Ativos");

    XLSX.writeFile(workbook, `Lidia_Investe_Ativos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Tela de loading
  if (isLoading) {
    return (
      <div className="flex h-screen bg-slate-50 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
          <p className="text-slate-500 font-medium">Carregando seus investimentos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden flex-col lg:flex-row">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col h-full">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-sm border border-blue-100 shrink-0">
            <img src="/app-icon.jpg" alt="Lídia Investe" className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-black text-slate-800 tracking-tight">Lídia Investe</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -mt-1">v. 1.1</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${activeTab === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard className="w-5 h-5" /> Dashboard</button>
          <button onClick={() => setActiveTab('investments')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${activeTab === 'investments' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><List className="w-5 h-5" /> Investimentos</button>
          <button onClick={() => setActiveTab('fgc')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${activeTab === 'fgc' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><ShieldCheck className="w-5 h-5" /> Monitor FGC</button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${activeTab === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><Settings className="w-5 h-5" /> Configurações</button>
        </nav>
      </aside>

      {/* Header Mobile & Desktop Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="lg:hidden flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-blue-100 shrink-0">
              <img src="/app-icon.jpg" alt="Lídia Investe" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-slate-800 text-sm leading-tight">Lídia Investe</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">v. 1.1</span>
            </div>
          </div>
          <div className="hidden lg:block">
            <h1 className="text-xl font-black text-slate-800 tracking-tight">
              {activeTab === 'dashboard' ? 'Dashboard' :
                activeTab === 'investments' ? 'Investimentos' :
                  activeTab === 'fgc' ? 'Monitor FGC' : 'Configurações'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => setShowUpdates(!showUpdates)}
            className={`p-2 rounded-xl transition-all relative ${showUpdates ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>

          {/* Updates Panel */}
          {showUpdates && (
            <div className="absolute top-14 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[60] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">Novidades do App</h3>
                </div>
                <button onClick={() => setShowUpdates(false)} className="p-1 text-slate-400 hover:text-slate-600 transition-colors"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 max-h-[420px] overflow-y-auto">
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full uppercase">Update V. 1.1</span>
                      <span className="text-[10px] text-slate-400 font-bold">03/02/2026</span>
                    </div>
                    <ul className="space-y-3">
                      <li className="flex gap-3">
                        <div className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">Exportação para Excel</span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">Agora você pode exportar sua carteira com formatação contábil (R$) e taxas (%) automáticas.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <div className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">Monitor Global de FGC</span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">Implementamos o limite de R$ 1 milhão por CPF e avisos de risco por instituição.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <div className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">Bancos Customizados</span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">Liberdade total: adicione qualquer banco que não esteja na lista inicial.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <div className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">Ordenação de Ativos</span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">Organize sua tabela clicando nos cabeçalhos (Banco, Valor, Vencimento, etc) para priorizar sua visão.</p>
                        </div>
                      </li>
                      <li className="flex gap-3">
                        <div className="mt-1 w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0"></div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-800">Nova Identidade (V. 1.1)</span>
                          <p className="text-[11px] text-slate-500 leading-relaxed">Interface mais limpa com nova barra superior e identificação visual atualizada.</p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-center">
                <p className="text-[10px] text-slate-400 font-medium">Lídia Investe - Sempre evoluindo por você.</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-10 pb-24 lg:pb-10">
        {activeTab === 'dashboard' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <StatsCard title="Total Investido" value={formatCurrency(stats.totalInvested)} icon={<Wallet />} color="bg-blue-600" />
              <StatsCard title="Valor Líquido Futuro" value={formatCurrency(stats.totalFutureNet)} icon={<TrendingUp />} color="bg-emerald-600" trend={`${stats.totalInvested > 0 ? (((stats.totalFutureNet / stats.totalInvested) - 1) * 100).toFixed(1) : '0'}%`} />
              <StatsCard title="Próximo Vencimento" value={stats.nextDueDate ? formatDate(stats.nextDueDate) : 'Nenhum'} icon={<Calendar />} color="bg-orange-600" />
              <StatsCard title="Ativos" value={investments.length.toString()} icon={<List />} color="bg-indigo-600" />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:gap-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 min-h-[350px]">
                <h3 className="text-lg font-bold text-slate-800 mb-6">Alocação por Indexador</h3>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={5} dataKey="value">
                        {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <RechartsTooltip formatter={(val: number) => formatCurrency(val)} contentStyle={{ borderRadius: '12px', border: 'none' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'investments' ? (
          <div className="space-y-8">
            <InvestmentForm
              onAdd={handleAddInvestment}
              onUpdate={handleUpdateInvestment}
              marketRates={marketRates}
              editingInvestment={editingInvestment}
            />
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">
                  Meus Ativos <span className="ml-2 text-slate-400 font-medium">({investments.length})</span>
                </h3>
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all active:scale-95"
                  title="Exportar para Excel"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Exportar Planilha</span>
                </button>
              </div>
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th
                        className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'bank') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('bank');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          Ativo
                          {sortField === 'bank' ? (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'amount') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('amount');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          Valor Aplicado
                          {sortField === 'amount' ? (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'startDate') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('startDate');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          Data de Aplicação
                          {sortField === 'startDate' ? (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'dueDate') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('dueDate');
                            setSortDirection('asc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          Vencimento
                          {sortField === 'dueDate' ? (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </th>
                      <th
                        className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => {
                          if (sortField === 'netFutureValue') {
                            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('netFutureValue');
                            setSortDirection('desc');
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          Líquido Futuro
                          {sortField === 'netFutureValue' ? (
                            sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                        </div>
                      </th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedInvestments.length === 0 ? (
                      <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic text-sm">Nenhum investimento cadastrado.</td></tr>
                    ) : (
                      sortedInvestments.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0">{inv.title}</div>
                              <div>
                                <div className="text-sm font-bold text-slate-800 truncate">{inv.bank}</div>
                                <div className="text-[10px] text-slate-400 uppercase font-bold">{inv.type}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4"><div className="text-sm font-bold text-slate-700">{formatCurrency(inv.amount)}</div></td>
                          <td className="px-6 py-4"><div className="text-sm text-slate-600">{formatDate(inv.startDate)}</div></td>
                          <td className="px-6 py-4"><div className="text-sm text-slate-600">{formatDate(inv.dueDate)}</div></td>
                          <td className="px-6 py-4"><div className="flex items-center gap-1 text-blue-600 font-black text-sm">{formatCurrency(inv.netFutureValue)}</div></td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingInvestment(inv);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="p-2 text-slate-300 hover:text-blue-600 rounded-lg transition-all"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteInvestment(inv.id)}
                                className="p-2 text-slate-300 hover:text-red-500 rounded-lg transition-all"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-600" />
                  Configurações de Mercado
                </h3>
                <p className="text-sm text-slate-500 mt-1">Defina os índices base para cálculos de rentabilidade.</p>
              </div>
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Taxa CDI Atual (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={marketRates.cdi}
                        onChange={e => setMarketRates({ ...marketRates, cdi: parseFloat(e.target.value) || 0 })}
                        onBlur={() => handleMarketRatesChange(marketRates)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xl font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">Taxa anual utilizada como base para investimentos pós-fixados.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Taxa IPCA Anual (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        value={marketRates.ipca}
                        onChange={e => setMarketRates({ ...marketRates, ipca: parseFloat(e.target.value) || 0 })}
                        onBlur={() => handleMarketRatesChange(marketRates)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xl font-black text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-bold">%</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">Inflação projetada para os próximos 12 meses (usada em títulos IPCA+).</p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => handleMarketRatesChange(marketRates)}
                    disabled={isRecalculating}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${isRecalculating
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
                      }`}
                  >
                    {isRecalculating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Atualizando...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        Aplicar Novas Taxas
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex gap-3">
                  <div className="bg-blue-600 p-2 rounded-lg text-white shrink-0 h-fit">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-blue-700 leading-relaxed font-medium">
                    As alterações feitas aqui refletem instantaneamente em todos os cálculos de <strong>Valor Líquido Futuro</strong> do seu Dashboard e Lista de Ativos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Card Principal - Limite Global CPF */}
            <div className="bg-blue-600 rounded-2xl p-6 lg:p-8 text-white relative overflow-hidden shadow-lg">
              <div className="relative z-10">
                <h2 className="text-xl font-black mb-2 flex items-center gap-2"><ShieldCheck className="w-6 h-6" /> Monitor FGC</h2>
                <p className="opacity-80 text-xs max-w-lg">O FGC garante até R$ 250k por instituição e R$ 1 milhão por CPF (considerando todas as instituições).</p>

                <div className="mt-4 flex flex-wrap gap-4">
                  <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/20">
                    <p className="text-[9px] font-bold uppercase opacity-60">Total Bruto Futuro</p>
                    <p className="text-lg font-black">{formatCurrency(investments.reduce((acc, curr) => acc + (curr.futureValue || 0), 0))}</p>
                  </div>
                  <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/20">
                    <p className="text-[9px] font-bold uppercase opacity-60">Bancos Utilizados</p>
                    <p className="text-lg font-black">{fgcExposure.length}</p>
                  </div>
                </div>
              </div>
              <ShieldCheck className="absolute -right-4 -bottom-4 w-40 h-40 text-white opacity-5 pointer-events-none" />
            </div>

            {/* Card Limite Global CPF - R$ 1 Milhão */}
            {(() => {
              const totalFGC = investments.reduce((acc, curr) => acc + (curr.futureValue || 0), 0);
              const FGC_GLOBAL_LIMIT = 1000000;
              const globalPercentage = Math.min((totalFGC / FGC_GLOBAL_LIMIT) * 100, 100);
              const isGlobalOver = totalFGC > FGC_GLOBAL_LIMIT;
              const isGlobalWarning = totalFGC > FGC_GLOBAL_LIMIT * 0.8 && !isGlobalOver;

              let bgColor = "bg-emerald-50 border-emerald-200";
              let barColor = "bg-emerald-500";
              let textColor = "text-emerald-700";

              if (isGlobalOver) {
                bgColor = "bg-red-50 border-red-200";
                barColor = "bg-red-500";
                textColor = "text-red-700";
              } else if (isGlobalWarning) {
                bgColor = "bg-amber-50 border-amber-200";
                barColor = "bg-amber-500";
                textColor = "text-amber-700";
              }

              return (
                <div className={`${bgColor} border rounded-2xl p-6`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className={`text-sm font-bold ${textColor} uppercase tracking-tight`}>Limite Global por CPF</h3>
                      <p className="text-2xl font-black text-slate-800">{formatCurrency(totalFGC)} <span className="text-sm font-medium text-slate-400">/ R$ 1.000.000</span></p>
                    </div>
                    <span className={`text-xl font-black ${textColor}`}>{globalPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-4 bg-slate-200 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-500 ${barColor}`} style={{ width: `${globalPercentage}%` }} />
                  </div>
                  {isGlobalOver && (
                    <p className="mt-3 text-xs text-red-600 font-medium">
                      ⚠️ Você ultrapassou o limite global do FGC. O excedente de {formatCurrency(totalFGC - FGC_GLOBAL_LIMIT)} <strong>não está coberto</strong>.
                    </p>
                  )}
                  {isGlobalWarning && (
                    <p className="mt-3 text-xs text-amber-600 font-medium">
                      ⚡ Você está próximo do limite global do FGC. Considere diversificar em outros tipos de ativos.
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Cards por Banco */}
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-8">Exposição por Instituição</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {fgcExposure.length === 0 ? (<div className="col-span-full py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400"><ShieldCheck className="w-10 h-10 mb-2 opacity-20" /><p className="text-sm">Nenhum banco identificado.</p></div>) : (
                fgcExposure.map(([bank, total]) => <FGCCard key={bank} bank={bank} totalValue={total} />)
              )}
            </div>
          </div>
        )}
      </main>

      {/* Navigation Mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between z-50 shadow-lg">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}><LayoutDashboard className="w-5 h-5" /><span className="text-[10px] font-bold uppercase">Início</span></button>
        <button onClick={() => setActiveTab('investments')} className={`flex flex-col items-center gap-1 ${activeTab === 'investments' ? 'text-blue-600' : 'text-slate-400'}`}><List className="w-5 h-5" /><span className="text-[10px] font-bold uppercase">Ativos</span></button>
        <button onClick={() => setActiveTab('fgc')} className={`flex flex-col items-center gap-1 ${activeTab === 'fgc' ? 'text-blue-600' : 'text-slate-400'}`}><ShieldCheck className="w-5 h-5" /><span className="text-[10px] font-bold uppercase">FGC</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'text-blue-600' : 'text-slate-400'}`}><Settings className="w-5 h-5" /><span className="text-[10px] font-bold uppercase">Ajustes</span></button>
      </nav>
    </div>
  );
};

export default App;
