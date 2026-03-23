import api from './client';
import type { PortfolioMetrics, BacktestRequest, BacktestResult } from '@/types';

export async function getTechnicalIndicators(symbol: string): Promise<Record<string, unknown>> {
  const { data } = await api.get(`/api/analytics/technical/${symbol}`);
  return data;
}

export async function getAdvancedTechnicals(symbol: string): Promise<Record<string, unknown>> {
  const { data } = await api.get(`/api/analytics/technical/${symbol}/advanced`);
  return data;
}

export async function getPortfolioAnalytics(positions: { symbol: string; shares: number; avgCost: number }[]): Promise<PortfolioMetrics> {
  const { data } = await api.post('/api/analytics/portfolio', { positions });
  return data;
}

export async function runBacktest(params: BacktestRequest): Promise<BacktestResult> {
  const { data } = await api.post('/api/analytics/backtest', params);
  return data;
}

export async function compoundGrowth(params: {
  principal: number;
  monthlyContribution: number;
  annualRate: number;
  years: number;
}): Promise<Record<string, unknown>> {
  const { data } = await api.post('/api/analytics/compound-growth', params);
  return data;
}

export async function retirementCalc(params: {
  currentAge: number;
  retirementAge: number;
  monthlyExpenses: number;
  inflationRate?: number;
}): Promise<Record<string, unknown>> {
  const { data } = await api.post('/api/analytics/retirement', params);
  return data;
}

export async function loanCalc(params: {
  principal: number;
  annualRate: number;
  years: number;
}): Promise<Record<string, unknown>> {
  const { data } = await api.post('/api/analytics/loan', params);
  return data;
}

export async function getPrediction(symbol: string): Promise<Record<string, unknown>> {
  const { data } = await api.get(`/api/analytics/predict/${symbol}`);
  return data;
}

export async function getScreener(filters: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data } = await api.post('/api/analytics/screener', filters);
  return data;
}
