import { supabase } from './supabase';
import type { Investment, MarketRates } from '../types';

// Converter de camelCase para snake_case (para o banco)
function toSnakeCase(investment: Investment) {
  return {
    id: investment.id,
    broker: investment.broker,
    bank: investment.bank,
    title: investment.title,
    type: investment.type,
    amount: investment.amount,
    quantity: investment.quantity,
    interest_rate: investment.interestRate,
    income_tax: investment.incomeTax,
    start_date: investment.startDate,
    due_date: investment.dueDate,
    future_value: investment.futureValue,
    net_future_value: investment.netFutureValue,
    created_at: new Date(investment.createdAt).toISOString(),
  };
}

// Converter de snake_case para camelCase (para o app)
function toCamelCase(row: any): Investment {
  return {
    id: row.id,
    broker: row.broker,
    bank: row.bank,
    title: row.title,
    type: row.type,
    amount: Number(row.amount),
    quantity: row.quantity,
    interestRate: Number(row.interest_rate),
    incomeTax: Number(row.income_tax),
    startDate: row.start_date,
    dueDate: row.due_date,
    futureValue: Number(row.future_value),
    netFutureValue: Number(row.net_future_value),
    createdAt: new Date(row.created_at).getTime(),
  } as Investment;
}

// ============ INVESTMENTS ============

export async function fetchInvestments(): Promise<Investment[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .order('due_date', { ascending: true });

  if (error) {
    console.error('Erro ao buscar investimentos:', error);
    return [];
  }

  return data?.map(toCamelCase) || [];
}

export async function addInvestment(investment: Investment): Promise<Investment | null> {
  const { data, error } = await supabase
    .from('investments')
    .insert(toSnakeCase(investment))
    .select()
    .single();

  if (error) {
    console.error('Erro ao adicionar investimento:', error);
    return null;
  }

  return data ? toCamelCase(data) : null;
}

export async function deleteInvestment(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Erro ao deletar investimento:', error);
    return false;
  }

  return true;
}

export async function updateInvestment(investment: Investment): Promise<Investment | null> {
  const { data, error } = await supabase
    .from('investments')
    .update(toSnakeCase(investment))
    .eq('id', investment.id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao atualizar investimento:', error);
    return null;
  }

  return data ? toCamelCase(data) : null;
}

// ============ MARKET RATES ============

export async function fetchMarketRates(): Promise<MarketRates> {
  const { data, error } = await supabase
    .from('market_rates')
    .select('*')
    .limit(1)
    .single();

  if (error || !data) {
    // Retorna valores padrão se não encontrar
    return { cdi: 11.25, ipca: 4.5 };
  }

  return { cdi: Number(data.cdi), ipca: Number(data.ipca) };
}

export async function saveMarketRates(rates: MarketRates): Promise<boolean> {
  // Primeiro, tenta encontrar um registro existente
  const { data: existing } = await supabase
    .from('market_rates')
    .select('id')
    .limit(1)
    .single();

  if (existing) {
    // Atualiza o registro existente
    const { error } = await supabase
      .from('market_rates')
      .update({ cdi: rates.cdi, ipca: rates.ipca, updated_at: new Date().toISOString() })
      .eq('id', existing.id);

    if (error) {
      console.error('Erro ao atualizar taxas:', error);
      return false;
    }
  } else {
    // Cria um novo registro
    const { error } = await supabase
      .from('market_rates')
      .insert({ cdi: rates.cdi, ipca: rates.ipca });

    if (error) {
      console.error('Erro ao criar taxas:', error);
      return false;
    }
  }

  return true;
}
