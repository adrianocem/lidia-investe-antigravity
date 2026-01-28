import React, { useState, useEffect } from 'react';
import { Investment, InvestmentTitle, InvestmentType, MarketRates } from '../types';
import { calculateFutureValue, CalculationResult } from '../utils/calculations';
import { fetchCustomBanks, addCustomBank, CustomBank } from '../services/bankService';
import { PlusCircle, Pencil, Info, Plus } from 'lucide-react';

interface Props {
  onAdd: (investment: Investment) => void;
  onUpdate: (investment: Investment) => void;
  marketRates: MarketRates;
  editingInvestment: Investment | null;
}

const MAJOR_BROKERS = [
  "XP Investimentos", "Rico", "Clear", "BTG Pactual", "Nubank",
  "Inter Invest", "Ágora Investimentos", "Genial Investimentos",
  "Toro Investimentos", "Órama", "ModalMais", "Guide Investimentos",
  "Avenue", "Nomad", "Warren", "Banco Inter", "C6 Bank",
  "Sofisa Direto", "Banco do Brasil", "Caixa Econômica Federal",
  "Bradesco", "Itaú Unibanco", "Santander"
].sort();

const MAJOR_BANKS = [
  "Banco do Brasil", "Bradesco", "Itaú Unibanco", "Santander",
  "Caixa Econômica Federal", "Banco Inter", "BTG Pactual",
  "Banco Safra", "Banco Daycoval", "Banco Pan", "Banco BMG",
  "Banco ABC Brasil", "Banco Pine", "Banco Original",
  "Banco Modal", "Banco Master", "Banco XP", "C6 Bank",
  "Nubank", "Sofisa Direto", "Banco Bari", "Banco Agibank"
].sort();

