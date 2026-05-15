import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '../../lib/api';
import MarkdownRenderer from '../../components/ui/MarkdownRenderer';

type PlannerMode = 'retirement' | 'goal' | 'budget';

const fmtCur = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'JMD', minimumFractionDigits: 0, maximumFractionDigits: 0 });

function compoundGrowth(principal: number, rate: number, years: number, monthly: number): number {
  const r = rate / 100 / 12;
  const n = years * 12;
  const futureP = principal * Math.pow(1 + r, n);
  const futureC = r > 0 ? monthly * ((Math.pow(1 + r, n) - 1) / r) : monthly * n;
  return futureP + futureC;
}

function Field({ label, value, onChange, type = 'number', suffix }: { label: string; value: string; onChange: (v: string) => void; type?: string; suffix?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)', marginBottom: 6 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          style={{ width: '100%', height: 38, padding: suffix ? '0 36px 0 12px' : '0 12px', borderRadius: 9, fontSize: 13, fontFamily: 'var(--font-mono)', background: 'rgba(255,255,255,.05)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(0,230,118,.4)'}
          onBlur={e => (e.target as HTMLElement).style.borderColor = 'var(--color-border)'}
        />
        {suffix && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--color-muted)' }}>{suffix}</span>}
      </div>
    </div>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{label}</span>
      <span style={{ fontSize: highlight ? 18 : 13, fontWeight: highlight ? 900 : 600, fontFamily: 'var(--font-mono)', color: highlight ? '#00e676' : 'var(--color-text)' }}>{value}</span>
    </div>
  );
}

