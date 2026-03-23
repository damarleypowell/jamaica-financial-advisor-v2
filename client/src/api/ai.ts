import api from './client';
import type { ChatMessage } from '@/types';

export async function chat(messages: ChatMessage[], context?: string): Promise<{ response: string }> {
  const { data } = await api.post('/api/chat', { messages, context });
  return data;
}

export async function analyze(userInput: string, experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced'): Promise<Record<string, unknown>> {
  const { data } = await api.post('/analyze', { user_input: userInput, experience_level: experienceLevel });
  return data;
}

export async function financialPlan(params: {
  goals: string;
  riskTolerance: string | number;
  currentSavings?: number;
  monthlyContribution?: number;
  timeHorizon?: string | number;
  portfolio?: unknown[];
}): Promise<Record<string, unknown>> {
  const { data } = await api.post('/api/financial-plan', params);
  return data;
}

export async function optimizePortfolio(positions: unknown[]): Promise<Record<string, unknown>> {
  const { data } = await api.post('/api/portfolio/optimize', { positions });
  return data;
}