export const InvestmentForm: React.FC<Props> = ({ onAdd, onUpdate, marketRates, editingInvestment }) => {
  const [formData, setFormData] = useState<Partial<Investment>>({
    broker: '',
    bank: '',
    title: InvestmentTitle.CDB,
    type: InvestmentType.CDI,
    amount: 0,
    quantity: 1,
    interestRate: 100,
    incomeTax: 15,
    startDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const [fvPreview, setFvPreview] = useState<CalculationResult>({ gross: 0, net: 0 });
  const [customBanks, setCustomBanks] = useState<CustomBank[]>([]);
  const [showCustomBroker, setShowCustomBroker] = useState(false);
  const [showCustomBank, setShowCustomBank] = useState(false);
  const [newBrokerName, setNewBrokerName] = useState('');
  const [newBankName, setNewBankName] = useState('');

  // Load custom banks on mount
  useEffect(() => {
    fetchCustomBanks().then(setCustomBanks);
  }, []);

  useEffect(() => {
    if (editingInvestment) {
      setFormData({
        ...editingInvestment,
        startDate: new Date(editingInvestment.startDate).toISOString().split('T')[0],
        dueDate: new Date(editingInvestment.dueDate).toISOString().split('T')[0],
      });
    } else {
      setFormData({
        broker: '',
        bank: '',
        title: InvestmentTitle.CDB,
        type: InvestmentType.CDI,
        amount: 0,
        quantity: 1,
        interestRate: 100,
        incomeTax: 15,
        startDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }
  }, [editingInvestment]);

  useEffect(() => {
    const results = calculateFutureValue(formData, marketRates);
    setFvPreview(results);
  }, [formData, marketRates]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.broker || !formData.bank || !formData.amount) return;

    const investmentData: Investment = {
      ...(formData as Investment),
      id: editingInvestment ? editingInvestment.id : crypto.randomUUID(),
      futureValue: fvPreview.gross,
      netFutureValue: fvPreview.net,
      createdAt: editingInvestment ? editingInvestment.createdAt : Date.now(),
    };

    if (editingInvestment) {
      onUpdate(investmentData);
    } else {
      onAdd(investmentData);
    }

    setFormData({
      broker: '',
      bank: '',
      title: InvestmentTitle.CDB,
      type: InvestmentType.CDI,
      amount: 0,
      quantity: 1,
      interestRate: 100,
      incomeTax: 15,
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  };

  const selectClass = "w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm appearance-none";
  const inputClass = "w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm";
  const labelClass = "block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
          {editingInvestment ? (
            <Pencil className="w-5 h-5 text-amber-600" />
          ) : (
            <PlusCircle className="w-5 h-5 text-blue-600" />
          )}
          {editingInvestment ? 'Editar Ativo' : 'Adicionar Ativo'}
        </h2>
        {editingInvestment && (
          <button
            type="button"
            onClick={() => onUpdate(null as any)}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
          >
            Cancelar Edição
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          <div>
            <label className={labelClass}>Corretora</label>
            {showCustomBroker ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Digite o nome da corretora"
                  className={inputClass}
                  value={newBrokerName}
                  onChange={e => setNewBrokerName(e.target.value)}
                  onBlur={async () => {
                    if (newBrokerName.trim()) {
                      const saved = await addCustomBank(newBrokerName, true);
                      if (saved) {
                        setCustomBanks(prev => [...prev, saved]);
                        setFormData({ ...formData, broker: saved.name });
                      }
                    }
                    setShowCustomBroker(false);
                    setNewBrokerName('');
                  }}
                  autoFocus
                />
                <button type="button" onClick={() => { setShowCustomBroker(false); setNewBrokerName(''); }} className="px-3 py-2 text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <select
                  required
                  className={selectClass}
                  value={formData.broker}
                  onChange={e => {
                    if (e.target.value === '__ADD_NEW__') {
                      setShowCustomBroker(true);
                    } else {
                      setFormData({ ...formData, broker: e.target.value });
                    }
                  }}
                >
                  <option value="" disabled>Selecione a corretora</option>
                  {[...MAJOR_BROKERS, ...customBanks.filter(b => b.isBroker).map(b => b.name)].sort().map(broker => <option key={broker} value={broker}>{broker}</option>)}
                  <option value="__ADD_NEW__">+ Adicionar outra...</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Banco Emissor</label>
            {showCustomBank ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Digite o nome do banco"
                  className={inputClass}
                  value={newBankName}
                  onChange={e => setNewBankName(e.target.value)}
                  onBlur={async () => {
                    if (newBankName.trim()) {
                      const saved = await addCustomBank(newBankName, false);
                      if (saved) {
                        setCustomBanks(prev => [...prev, saved]);
                        setFormData({ ...formData, bank: saved.name });
                      }
                    }
                    setShowCustomBank(false);
                    setNewBankName('');
                  }}
                  autoFocus
                />
                <button type="button" onClick={() => { setShowCustomBank(false); setNewBankName(''); }} className="px-3 py-2 text-slate-400 hover:text-slate-600">
                  ✕
                </button>
              </div>
            ) : (
              <div className="relative">
                <select
                  required
                  className={selectClass}
                  value={formData.bank}
                  onChange={e => {
                    if (e.target.value === '__ADD_NEW__') {
                      setShowCustomBank(true);
                    } else {
                      setFormData({ ...formData, bank: e.target.value });
                    }
                  }}
                >
                  <option value="" disabled>Selecione o banco</option>
                  {[...MAJOR_BANKS, ...customBanks.filter(b => !b.isBroker).map(b => b.name)].sort().map(bank => <option key={bank} value={bank}>{bank}</option>)}
                  <option value="__ADD_NEW__">+ Adicionar outro...</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Título</label>
            <div className="relative">
              <select className={selectClass} value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value as InvestmentTitle })}>
                {Object.values(InvestmentTitle).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Rentabilidade</label>
            <div className="relative">
              <select className={selectClass} value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as InvestmentType })}>
                {Object.values(InvestmentType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Valor Aplicado (R$)</label>
            <input type="number" required step="0.01" className={inputClass} value={formData.amount || ''} onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })} />
          </div>

          <div>
            <label className={labelClass}>Quantidade (Informal)</label>
            <input type="number" required step="1" min="1" className={inputClass} value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })} />
          </div>

          <div>
            <label className={labelClass}>Taxa de Juros (%)</label>
            <div className="relative">
              <input type="number" required step="0.01" className={inputClass} value={formData.interestRate || ''} onChange={e => setFormData({ ...formData, interestRate: parseFloat(e.target.value) })} />
              <span className="absolute right-3 top-3 text-[10px] text-slate-400 bg-white pl-1 font-bold">
                {formData.type === InvestmentType.CDI ? '% CDI' : '% a.a.'}
              </span>
            </div>
          </div>

          <div>
            <label className={labelClass}>Data de Aplicação</label>
            <input type="date" required className={inputClass} value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
          </div>

          <div>
            <label className={labelClass}>Vencimento</label>
            <input type="date" required className={inputClass} value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
          </div>

          <div>
            <label className={labelClass}>IR Estimado (%)</label>
            <div className="relative">
              <input type="number" required step="0.5" min="0" max="22.5" className={inputClass} value={formData.incomeTax || ''} onChange={e => setFormData({ ...formData, incomeTax: parseFloat(e.target.value) })} />
              <span className="absolute right-3 top-3 text-[10px] text-slate-400 bg-white pl-1 font-bold">% IR</span>
            </div>
          </div>
        </div>

        <div className="mt-6 p-5 bg-blue-50 rounded-2xl flex flex-col items-center justify-between border border-blue-100 gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="bg-blue-600 p-2.5 rounded-xl text-white">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">Valor Líquido Futuro Estimado</p>
              <p className="text-2xl font-black text-blue-900 leading-none">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fvPreview.net)}
              </p>
            </div>
          </div>
          <button
            type="submit"
            className={`w-full sm:w-auto px-8 py-3.5 ${editingInvestment ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold rounded-xl shadow-lg transition-all active:scale-95`}
          >
            {editingInvestment ? 'Salvar Alterações' : 'Confirmar Investimento'}
          </button>
        </div>
      </form>
    </div>
  );
};