export default function Planner() {
  const [mode, setMode] = useState<PlannerMode>('retirement');

  // Retirement state
  const [currentAge, setCurrentAge] = useState('30');
  const [retirementAge, setRetirementAge] = useState('65');
  const [monthlySaving, setMonthlySaving] = useState('50000');
  const [currentSavings, setCurrentSavings] = useState('500000');
  const [expectedReturn, setExpectedReturn] = useState('10');
  const [inflation, setInflation] = useState('5');

  // Goal state
  const [targetAmount, setTargetAmount] = useState('5000000');
  const [goalYears, setGoalYears] = useState('5');
  const [goalInitial, setGoalInitial] = useState('100000');
  const [goalMonthly, setGoalMonthly] = useState('50000');
  const [goalReturn, setGoalReturn] = useState('12');

  // Budget state
  const [income, setIncome] = useState('300000');
  const [essentials, setEssentials] = useState('120000');
  const [savings, setSavings] = useState('60000');
  const [leisure, setLeisure] = useState('60000');

  // AI plan mutation
  const aiPlan = useMutation({
    mutationFn: (prompt: string) => apiPost<{ plan: string }>('/api/chat', { messages: [{ role: 'user', content: prompt }] }),
  });

  // Retirement calc
  const years = Math.max(0, parseInt(retirementAge) - parseInt(currentAge));
  const retirementFuture = compoundGrowth(parseFloat(currentSavings), parseFloat(expectedReturn), years, parseFloat(monthlySaving));
  const realReturn = Math.max(0, parseFloat(expectedReturn) - parseFloat(inflation));
  const retirementReal = compoundGrowth(parseFloat(currentSavings), realReturn, years, parseFloat(monthlySaving));
  const totalContributions = parseFloat(currentSavings) + parseFloat(monthlySaving) * years * 12;

  // Goal calc
  const goalFuture = compoundGrowth(parseFloat(goalInitial), parseFloat(goalReturn), parseInt(goalYears), parseFloat(goalMonthly));
  const goalTarget = parseFloat(targetAmount);
  const goalMet = goalFuture >= goalTarget;
  const monthlyNeeded = goalTarget > 0 && parseInt(goalYears) > 0
    ? Math.max(0, (goalTarget - parseFloat(goalInitial) * Math.pow(1 + parseFloat(goalReturn)/100/12, parseInt(goalYears)*12)) / (((Math.pow(1 + parseFloat(goalReturn)/100/12, parseInt(goalYears)*12) - 1) / (parseFloat(goalReturn)/100/12)) || 1))
    : 0;

  // Budget
  const totalIncome = parseFloat(income) || 0;
  const essentialsPct = totalIncome > 0 ? (parseFloat(essentials) / totalIncome * 100).toFixed(1) : '0';
  const savingsPct = totalIncome > 0 ? (parseFloat(savings) / totalIncome * 100).toFixed(1) : '0';
  const leisurePct = totalIncome > 0 ? (parseFloat(leisure) / totalIncome * 100).toFixed(1) : '0';
  const remaining = totalIncome - (parseFloat(essentials) + parseFloat(savings) + parseFloat(leisure));

  const MODES: { key: PlannerMode; label: string; icon: string }[] = [
    { key: 'retirement', label: 'Retirement', icon: 'fa-umbrella-beach' },
    { key: 'goal', label: 'Goal Planner', icon: 'fa-bullseye' },
    { key: 'budget', label: 'Budget', icon: 'fa-wallet' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--color-text)' }}>Financial Planner</h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>AI-powered financial planning tools for the Caribbean investor</p>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '4px', borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid var(--color-border)', width: 'fit-content' }}>
        {MODES.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 150ms', background: mode === m.key ? 'var(--color-green)' : 'transparent', color: mode === m.key ? 'var(--color-bg)' : 'var(--color-muted)', boxShadow: mode === m.key ? '0 2px 10px rgba(0,230,118,.3)' : 'none' }}>
            <i className={`fa-solid ${m.icon}`} style={{ fontSize: 11 }} />{m.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="lg:grid-cols-2 grid-cols-1">

        {/* Left: Inputs */}
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
            <i className={`fa-solid ${MODES.find(m => m.key === mode)?.icon} mr-2`} style={{ marginRight: 8 }} />
            {MODES.find(m => m.key === mode)?.label}
          </h3>

          {mode === 'retirement' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Current Age" value={currentAge} onChange={setCurrentAge} />
                <Field label="Retirement Age" value={retirementAge} onChange={setRetirementAge} />
              </div>
              <Field label="Current Savings (JMD)" value={currentSavings} onChange={setCurrentSavings} />
              <Field label="Monthly Contribution (JMD)" value={monthlySaving} onChange={setMonthlySaving} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Expected Annual Return" value={expectedReturn} onChange={setExpectedReturn} suffix="%" />
                <Field label="Inflation Rate" value={inflation} onChange={setInflation} suffix="%" />
              </div>
            </>
          )}

          {mode === 'goal' && (
            <>
              <Field label="Target Amount (JMD)" value={targetAmount} onChange={setTargetAmount} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Time Horizon" value={goalYears} onChange={setGoalYears} suffix="yrs" />
                <Field label="Expected Annual Return" value={goalReturn} onChange={setGoalReturn} suffix="%" />
              </div>
              <Field label="Initial Amount (JMD)" value={goalInitial} onChange={setGoalInitial} />
              <Field label="Monthly Contribution (JMD)" value={goalMonthly} onChange={setGoalMonthly} />
            </>
          )}

          {mode === 'budget' && (
            <>
              <Field label="Monthly Income (JMD)" value={income} onChange={setIncome} />
              <Field label="Essential Expenses" value={essentials} onChange={setEssentials} />
              <Field label="Savings / Investments" value={savings} onChange={setSavings} />
              <Field label="Leisure / Discretionary" value={leisure} onChange={setLeisure} />
            </>
          )}

          <button onClick={() => {
            let prompt = '';
            if (mode === 'retirement') prompt = `I am ${currentAge} years old and want to retire at ${retirementAge}. I have JMD ${currentSavings} saved and can contribute JMD ${monthlySaving}/month. Expected return ${expectedReturn}%, inflation ${inflation}%. Projected nest egg: JMD ${retirementFuture.toFixed(0)}. Give me a concise Caribbean-specific retirement plan and 3 actionable recommendations.`;
            else if (mode === 'goal') prompt = `I want to accumulate JMD ${targetAmount} in ${goalYears} years. Starting with JMD ${goalInitial}, contributing JMD ${goalMonthly}/month at ${goalReturn}% return. Projected: JMD ${goalFuture.toFixed(0)}. Give concise advice and JSE/Caribbean investment options to achieve this goal.`;
            else prompt = `Monthly income: JMD ${income}. Expenses: JMD ${essentials} essential, JMD ${savings} savings, JMD ${leisure} leisure. Remaining: JMD ${remaining.toFixed(0)}. Analyze this budget and give 3 specific Caribbean-focused improvements.`;
            aiPlan.mutate(prompt);
          }}
            style={{ marginTop: 4, width: '100%', height: 40, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(0,230,118,.2)', background: 'rgba(0,230,118,.1)', color: '#00e676', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 200ms' } as any}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,230,118,.2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(0,230,118,.1)'}
          >
            <i className="fa-solid fa-robot" style={{ fontSize: 11 }} />
            {aiPlan.isPending ? 'Generating AI Advice...' : 'Get AI Financial Advice'}
          </button>
        </div>

        {/* Right: Results */}
        <div style={{ background: 'var(--color-bg2)', border: '1px solid var(--color-border)', borderRadius: 14, padding: '20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>Projections</h3>

          {mode === 'retirement' && (
            <>
              <ResultRow label="Years to retirement" value={`${years} years`} />
              <ResultRow label="Total contributions" value={fmtCur(totalContributions)} />
              <ResultRow label="Projected nest egg (nominal)" value={fmtCur(retirementFuture)} highlight />
              <ResultRow label="Projected nest egg (inflation-adj.)" value={fmtCur(retirementReal)} />
              <ResultRow label="Investment growth" value={`${((retirementFuture / totalContributions - 1) * 100).toFixed(1)}%`} />
              {/* Progress bar */}
              <div style={{ marginTop: 16, padding: '12px 0', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>Today</span>
                  <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>Retirement</span>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (0 / years) * 100)}%`, background: 'var(--color-green)', borderRadius: 99, transition: 'width .5s' }} />
                </div>
              </div>
            </>
          )}

          {mode === 'goal' && (
            <>
              <ResultRow label="Target" value={fmtCur(goalTarget)} />
              <ResultRow label="Projected amount" value={fmtCur(goalFuture)} highlight />
              <ResultRow label="Goal status" value={goalMet ? '✓ Achieved' : '✗ Shortfall'} />
              {!goalMet && <ResultRow label="Monthly needed to meet goal" value={fmtCur(monthlyNeeded)} />}
              <ResultRow label="Total invested" value={fmtCur(parseFloat(goalInitial) + parseFloat(goalMonthly) * parseInt(goalYears) * 12)} />
              <ResultRow label="Investment growth" value={`${((goalFuture / Math.max(1, parseFloat(goalInitial) + parseFloat(goalMonthly) * parseInt(goalYears) * 12) - 1) * 100).toFixed(1)}%`} />
              <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: goalMet ? 'rgba(0,230,118,.08)' : 'rgba(255,82,82,.08)', border: `1px solid ${goalMet ? 'rgba(0,230,118,.2)' : 'rgba(255,82,82,.2)'}` }}>
                <p style={{ margin: 0, fontSize: 11, color: goalMet ? '#00e676' : '#ff5252', fontWeight: 700 }}>
                  {goalMet ? `On track — surplus of ${fmtCur(goalFuture - goalTarget)}` : `Shortfall of ${fmtCur(goalTarget - goalFuture)} — increase monthly contribution by ${fmtCur(monthlyNeeded - parseFloat(goalMonthly))}`}
                </p>
              </div>
            </>
          )}

          {mode === 'budget' && (
            <>
              <ResultRow label="Monthly income" value={fmtCur(totalIncome)} />
              <ResultRow label={`Essentials (${essentialsPct}%)`} value={fmtCur(parseFloat(essentials))} />
              <ResultRow label={`Savings (${savingsPct}%)`} value={fmtCur(parseFloat(savings))} />
              <ResultRow label={`Leisure (${leisurePct}%)`} value={fmtCur(parseFloat(leisure))} />
              <ResultRow label="Remaining / Unallocated" value={fmtCur(remaining)} highlight />
              {/* 50/30/20 check */}
              <div style={{ marginTop: 12, padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid var(--color-border)' }}>
                <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--color-muted)' }}>50/30/20 Rule Check</p>
                {[
                  { label: 'Essentials (target 50%)', actual: parseFloat(essentialsPct), target: 50 },
                  { label: 'Leisure (target 30%)', actual: parseFloat(leisurePct), target: 30 },
                  { label: 'Savings (target 20%)', actual: parseFloat(savingsPct), target: 20 },
                ].map(item => (
                  <div key={item.label} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--color-muted)' }}>{item.label}</span>
                      <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: Math.abs(item.actual - item.target) <= 5 ? '#00e676' : '#ffd740' }}>{item.actual}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, item.actual / (item.target * 2) * 100)}%`, background: Math.abs(item.actual - item.target) <= 5 ? '#00e676' : '#ffd740', borderRadius: 99 }} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Advice */}
      {(aiPlan.data || aiPlan.isPending) && (
        <div style={{ background: 'var(--color-bg2)', border: '1px solid rgba(0,230,118,.2)', borderRadius: 14, padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,118,.1)' }}>
              <i className="fa-solid fa-robot" style={{ fontSize: 13, color: '#00e676' }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#00e676' }}>AI Financial Advice</h3>
          </div>
          {aiPlan.isPending ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-muted)', fontSize: 12 }}>
              <i className="fa-solid fa-spinner fa-spin" /> Generating personalized advice...
            </div>
          ) : (
            <MarkdownRenderer content={(aiPlan.data as any)?.response ?? (aiPlan.data as any)?.content ?? JSON.stringify(aiPlan.data)} />
          )}
        </div>
      )}
    </div>
  );
}
