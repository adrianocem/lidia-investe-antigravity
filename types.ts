
export enum InvestmentTitle {
  CDB = 'CDB',
  LCI = 'LCI',
  LTN = 'LTN',
  NTNB = 'NTN-B'
}

export enum InvestmentType {
  CDI = 'CDI',
  IPCA = 'IPCA+',
  PREFIXADO = 'Prefixado'
}

export interface Investment {
  id: string;
  broker: string;
  bank: string;
  title: InvestmentTitle;
  type: InvestmentType;
  amount: number;
  quantity: number;
  interestRate: number; // Percentual (Ex: 110 para CDI, 12.5 para Prefixado)
  incomeTax: number;    // Percentual estimado (Ex: 15)
  startDate: string;    // ISO Date - Data da aplicação
  dueDate: string;      // ISO Date - Data de vencimento
  futureValue: number;     // Valor BRUTO (usado para FGC)
  netFutureValue: number;  // Valor LÍQUIDO (usado para patrimônio)
  createdAt: number;
}

export interface MarketRates {
  cdi: number;  // Anual (%)
  ipca: number; // Anual (%)
}
