import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen, ChevronRight, ChevronLeft, CheckCircle, Clock,
  TrendingUp, Award, Zap, Play,
  ExternalLink, HelpCircle, FileText, Activity, Wifi,
} from 'lucide-react';
import InteractiveSimulators, {
  CandlestickSim, MovingAverageSim, RSISim, PEComparisonSim,
  RiskProfileSim, CompoundGrowthSim, DiversificationSim,
} from './LearnSimulators';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExternalLink { title: string; url: string; description: string; }

// Live quote used by the interactive lesson exercises (from GET /api/stocks).
interface LiveLearnStock {
  symbol?: string; name?: string;
  price: number; prevClose: number;
  high52?: number; low52?: number; volume?: number;
}

interface QuizQ {
  q: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface Callout { type: 'tip' | 'warning' | 'info' | 'example'; text: string; }

interface ExerciseStep { instruction: string; answer: string; }

interface ModuleContent {
  paragraphs?: string[];
  keyTerms?: { term: string; def: string }[];
  callouts?: Callout[];
  diagramKey?: string;
  diagramCaption?: string;
  exercise?: { scenario: string; steps: ExerciseStep[]; liveData?: boolean };
  quiz?: QuizQ[];
  links?: ExternalLink[];
  citations?: string[];
}

interface Module {
  id: string;
  title: string;
  type: 'lesson' | 'exercise' | 'quiz';
  duration: number;
  content: ModuleContent;
}

interface Course {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  color: string;
  tag?: string;
  estimatedHours: number;
  modules: Module[];
}

// ── Course Data ───────────────────────────────────────────────────────────────

const COURSES: Course[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // COURSE 1: Caribbean Markets 101
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'caribbean-basics',
    title: 'Caribbean Markets 101',
    subtitle: 'Your first step into investing',
    description: 'Understand how Caribbean stock exchanges work, how to read stock data, and how to think about your first investment.',
    level: 'Beginner',
    color: '#00e676',
    tag: 'Start Here',
    estimatedHours: 4,
    modules: [
      {
        id: 'cb-what-is-investing',
        title: 'What Is Investing?',
        type: 'lesson',
        duration: 8,
        content: {
          paragraphs: [
            'Investing is putting money to work so it grows over time. Unlike leaving cash in a savings account — where inflation slowly erodes its purchasing power — investing means you own a piece of a real business, and you benefit as that business grows and generates profit.',
            'In Jamaica, the inflation rate has averaged 5–8% per year over the past decade. A savings account paying 2% interest actually loses you money in real terms. Meanwhile, the Jamaica Stock Exchange (JSE) has delivered average annual returns exceeding 20% in some years, making it one of the best-performing exchanges in the world for its size.',
            'When you buy shares in a company listed on the JSE, you become a part-owner. If the company earns more profit, your shares become more valuable. If the company pays dividends, you receive a portion of those profits in cash — directly into your brokerage account. The goal of this course is to teach you how to identify which companies are worth owning and when.',
          ],
          keyTerms: [
            { term: 'Stock / Share', def: 'A unit of ownership in a company. Owning 100 shares of GraceKennedy means you own a small fraction of that entire business.' },
            { term: 'Dividend', def: 'A cash payment made by a company to its shareholders, usually quarterly or annually, from its profits.' },
            { term: 'Capital Appreciation', def: 'The increase in a stock\'s price over time. If you bought GK at $70 and it rises to $100, your $30 gain is capital appreciation.' },
            { term: 'Inflation', def: 'The rate at which prices rise each year. If inflation is 7% and your savings account pays 2%, you\'re losing 5% in real purchasing power.' },
          ],
          callouts: [
            { type: 'info', text: 'The JSE All Jamaican Composite Index returned over 300% between 2013 and 2023 — outperforming most global stock markets over the same period.' },
            { type: 'tip', text: 'You don\'t need to be rich to start investing. Some JSE stocks trade for under J$10 per share. Starting small and learning is better than waiting until you have "enough" money.' },
          ],
          links: [
            { title: 'Jamaica Stock Exchange — Getting Started', url: 'https://www.jamstockex.com/invest/', description: 'Official JSE guide for first-time investors.' },
            { title: 'FSC Jamaica — Investor Education', url: 'https://www.fscommission.gov.jm/investor-education', description: 'Financial Services Commission educational resources.' },
          ],
          citations: [
            'Jamaica Stock Exchange Annual Report 2023 — Performance Review.',
            'Bank of Jamaica: Consumer Price Index Historical Data (2013–2023).',
          ],
        },
      },
      {
        id: 'cb-exchanges',
        title: 'Caribbean Stock Exchanges: JSE, TTSE & ECSE',
        type: 'lesson',
        duration: 12,
        content: {
          paragraphs: [
            'The Caribbean has four main stock exchanges where you can invest. Each serves a different country or region and lists different companies. Understanding which exchange a company trades on matters because it affects currency, trading hours, and the rules that govern disclosures.',
            'The Jamaica Stock Exchange (JSE), founded in 1969, is the oldest and largest in the English-speaking Caribbean. It lists approximately 40 companies across financials, manufacturing, distribution, and tourism. It also has a Junior Market for smaller growing companies, with tax incentives that make Junior Market IPOs especially popular.',
            'The Trinidad and Tobago Stock Exchange (TTSE) is the second-largest, listing companies like Republic Financial Holdings and Guardian Media. Many Trinidadian companies are regionally significant — Republic Bank, for example, operates across multiple Caribbean territories. The TTSE uses TT Dollars (TTD).',
            'The Eastern Caribbean Securities Exchange (ECSE) serves eight island nations — Antigua, Dominica, Grenada, Montserrat, St Kitts, St Lucia, St Vincent, and Anguilla. It is smaller but growing. The Barbados Stock Exchange (BSE) serves Barbados and lists companies like Massy Holdings and Goddard Enterprises.',
          ],
          diagramKey: 'exchanges',
          diagramCaption: 'Caribbean exchanges by country, currency, and approximate number of listed companies.',
          keyTerms: [
            { term: 'JSE Junior Market', def: 'A segment of the JSE for smaller companies with annual tax relief for 10 years post-listing. A proven launchpad for fast-growing Jamaican businesses.' },
            { term: 'Settlement', def: 'The process of transferring shares and money after a trade. JSE settles in T+2 (two business days after the trade date).' },
            { term: 'Market Maker', def: 'A broker who quotes both buy and sell prices to ensure liquidity in a stock, making it easier for investors to trade.' },
          ],
          callouts: [
            { type: 'example', text: 'NCB Financial Group (NCBFG) is listed on the JSE and trades in Jamaican Dollars. Guardian Holdings is listed on the TTSE and trades in TT Dollars. If you buy both, you\'re exposed to two currencies.' },
            { type: 'tip', text: 'JSE trading hours are 9:30 AM – 1:30 PM Jamaica Standard Time (UTC-5), Monday through Friday. The JSE is closed on Jamaican public holidays.' },
          ],
          links: [
            { title: 'Jamaica Stock Exchange', url: 'https://www.jamstockex.com', description: 'Official JSE website — stock prices, company filings, news.' },
            { title: 'TTSE — Trinidad & Tobago Stock Exchange', url: 'https://www.stockex.co.tt', description: 'Live prices and company information for TTSE listings.' },
            { title: 'Eastern Caribbean Securities Exchange', url: 'https://www.ecseonline.com', description: 'ECSE market data and listed companies.' },
            { title: 'Barbados Stock Exchange', url: 'https://www.bse.com.bb', description: 'BSE listings and daily market summaries.' },
          ],
        },
      },
      {
        id: 'cb-stock-quote',
        title: 'Reading a Stock Quote',
        type: 'lesson',
        duration: 10,
        content: {
          paragraphs: [
            'A stock quote is a real-time or delayed snapshot of a security\'s price and trading activity. Every number on a quote page tells you something specific. Knowing what each figure means is your most fundamental skill as an investor.',
            'The most important figures are: Last Price (the most recent transaction), Open (first trade of the day), High and Low (the day\'s price range), Volume (total shares traded), and Percentage Change (how much the price moved from yesterday\'s close). On Gotham, all these are shown when you click any stock card.',
            'The bid-ask spread is the gap between what buyers will pay (bid) and what sellers will accept (ask). On liquid stocks like NCB, this spread is tiny — maybe a few cents. On thinly traded Junior Market stocks, the spread can be J$2–5, meaning you immediately lose that amount the moment you buy.',
          ],
          diagramKey: 'quote',
          diagramCaption: 'Anatomy of a stock quote — every field explained with a GraceKennedy (GK) example.',
          keyTerms: [
            { term: 'Bid Price', def: 'The highest price a buyer is currently willing to pay for a share.' },
            { term: 'Ask Price', def: 'The lowest price a seller is currently willing to accept.' },
            { term: 'Spread', def: 'Ask minus Bid. A wide spread means lower liquidity and higher implicit cost to trade.' },
            { term: 'Volume', def: 'Total shares traded during the session. High volume on a price move confirms its validity.' },
            { term: '52-Week High/Low', def: 'The highest and lowest price the stock has traded at over the past year — useful context for whether the price is near historical extremes.' },
          ],
          callouts: [
            { type: 'warning', text: 'On low-volume JSE stocks, a single large buy order can move the price significantly. Always check volume before trading — a "price increase" on zero volume is meaningless.' },
            { type: 'example', text: 'GraceKennedy (GK): Last J$75.50 | Open J$74.00 | High J$76.00 | Low J$73.80 | Volume 45,200 | Change +2.03%' },
          ],
        },
      },
      {
        id: 'cb-exercise-quote',
        title: 'Exercise: Analyse a Stock Quote',
        type: 'exercise',
        duration: 10,
        content: {
          exercise: {
            scenario: 'You are looking at Wisynco Group Ltd (WISYNCO) on the JSE. The quote shows: Last Price J$22.50 | Previous Close J$21.80 | Open J$21.90 | High J$22.70 | Low J$21.75 | Volume 123,400 | 52-Week High J$28.00 | 52-Week Low J$18.50. Work through each question step by step.',
            steps: [
              {
                instruction: 'Step 1 — Calculate the percentage change from yesterday\'s close.',
                answer: 'Change = (22.50 – 21.80) / 21.80 × 100 = 0.70 / 21.80 × 100 ≈ +3.21%. The stock is up 3.21% on the day.',
              },
              {
                instruction: 'Step 2 — Is today\'s volume high or low? What does it tell you?',
                answer: '123,400 shares traded is relatively strong volume for a JSE mid-cap stock. This confirms that the price increase is backed by genuine buying interest — not just a single large order moving a thin market.',
              },
              {
                instruction: 'Step 3 — Where is the current price relative to its 52-week range?',
                answer: 'Range = J$28.00 – J$18.50 = J$9.50 wide. Current price J$22.50 is J$4.00 above the low and J$5.50 below the high. The stock is roughly in the middle of its 52-week range — not at an extreme. This is a neutral technical signal.',
              },
              {
                instruction: 'Step 4 — The stock opened at J$21.90, hit a low of J$21.75, then rallied to close at J$22.50. What does this intraday pattern suggest?',
                answer: 'The stock dipped early (low J$21.75 is below open J$21.90) then recovered strongly to close near the day\'s high (J$22.70). This is a bullish intraday pattern — sellers tried to push the price down but buyers overwhelmed them. A close near the day\'s high on strong volume is a positive short-term signal.',
              },
            ],
          },
          links: [
            { title: 'JSE Market Data — Wisynco', url: 'https://www.jamstockex.com/market-data/stocks/wisynco-group-limited/', description: 'Live Wisynco quote and historic data on the JSE website.' },
          ],
        },
      },
      {
        id: 'cb-live-exercise',
        title: 'Live Exercise: Analyse a Real JSE Stock',
        type: 'exercise',
        duration: 10,
        content: {
          exercise: {
            liveData: true,
            scenario: '',
            steps: [],
          },
          callouts: [
            { type: 'info', text: 'This exercise uses live JSE market data. The stock and numbers change every session — this is as close to real trading as you can get without committing capital.' },
          ],
        },
      },
      {
        id: 'cb-quiz',
        title: 'Module Quiz: Caribbean Markets Basics',
        type: 'quiz',
        duration: 10,
        content: {
          quiz: [
            {
              q: 'Which Caribbean stock exchange was founded first?',
              options: ['TTSE (Trinidad)', 'BSE (Barbados)', 'JSE (Jamaica)', 'ECSE (Eastern Caribbean)'],
              correct: 2,
              explanation: 'The Jamaica Stock Exchange (JSE) was founded in 1969, making it the oldest English-speaking Caribbean exchange. The TTSE was established in 1981.',
            },
            {
              q: 'If GraceKennedy has a Bid of J$74.50 and an Ask of J$75.20, what is the spread?',
              options: ['J$74.50', 'J$0.70', 'J$75.20', 'J$149.70'],
              correct: 1,
              explanation: 'Spread = Ask – Bid = 75.20 – 74.50 = J$0.70. This is the implicit cost of immediately entering and exiting a position.',
            },
            {
              q: 'A stock closes at J$50 on Monday and J$53 on Tuesday. What is the percentage change?',
              options: ['+3%', '+5.66%', '+6%', '+5%'],
              correct: 2,
              explanation: 'Change = (53 – 50) / 50 × 100 = 3 / 50 × 100 = 6%. Always divide by the starting price, not the ending price.',
            },
            {
              q: 'What is the main tax benefit of JSE Junior Market companies?',
              options: ['No corporation tax ever', '10-year corporation tax relief post-listing', 'Dividends are tax-free for investors', 'Stamp duty exemption on all trades'],
              correct: 1,
              explanation: 'Junior Market companies receive a 10-year income tax holiday after listing. The first 5 years are fully exempt, years 6–10 at 50% of the standard rate. This incentive makes Junior Market IPOs very popular.',
            },
            {
              q: 'High volume on a price increase generally indicates:',
              options: ['The increase is likely a data error', 'Strong buying conviction behind the move', 'The stock is about to reverse', 'Market manipulation'],
              correct: 1,
              explanation: 'Volume confirms price moves. A price increase on high volume means many buyers participated — it\'s a genuine signal. A price increase on very low volume could just be one small trade moving a thin market.',
            },
          ],
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COURSE 2: Fundamental Analysis
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'fundamental-analysis',
    title: 'Fundamental Analysis',
    subtitle: 'Read financial statements like a pro',
    description: 'Learn to analyse income statements, balance sheets, key ratios, and dividend history to determine whether a stock is worth buying.',
    level: 'Intermediate',
    color: '#40c4ff',
    estimatedHours: 6,
    modules: [
      {
        id: 'fa-income-statement',
        title: 'The Income Statement Explained',
        type: 'lesson',
        duration: 15,
        content: {
          paragraphs: [
            'The income statement (also called the Profit & Loss or P&L) shows how much money a company earned and spent over a specific period — usually a quarter or a full year. It answers the fundamental question: is this business actually making money?',
            'Revenue (or Turnover) is the top line — total sales before any costs are deducted. For GraceKennedy, this includes revenue from their banking subsidiary (NCB-linked businesses), food distribution, insurance, and manufacturing. Revenue growth year-over-year is the first thing to check: is the business expanding?',
            'After deducting Cost of Goods Sold (COGS) — the direct cost to produce what they sell — you get Gross Profit. Deducting operating expenses (salaries, rent, marketing) gives Operating Profit (EBIT). After interest payments and taxes, you reach Net Profit — the "bottom line." Earnings Per Share (EPS) is simply net profit divided by shares outstanding.',
          ],
          diagramKey: 'income-statement',
          diagramCaption: 'Income statement waterfall: from Revenue down to Net Profit, with each line explained.',
          keyTerms: [
            { term: 'Revenue', def: 'Total income from sales before any costs. Also called "turnover" or "top line."' },
            { term: 'Gross Profit Margin', def: 'Gross Profit ÷ Revenue. Shows how efficiently a company produces its product. Higher is better.' },
            { term: 'EBITDA', def: 'Earnings Before Interest, Taxes, Depreciation & Amortisation. Used to compare profitability across companies with different capital structures.' },
            { term: 'EPS (Earnings Per Share)', def: 'Net Profit ÷ Total Shares Outstanding. This is what the company earned per share you own.' },
            { term: 'Operating Leverage', def: 'How sensitive profits are to revenue changes. High fixed costs = high operating leverage = profits jump dramatically when revenue grows.' },
          ],
          callouts: [
            { type: 'example', text: 'GraceKennedy 2022: Revenue J$159B | Gross Profit J$52B | Net Profit J$14B | EPS J$5.38. Gross margin = 52/159 = 33% — meaning GK keeps 33 cents of every dollar in revenue after direct production costs.' },
            { type: 'warning', text: 'Revenue growth means nothing if costs grow faster. Always check whether net profit margin is expanding, stable, or shrinking over time.' },
          ],
          links: [
            { title: 'JSE Annual Reports — GraceKennedy', url: 'https://www.jamstockex.com/market-data/stocks/gracekennedy-limited/', description: 'GraceKennedy\'s full annual reports and quarterly financials.' },
            { title: 'Investopedia: Income Statement', url: 'https://www.investopedia.com/terms/i/incomestatement.asp', description: 'Detailed guide to every line of the income statement.' },
          ],
          citations: ['GraceKennedy Limited Annual Report 2022 — Financial Statements.'],
        },
      },
      {
        id: 'fa-balance-sheet',
        title: 'The Balance Sheet',
        type: 'lesson',
        duration: 12,
        content: {
          paragraphs: [
            'The balance sheet is a snapshot of what a company owns (assets), what it owes (liabilities), and what\'s left for shareholders (equity) at a specific date. The fundamental accounting equation: Assets = Liabilities + Equity. This always balances — hence the name.',
            'Current assets are things that will be converted to cash within a year: cash itself, accounts receivable (money owed by customers), and inventory. Current liabilities are obligations due within a year. The Current Ratio = Current Assets ÷ Current Liabilities — a ratio above 1.5 generally means the company can comfortably meet its short-term obligations.',
            'Long-term debt is the big risk area. Debt-to-Equity (D/E) ratio = Total Debt ÷ Shareholders\' Equity. A high D/E means the company is heavily reliant on borrowed money — fine during good times, dangerous when revenues fall. Caribbean banks tend to have naturally high D/E ratios due to their structure; compare within sectors only.',
          ],
          diagramKey: 'balance-sheet',
          diagramCaption: 'Balance sheet structure: Assets on the left, Liabilities + Equity on the right — always equal.',
          keyTerms: [
            { term: 'Current Ratio', def: 'Current Assets ÷ Current Liabilities. Measures short-term financial health. Below 1.0 is a red flag.' },
            { term: 'Debt-to-Equity (D/E)', def: 'Total Debt ÷ Shareholders\' Equity. High D/E amplifies both gains and losses.' },
            { term: 'Book Value Per Share', def: 'Total Equity ÷ Shares Outstanding. The theoretical value per share if the company were liquidated today.' },
            { term: 'Working Capital', def: 'Current Assets minus Current Liabilities. Positive working capital means the business can fund its day-to-day operations.' },
          ],
          callouts: [
            { type: 'tip', text: 'Goodwill on a balance sheet represents the premium paid for acquired companies. Goodwill is only worth something if the acquisition performs. Always question large goodwill figures on Caribbean conglomerates.' },
            { type: 'example', text: 'If NCB Financial Group has J$1.2 trillion in assets but J$1.05 trillion in liabilities (largely customer deposits), equity is J$150 billion. As a bank, this high leverage is normal — it\'s how banking works.' },
          ],
          links: [
            { title: 'Investopedia: Balance Sheet', url: 'https://www.investopedia.com/terms/b/balancesheet.asp', description: 'Complete guide to reading a balance sheet.' },
            { title: 'NCB Financial Group — Annual Reports', url: 'https://www.jamstockex.com/market-data/stocks/ncb-financial-group/', description: 'NCB\'s full financial statements on the JSE.' },
          ],
        },
      },
      {
        id: 'fa-ratios',
        title: 'Key Valuation Ratios',
        type: 'lesson',
        duration: 15,
        content: {
          paragraphs: [
            'Valuation ratios help you decide whether a stock is cheap, fair, or expensive relative to its earnings, book value, or cash flow. No single ratio tells the whole story — use them together and always compare within the same sector.',
            'The Price-to-Earnings (P/E) ratio is the most used metric: Share Price ÷ EPS. A P/E of 12 means you\'re paying J$12 for every J$1 of annual earnings. JSE financial sector stocks have historically traded at P/Es of 8–15x. If a stock trades at 25x when peers are at 10x, there needs to be a compelling growth reason.',
            'Price-to-Book (P/B) compares market price to book value per share. Banks and insurance companies are especially well-suited to P/B analysis. A P/B below 1.0 means the stock trades below what shareholders would theoretically receive if the company were dissolved — potentially a deep value opportunity or a sign of serious problems.',
          ],
          diagramKey: 'pe-comparison',
          diagramCaption: 'P/E ratio comparison across selected JSE stocks vs regional and global sector averages.',
          keyTerms: [
            { term: 'P/E Ratio', def: 'Price ÷ Earnings Per Share. The most common valuation metric. Compare only within the same sector.' },
            { term: 'P/B Ratio', def: 'Price ÷ Book Value Per Share. Especially useful for banks and asset-heavy companies.' },
            { term: 'Dividend Yield', def: 'Annual Dividends Per Share ÷ Price × 100. A 5% yield means you earn 5 cents for every dollar invested, just from dividends.' },
            { term: 'PEG Ratio', def: 'P/E ÷ Earnings Growth Rate. A PEG below 1.0 suggests the stock may be undervalued relative to its growth.' },
          ],
          callouts: [
            { type: 'warning', text: 'A very low P/E can signal a value trap — a company so troubled that earnings will collapse, making today\'s P/E misleading. Always ask why a stock is cheap.' },
            { type: 'example', text: 'If Sagicor Financial trades at J$50 with EPS of J$6.25, its P/E = 8x. If the sector average is 12x, the stock may be undervalued — or the market sees something concerning. Investigate before concluding it\'s a bargain.' },
            { type: 'tip', text: 'Use Gotham\'s AI Analysis tab to get instant ratio calculations and peer comparisons for any JSE or US stock.' },
          ],
          links: [
            { title: 'Finviz — US Stock Valuation Screener', url: 'https://finviz.com/screener.ashx', description: 'Screen US stocks by P/E, P/B, yield and 70+ other metrics.' },
            { title: 'Investopedia: P/E Ratio Guide', url: 'https://www.investopedia.com/terms/p/price-earningsratio.asp', description: 'Complete explanation with examples and limitations.' },
          ],
        },
      },
      {
        id: 'fa-exercise',
        title: 'Exercise: Analyse NCB Financial Group',
        type: 'exercise',
        duration: 15,
        content: {
          exercise: {
            scenario: 'NCB Financial Group (NCBFG) reports the following for FY2022: Revenue J$78B | Net Profit J$18.5B | Total Shares 2.86B | Share Price J$120 | Total Equity J$185B | Annual Dividend J$2.50/share. Work through each valuation step.',
            steps: [
              {
                instruction: 'Step 1 — Calculate Earnings Per Share (EPS).',
                answer: 'EPS = Net Profit ÷ Shares Outstanding = J$18,500,000,000 ÷ 2,860,000,000 = J$6.47 per share.',
              },
              {
                instruction: 'Step 2 — Calculate the P/E ratio and interpret it.',
                answer: 'P/E = Price ÷ EPS = J$120 ÷ J$6.47 = 18.5x. This means investors are paying J$18.50 for every J$1 of annual earnings. For a Caribbean financial conglomerate with regional operations, this is in the upper range — implying expectations of continued growth.',
              },
              {
                instruction: 'Step 3 — Calculate the dividend yield.',
                answer: 'Yield = Annual Dividend ÷ Price × 100 = J$2.50 ÷ J$120 × 100 = 2.08%. This is modest but NCB also returns capital through retained earnings. Check whether the dividend has grown year-over-year — a growing dividend signals management confidence.',
              },
              {
                instruction: 'Step 4 — Calculate the payout ratio and assess sustainability.',
                answer: 'Payout Ratio = DPS ÷ EPS = J$2.50 ÷ J$6.47 = 38.6%. NCB pays out 38.6% of earnings as dividends and retains 61.4% for reinvestment. This is a healthy, sustainable ratio — plenty of room to maintain or grow the dividend even if earnings dip slightly.',
              },
              {
                instruction: 'Step 5 — Book Value Per Share and P/B.',
                answer: 'BVPS = Total Equity ÷ Shares = J$185B ÷ 2.86B = J$64.69. P/B = Price ÷ BVPS = J$120 ÷ J$64.69 = 1.85x. NCB trades at 1.85× book value — the market values it at nearly twice what shareholders would receive in liquidation, suggesting confidence in management\'s ability to generate above-average returns on capital.',
              },
            ],
          },
          citations: ['NCB Financial Group Annual Report 2022. Note: figures are illustrative approximations for educational purposes.'],
        },
      },
      {
        id: 'fa-quiz',
        title: 'Module Quiz: Fundamental Analysis',
        type: 'quiz',
        duration: 12,
        content: {
          quiz: [
            {
              q: 'A company has Revenue of J$100M and Cost of Goods Sold of J$60M. What is the Gross Profit Margin?',
              options: ['60%', '40%', '6%', '160%'],
              correct: 1,
              explanation: 'Gross Profit = Revenue – COGS = J$100M – J$60M = J$40M. Gross Profit Margin = J$40M ÷ J$100M = 40%. This means the company keeps 40 cents of every revenue dollar after direct production costs.',
            },
            {
              q: 'Current Assets = J$50M, Current Liabilities = J$40M. What is the Current Ratio?',
              options: ['0.8x', '1.25x', '10x', '90x'],
              correct: 1,
              explanation: 'Current Ratio = Current Assets ÷ Current Liabilities = 50 ÷ 40 = 1.25x. Above 1.0 is generally healthy, meaning the company can cover short-term obligations. A ratio of 1.25 indicates adequate but not excessive liquidity.',
            },
            {
              q: 'A stock has a P/E of 8x when its sector average P/E is 15x. What is most likely true?',
              options: [
                'The stock is definitely a great bargain',
                'The stock may be undervalued OR the market sees a problem — investigate further',
                'The stock is overvalued',
                'The company has no earnings',
              ],
              correct: 1,
              explanation: 'A below-average P/E could be a value opportunity OR a value trap. The market is efficient enough that cheap stocks usually have a reason to be cheap. Always ask: why is this trading at a discount? Is it temporary or structural?',
            },
            {
              q: 'EPS = J$5.00 and Dividends Per Share = J$2.50. What is the payout ratio?',
              options: ['200%', '25%', '50%', '125%'],
              correct: 2,
              explanation: 'Payout Ratio = DPS ÷ EPS = 2.50 ÷ 5.00 = 50%. The company distributes half its earnings as dividends and retains the other half. A 50% payout ratio is considered very sustainable.',
            },
            {
              q: 'Which financial statement shows a company\'s financial position at a specific point in time?',
              options: ['Income Statement', 'Cash Flow Statement', 'Balance Sheet', 'Statement of Changes in Equity'],
              correct: 2,
              explanation: 'The Balance Sheet (Statement of Financial Position) is a snapshot at a specific date showing Assets = Liabilities + Equity. The Income Statement covers a period (quarterly or annual), and the Cash Flow Statement tracks cash movements over a period.',
            },
          ],
        },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COURSE 3: Technical Analysis
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'technical-analysis',
    title: 'Technical Analysis',
    subtitle: 'Chart patterns, indicators & timing',
    description: 'Master candlestick charts, moving averages, RSI, MACD, and support/resistance levels to time your entries and exits.',
    level: 'Intermediate',
    color: '#ce93d8',
    estimatedHours: 5,
    modules: [
      {
        id: 'ta-candlesticks',
        title: 'Candlestick Charts',
        type: 'lesson',
        duration: 15,
        content: {
          paragraphs: [
            'Candlestick charts originated in 18th-century Japan and remain the dominant chart type used by traders worldwide. Each candlestick represents a specific time period (1 day, 1 hour, 15 minutes, etc.) and encodes four pieces of information: the Open, High, Low, and Close — collectively known as OHLC data.',
            'The body of the candle shows the distance between Open and Close. A green (or white) candle means the price closed higher than it opened — buyers won the period. A red (or black) candle means price closed lower — sellers dominated. The thin lines above and below the body are called "wicks" or "shadows" and show the High and Low extremes reached during the period.',
            'Certain candlestick patterns have predictive value when they appear at key price levels. A "Doji" — where Open and Close are nearly equal, creating a very thin body — signals indecision and potential reversal. A "Hammer" — a small body with a long lower wick — at the bottom of a downtrend suggests buyers pushed back hard and a reversal may be coming.',
          ],
          diagramKey: 'candlestick',
          diagramCaption: 'Five common candlestick patterns with bullish/bearish interpretations.',
          keyTerms: [
            { term: 'Bullish Candle', def: 'Close > Open. Price rose during the period. Typically shown in green.' },
            { term: 'Bearish Candle', def: 'Close < Open. Price fell during the period. Typically shown in red.' },
            { term: 'Wick / Shadow', def: 'The thin lines above and below the candle body showing the period\'s High and Low.' },
            { term: 'Doji', def: 'A candle where Open ≈ Close, creating a very small or nonexistent body. Signals indecision.' },
            { term: 'Hammer', def: 'Small body near the top, long lower wick. Bullish reversal signal when seen at a downtrend low.' },
            { term: 'Shooting Star', def: 'Small body near the bottom, long upper wick. Bearish reversal signal when seen at a trend high.' },
          ],
          callouts: [
            { type: 'tip', text: 'Single candlestick patterns are weak signals. Always confirm with the next candle or two, and look for patterns at significant support/resistance levels — not in random locations.' },
            { type: 'info', text: 'All charts on Gotham use candlestick format by default. You can see daily OHLC data for any JSE or US stock by clicking on it from the Dashboard.' },
          ],
          links: [
            { title: 'TradingView — Live Charts', url: 'https://www.tradingview.com', description: 'Best free charting platform. Search any JSE or US stock.' },
            { title: 'Investopedia: Candlestick Patterns', url: 'https://www.investopedia.com/articles/active-trading/092315/5-most-powerful-candlestick-patterns.asp', description: 'Top 5 candlestick patterns with visual examples.' },
          ],
        },
      },
      {
        id: 'ta-moving-averages',
        title: 'Moving Averages',
        type: 'lesson',
        duration: 12,
        content: {
          paragraphs: [
            'A moving average (MA) smooths out price data by calculating the average price over a set number of periods. This removes short-term noise and reveals the underlying trend direction. The two main types are Simple Moving Averages (SMA) and Exponential Moving Averages (EMA).',
            'The SMA calculates an equal-weighted average over N periods. A 50-day SMA sums the last 50 closing prices and divides by 50. The EMA gives more weight to recent prices, making it more responsive to new data. Most traders use EMAs for shorter timeframes (9, 12, 26 days) and SMAs for longer trend analysis (50, 100, 200 days).',
            'The most powerful moving average signal is the crossover: when a shorter MA crosses above a longer MA, it generates a "golden cross" — a bullish signal. When the shorter MA crosses below the longer MA, it creates a "death cross" — bearish. On JSE stocks with lower liquidity, the 20/50 day MA crossover works better than the typical 50/200 because the signal is faster.',
          ],
          diagramKey: 'moving-average',
          diagramCaption: 'Price line with 20-day and 50-day MAs. Golden cross and death cross marked.',
          keyTerms: [
            { term: 'SMA (Simple Moving Average)', def: 'Equally-weighted average of closing prices over N periods.' },
            { term: 'EMA (Exponential Moving Average)', def: 'Weighted average giving more importance to recent prices. More responsive than SMA.' },
            { term: 'Golden Cross', def: 'Short MA crosses above long MA — bullish trend signal.' },
            { term: 'Death Cross', def: 'Short MA crosses below long MA — bearish trend signal.' },
            { term: 'Price Above MA', def: 'When price is above its MA, the trend is up. When below, the trend is down. MAs act as dynamic support/resistance.' },
          ],
          callouts: [
            { type: 'warning', text: 'Moving averages are lagging indicators — they confirm trend changes after they happen, not before. Use them for trend direction, not for predicting reversals.' },
            { type: 'example', text: 'NCB Financial Group: If the 20-day EMA crosses above the 50-day SMA while price is also above both, that\'s a strong buy confirmation. Entering here gives you a trailing stop you can place below the 50-day MA.' },
          ],
          links: [
            { title: 'TradingView: NCBFG Chart', url: 'https://www.tradingview.com/symbols/JSE-NCBFG/', description: 'Live NCB Financial Group chart with MA overlay capability.' },
          ],
        },
      },
      {
        id: 'ta-rsi',
        title: 'RSI: Overbought & Oversold',
        type: 'lesson',
        duration: 12,
        content: {
          paragraphs: [
            'The Relative Strength Index (RSI) is a momentum oscillator that measures the speed and magnitude of recent price changes on a scale of 0 to 100. Created by J. Welles Wilder in 1978, it remains one of the most widely used technical indicators. RSI = 100 – (100 / (1 + RS)), where RS = average gain / average loss over 14 periods.',
            'The conventional interpretation: RSI above 70 = overbought (stock may be due for a pullback). RSI below 30 = oversold (stock may be due for a bounce). However, overbought doesn\'t mean "sell immediately" — in strong uptrends, RSI can stay above 70 for weeks. Context matters.',
            'The most reliable RSI signal is divergence. Bullish divergence: price makes a new lower low, but RSI makes a higher low — momentum is improving even though price is still falling. This often precedes a reversal. Bearish divergence: price makes a new higher high but RSI makes a lower high — momentum is deteriorating even though price is still rising.',
          ],
          diagramKey: 'rsi',
          diagramCaption: 'RSI oscillator with overbought (70), oversold (30) zones and a bullish divergence example.',
          keyTerms: [
            { term: 'RSI', def: 'Relative Strength Index. Oscillates 0–100. Above 70 = overbought, below 30 = oversold.' },
            { term: 'Overbought', def: 'RSI > 70. The stock has risen rapidly and may be due for a pause or pullback.' },
            { term: 'Oversold', def: 'RSI < 30. The stock has fallen rapidly and buyers may step in soon.' },
            { term: 'Bullish Divergence', def: 'Price makes lower low, RSI makes higher low. Momentum improving = potential bottom.' },
            { term: 'Bearish Divergence', def: 'Price makes higher high, RSI makes lower high. Momentum weakening = potential top.' },
          ],
          callouts: [
            { type: 'tip', text: 'On JSE stocks (lower liquidity), use weekly RSI rather than daily. Daily RSI on thin-volume stocks produces many false signals from single large trades.' },
            { type: 'warning', text: 'Never use RSI alone. Combine it with trend direction (MAs) and support/resistance levels for higher-probability setups.' },
          ],
          links: [
            { title: 'Investopedia: RSI Indicator', url: 'https://www.investopedia.com/terms/r/rsi.asp', description: 'Full RSI guide with formula, calculation, and examples.' },
            { title: 'TradingView RSI Tutorial', url: 'https://www.tradingview.com/scripts/relativestrengthindex/', description: 'How to add and configure RSI on TradingView charts.' },
          ],
          citations: ['Wilder, J. Welles. New Concepts in Technical Trading Systems (1978). Trend Research.'],
        },
      },
      {
        id: 'ta-exercise',
        title: 'Exercise: Identify Chart Signals',
        type: 'exercise',
        duration: 12,
        content: {
          exercise: {
            scenario: 'You are analysing JMMBGL (JMMB Group Limited) on the JSE. The weekly chart shows: Price has been declining for 6 weeks from J$40 to J$32. This week\'s candle: Open J$32.50, High J$34.80, Low J$31.20, Close J$34.60 (a strong green candle). The 14-week RSI is at 28. The price is sitting right on the 52-week low of J$31.50. Work through the analysis.',
            steps: [
              {
                instruction: 'Step 1 — Analyse the candlestick pattern for this week.',
                answer: 'This is a strong bullish candle: Open J$32.50, Close J$34.60 — the price rose J$2.10 during the week. The wick extends down to J$31.20 (below the open) meaning sellers pushed lower but buyers overwhelmed them and closed the price near the high. The long lower wick + strong close = bullish hammer-like structure. This is significant.',
              },
              {
                instruction: 'Step 2 — What does the RSI reading of 28 tell you?',
                answer: 'RSI 28 is in oversold territory (below 30). The stock has fallen rapidly and the selling momentum is exhausted. Oversold on a weekly chart is a stronger signal than on a daily chart because it represents weeks of selling pressure. Combined with the strong green candle, this suggests the selling climax may be over.',
              },
              {
                instruction: 'Step 3 — Why is the 52-week low at J$31.50 important?',
                answer: 'The 52-week low is a key support level — many investors who track the stock have marked it mentally. When price approached J$31.50 but rejected sharply (the wick touched J$31.20 but closed at J$34.60), it shows that buyers aggressively defended this level. This "test and rejection" of support is a high-probability bullish signal.',
              },
              {
                instruction: 'Step 4 — Construct a trade setup: entry, stop-loss, and target.',
                answer: 'Entry: J$34.60 (current close) or wait for next week\'s open. Stop-Loss: Below J$31.00 — just under the 52-week low. If the stock breaks that level, the thesis is wrong and you exit. Target: Previous support at ~J$40 (the starting point of this decline) = potential J$5.40 gain. Risk = J$3.60 (entry to stop). Risk/Reward = 5.40/3.60 = 1.5:1. This is acceptable; ideally you want 2:1 or better.',
              },
            ],
          },
        },
      },
      {
        id: 'ta-live-exercise',
        title: 'Live Exercise: Identify Signals on a Real JSE Chart',
        type: 'exercise',
        duration: 12,
        content: {
          exercise: {
            liveData: true,
            scenario: '',
            steps: [],
          },
          callouts: [
            { type: 'tip', text: 'Apply what you learned about candlesticks, RSI, and support/resistance to a stock from today\'s JSE session. After completing this, open the Charts tab and pull up the same symbol to see the full picture.' },
          ],
        },
      },
      {
        id: 'ta-quiz',
        title: 'Module Quiz: Technical Analysis',
        type: 'quiz',
        duration: 10,
        content: {
          quiz: [
            {
              q: 'A candlestick where Open = J$50 and Close = J$47 with a high of J$52 and low of J$46 is best described as:',
              options: ['Bullish candle with upper wick', 'Bearish candle with wicks', 'Doji', 'Hammer'],
              correct: 1,
              explanation: 'Close (J$47) < Open (J$50) = bearish (red) candle. The wick above the open (to J$52) is the upper wick, and the wick below the close (to J$46) is the lower wick. Both buyer and seller extremes are visible.',
            },
            {
              q: 'A 20-day EMA crosses above a 50-day SMA. This is called a:',
              options: ['Death Cross', 'Doji', 'Golden Cross', 'RSI Divergence'],
              correct: 2,
              explanation: 'When a shorter moving average crosses above a longer moving average, it\'s a Golden Cross — a bullish signal indicating that recent price momentum is stronger than the longer-term trend.',
            },
            {
              q: 'RSI is at 72 on a strong uptrending stock. You should:',
              options: ['Sell immediately — it\'s overbought', 'Investigate context; strong trends can sustain RSI > 70 for extended periods', 'Buy more immediately', 'Ignore RSI for uptrending stocks'],
              correct: 1,
              explanation: 'RSI > 70 does not automatically mean "sell." In strong uptrends, stocks can remain overbought for weeks or months. Look for bearish divergence or a break of the trend before acting on an overbought reading.',
            },
            {
              q: 'Bullish divergence means:',
              options: [
                'Price makes a higher high and RSI makes a higher high',
                'Price makes a lower low but RSI makes a higher low',
                'Price makes a higher high but RSI makes a lower high',
                'Price and RSI both fall simultaneously',
              ],
              correct: 1,
              explanation: 'Bullish divergence: price keeps making lower lows (trend still down on the chart) but RSI is making higher lows (selling momentum weakening). This disconnect often precedes a price reversal to the upside.',
            },
            {
              q: 'Which is the best description of how to use technical analysis on JSE stocks?',
              options: [
                'Apply daily signals aggressively to every stock',
                'Use weekly charts and combine multiple indicators due to lower liquidity',
                'Technical analysis doesn\'t work on JSE stocks',
                'Only use RSI, ignore all other indicators',
              ],
              correct: 1,
              explanation: 'The JSE has lower liquidity than major exchanges, making daily signals more prone to noise. Weekly charts filter out erratic single-trade spikes. Combining RSI + moving averages + support/resistance gives much higher probability signals.',
            },
          ],
        },
      },
    ],
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // COURSE 4: Building Your First Portfolio
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'portfolio-building',
    title: 'Building Your First Portfolio',
    subtitle: 'Turn knowledge into a real investment plan',
    description: 'Learn how to allocate capital across stocks, manage risk, hedge against JMD depreciation with USD assets, and construct a portfolio suited to your goals.',
    level: 'Beginner',
    color: '#ffd740',
    estimatedHours: 4,
    modules: [
      {
        id: 'pb-diversification',
        title: 'Diversification: The Only Free Lunch in Investing',
        type: 'lesson',
        duration: 12,
        content: {
          paragraphs: [
            'Diversification is the practice of spreading investments across different assets, sectors, and geographies so that no single failure can wipe out your portfolio. Nobel laureate Harry Markowitz called it "the only free lunch in investing" — you can reduce risk without necessarily reducing expected returns, simply by not concentrating everything in one place.',
            'On the JSE, sector concentration is a real risk. Financial services companies (NCB, Sagicor, JMMB, Scotia) make up a large share of the index. If interest rates spike or a credit crisis hits the sector, a portfolio heavy in financials suffers disproportionately. Deliberately choosing stocks across manufacturing (Wisynco, Caribbean Cement), distribution (GraceKennedy, Lasco), and tourism (Pulse, Palace Amusement) creates natural balance.',
            'Geographic diversification matters especially for Jamaican investors because the Jamaican dollar has historically depreciated against the US dollar at roughly 5–8% per year. A portfolio entirely in JMD assets loses purchasing power against USD-denominated goods every year. Holding even 20–30% of your portfolio in USD assets — US stocks, US-denominated bonds, or USD money market funds — is a structural hedge against this currency risk.',
          ],
          diagramKey: 'diversification',
          diagramCaption: 'Drag the slider — watch portfolio risk fall as you add holdings, until it hits the market-risk floor that diversification can\'t remove.',
          keyTerms: [
            { term: 'Correlation', def: 'How two assets move relative to each other. Correlation of +1 = they move identically. Correlation of -1 = they move opposite. Portfolio risk falls when you combine assets with low or negative correlations.' },
            { term: 'Sector Concentration', def: 'Owning too many stocks in the same industry. If that industry has a bad year, your whole portfolio suffers.' },
            { term: 'Currency Risk', def: 'The risk that a depreciation of the Jamaican dollar erodes the real value of JMD-denominated investments over time.' },
            { term: 'Rebalancing', def: 'Periodically adjusting your holdings back to your target allocation. If equities outperform and grow to 80% of your portfolio, rebalancing means selling some equities and buying bonds/cash to restore your target 60/40 split.' },
          ],
          callouts: [
            { type: 'example', text: 'A simple diversified JSE portfolio: 25% NCB (financials), 20% Wisynco (consumer goods), 20% Caribbean Cement (industrials), 15% GraceKennedy (distribution), 20% Carib-USD money market fund. Five positions, four sectors, one USD hedge.' },
            { type: 'tip', text: 'You don\'t need 20 stocks to be diversified. Research shows that 8–12 well-chosen stocks across 4–5 sectors captures most of the diversification benefit. Beyond 15 stocks, the marginal reduction in risk is minimal and tracking becomes a job.' },
          ],
          links: [
            { title: 'Investopedia: Diversification Guide', url: 'https://www.investopedia.com/terms/d/diversification.asp', description: 'The theory and practice of diversification explained clearly.' },
          ],
          citations: ['Markowitz, H. (1952). Portfolio Selection. The Journal of Finance, 7(1), 77–91.'],
        },
      },
      {
        id: 'pb-risk-tolerance',
        title: 'Risk Tolerance & Time Horizon',
        type: 'lesson',
        duration: 10,
        content: {
          paragraphs: [
            'Your risk tolerance is how much volatility you can emotionally and financially withstand. It is distinct from risk capacity — how much risk you can mathematically afford based on your income, expenses, and goals. Many investors overestimate their tolerance until they see a 30% portfolio drop and panic-sell at the bottom.',
            'Time horizon is the single most important factor in how aggressively you should invest. If you need the money in 2 years, a 40% drawdown is catastrophic — you might have to sell at a loss. If your horizon is 20 years, a 40% drawdown is temporary noise; the JSE has historically recovered from every downturn within 2–5 years.',
            'A simple rule: subtract your age from 110 and that is roughly the percentage you should hold in equities. A 25-year-old: 85% equities, 15% bonds/cash. A 55-year-old: 55% equities, 45% bonds/cash. This is a starting point — adjust based on your actual income stability, obligations, and comfort with volatility.',
          ],
          diagramKey: 'risk-profiles',
          diagramCaption: 'Three investor profiles with suggested JSE allocations based on risk tolerance and time horizon.',
          keyTerms: [
            { term: 'Risk Tolerance', def: 'How much portfolio volatility you can psychologically handle without making panic decisions.' },
            { term: 'Risk Capacity', def: 'How much financial risk you can actually afford given your income, expenses, and goals.' },
            { term: 'Drawdown', def: 'The peak-to-trough decline of a portfolio. A portfolio that falls from J$500,000 to J$350,000 has experienced a 30% drawdown.' },
            { term: 'Time Horizon', def: 'How long before you need to access your invested capital. Longer horizon = more risk you can afford to take.' },
          ],
          callouts: [
            { type: 'warning', text: 'Never invest money you might need within 12 months. Market timing is impossible, and you may be forced to sell at a loss right when the market is at its lowest.' },
            { type: 'tip', text: 'Gotham\'s Portfolio Optimizer (under the Portfolio tab) calculates efficient allocations based on historical JSE and US stock data. Use it to test different allocation scenarios before committing real capital.' },
          ],
        },
      },
      {
        id: 'pb-exercise',
        title: 'Exercise: Design a J$500,000 Portfolio',
        type: 'exercise',
        duration: 15,
        content: {
          exercise: {
            scenario: 'You are 28 years old with a stable income. You have J$500,000 to invest with a 10-year horizon. You consider yourself a moderate-risk investor — you can handle some volatility but not watching half your money disappear. Work through building your portfolio step by step.',
            steps: [
              {
                instruction: 'Step 1 — Determine your equity/bond/cash allocation for a moderate 10-year horizon.',
                answer: 'With a 10-year horizon and moderate risk: roughly 65–70% equities, 20–25% bonds/fixed income, 10% cash or cash equivalents. On J$500,000: J$325,000–350,000 in stocks, J$100,000–125,000 in bonds or fixed-rate instruments, J$50,000 cash buffer. The cash buffer prevents you from having to sell stocks in an emergency.',
              },
              {
                instruction: 'Step 2 — Allocate your J$325,000 equity portion across at least 4 JSE stocks. Name the stocks, sectors, and approximate amounts.',
                answer: 'Example: NCB Financial Group (Financials) — J$80,000 (25%); Wisynco Group (Consumer Goods) — J$80,000 (25%); GraceKennedy (Distribution/Financial Services) — J$65,000 (20%); Caribbean Cement (Industrials) — J$65,000 (20%); JMMB Group (Financials) — J$35,000 (10%). Four sectors, five stocks — no single stock above 25%. The financial sector exposure (NCB + JMMB + GK partially) is high, so watch for that concentration.',
              },
              {
                instruction: 'Step 3 — You want 20% of your total portfolio in USD assets as a JMD hedge. How much is that, and what instrument would you use?',
                answer: '20% of J$500,000 = J$100,000. At a rate of J$157/USD, this equals approximately US$637. Suitable instruments: a USD money market fund (offered by NCB Capital Markets, JMMB, or Sagicor), or directly purchasing US ETFs through Alpaca on the Gotham platform. The USD money market option is lower risk; the US ETF option (e.g. SPY, QQQ) offers growth potential but more volatility.',
              },
              {
                instruction: 'Step 4 — What is the single biggest risk in this portfolio and how would you monitor it?',
                answer: 'The biggest risk is financial sector concentration — NCB, JMMB, and GraceKennedy\'s financial division are all exposed to Jamaican interest rate and credit conditions. If the Bank of Jamaica raises rates sharply, loan books tighten and bank profits compress simultaneously across all three. Monitor by: watching Bank of Jamaica monetary policy announcements, tracking NCB\'s non-performing loan ratio in quarterly reports, and setting a rule to reduce financial exposure if it exceeds 40% of the equity portion.',
              },
            ],
          },
          callouts: [
            { type: 'tip', text: 'There is no single "correct" answer to portfolio construction. The goal is a structured rationale: know why you own each position, know what would make you sell it, and know your maximum tolerable loss before rebalancing.' },
          ],
        },
      },
      {
        id: 'pb-quiz',
        title: 'Module Quiz: Portfolio Principles',
        type: 'quiz',
        duration: 10,
        content: {
          quiz: [
            {
              q: 'Which of the following best reduces portfolio risk without necessarily reducing expected return?',
              options: ['Holding only the top-performing JSE stock', 'Diversifying across uncorrelated assets and sectors', 'Keeping everything in cash', 'Investing only in foreign stocks'],
              correct: 1,
              explanation: 'Diversification across uncorrelated assets is Markowitz\'s core insight — you get risk reduction "for free" by combining assets that don\'t move in lockstep. Cash eliminates growth. A single stock maximises concentration risk.',
            },
            {
              q: 'A 25-year-old investor with a 20-year horizon should generally have:',
              options: ['90% in cash for safety', 'Equal split: 50% stocks, 50% bonds', 'A higher allocation to equities than a 60-year-old retiree', 'Only international stocks, no JSE exposure'],
              correct: 2,
              explanation: 'Long time horizons allow for more equity exposure because you have time to recover from drawdowns. A 60-year-old retiree who needs income now cannot afford to wait 5 years for a market recovery — they need stability.',
            },
            {
              q: 'Why should a Jamaican investor hold some USD-denominated assets?',
              options: ['USD assets always outperform JMD assets', 'To hedge against the historical JMD depreciation trend vs USD', 'JSE stocks pay dividends in USD', 'Foreign investors require it'],
              correct: 1,
              explanation: 'The Jamaican dollar has historically depreciated against the USD at roughly 5–8% per year. Holding USD assets means that even if your JMD portfolio stays flat, the USD portion grows in JMD terms just from currency movement.',
            },
            {
              q: 'What is portfolio rebalancing?',
              options: ['Selling all stocks when the market drops', 'Periodically restoring your portfolio to its target allocation after drift', 'Adding new stocks every month', 'Moving to 100% bonds when approaching retirement'],
              correct: 1,
              explanation: 'Rebalancing means that if equities outperform and grow from 65% to 78% of your portfolio, you trim the excess back to 65% and add to underperforming assets. This forces disciplined "buy low, sell high" behaviour automatically.',
            },
            {
              q: 'You have J$500,000 and a 2-year time horizon. Which approach is most appropriate?',
              options: ['100% JSE growth stocks', '70% equities, 30% bonds', 'Conservative: more bonds/cash, minimal equity', 'All in a single high-yield JSE stock'],
              correct: 2,
              explanation: 'With only 2 years, a market drawdown could force you to sell equities at a loss. Conservative allocation (higher bonds/cash, lower equity) protects capital you\'ll need soon. Long horizons justify more equity; short horizons demand caution.',
            },
          ],
        },
      },
    ],
  },
];

// ── localStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = 'gotham_learn_progress_v2';

function loadProgress(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; }
}
function saveProgress(p: Record<string, boolean>) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

// ── Inline Diagrams ───────────────────────────────────────────────────────────

function DiagramBalanceSheet() {
  return (
    <svg viewBox="0 0 320 160" style={{ width: '100%', maxWidth: 480, height: 'auto', display: 'block', margin: '0 auto' }}>
      <rect width="320" height="160" fill="rgba(var(--fg),.02)" rx="8" />
      {/* Left: Assets */}
      <rect x="10" y="20" width="130" height="30" fill="rgba(0,230,118,.15)" rx="4" />
      <text x="75" y="40" textAnchor="middle" fill="#00e676" fontSize="10" fontFamily="Inter" fontWeight="700">Current Assets</text>
      <rect x="10" y="58" width="130" height="70" fill="rgba(0,230,118,.08)" rx="4" />
      <text x="75" y="97" textAnchor="middle" fill="rgba(0,230,118,.8)" fontSize="10" fontFamily="Inter">Non-Current Assets</text>
      <text x="75" y="140" textAnchor="middle" fill="rgba(var(--fg),.4)" fontSize="9" fontFamily="Inter">ASSETS</text>
      {/* Right: Liabilities + Equity */}
      <rect x="180" y="20" width="130" height="30" fill="rgba(255,82,82,.15)" rx="4" />
      <text x="245" y="40" textAnchor="middle" fill="#ff5252" fontSize="10" fontFamily="Inter" fontWeight="700">Current Liabilities</text>
      <rect x="180" y="58" width="130" height="40" fill="rgba(255,82,82,.08)" rx="4" />
      <text x="245" y="82" textAnchor="middle" fill="rgba(255,82,82,.8)" fontSize="10" fontFamily="Inter">Long-Term Debt</text>
      <rect x="180" y="106" width="130" height="22" fill="rgba(64,196,255,.15)" rx="4" />
      <text x="245" y="121" textAnchor="middle" fill="#40c4ff" fontSize="10" fontFamily="Inter" fontWeight="700">Shareholders' Equity</text>
      <text x="245" y="140" textAnchor="middle" fill="rgba(var(--fg),.4)" fontSize="9" fontFamily="Inter">LIABILITIES + EQUITY</text>
      {/* = sign */}
      <text x="160" y="90" textAnchor="middle" fill="rgba(var(--fg),.5)" fontSize="18" fontFamily="Inter">=</text>
    </svg>
  );
}

function DiagramExchanges() {
  const exchanges = [
    { name: 'JSE', country: 'Jamaica', currency: 'JMD', listings: '~40', color: '#00e676', x: 40, y: 40 },
    { name: 'TTSE', country: 'Trinidad & Tobago', currency: 'TTD', listings: '~35', color: '#40c4ff', x: 200, y: 40 },
    { name: 'ECSE', country: '8 Eastern Caribbean Nations', currency: 'XCD', listings: '~25', color: '#ffd740', x: 40, y: 110 },
    { name: 'BSE', country: 'Barbados', currency: 'BBD', listings: '~20', color: '#ce93d8', x: 200, y: 110 },
  ];
  return (
    <svg viewBox="0 0 320 175" style={{ width: '100%', maxWidth: 480, height: 'auto', display: 'block', margin: '0 auto' }}>
      <rect width="320" height="175" fill="rgba(var(--fg),.02)" rx="8" />
      {exchanges.map(e => (
        <g key={e.name}>
          <rect x={e.x} y={e.y} width="118" height="58" fill={`${e.color}12`} stroke={`${e.color}40`} strokeWidth="1" rx="6" />
          <text x={e.x + 59} y={e.y + 18} textAnchor="middle" fill={e.color} fontSize="13" fontFamily="Inter" fontWeight="800">{e.name}</text>
          <text x={e.x + 59} y={e.y + 33} textAnchor="middle" fill="rgba(var(--fg),.55)" fontSize="8" fontFamily="Inter">{e.country}</text>
          <text x={e.x + 59} y={e.y + 46} textAnchor="middle" fill="rgba(var(--fg),.35)" fontSize="8" fontFamily="Inter">{e.currency} · {e.listings} listed</text>
        </g>
      ))}
      <text x="160" y="168" textAnchor="middle" fill="rgba(var(--fg),.25)" fontSize="8" fontFamily="Inter">Caribbean exchanges — each has unique listing requirements & trading hours</text>
    </svg>
  );
}

function DiagramIncomeStatement() {
  const items = [
    { label: 'Revenue', value: 159, color: '#00e676', w: 280 },
    { label: '– Cost of Goods Sold', value: -107, color: '#ff5252', w: 190 },
    { label: '= Gross Profit', value: 52, color: '#40c4ff', w: 92 },
    { label: '– Operating Expenses', value: -28, color: '#ff5252', w: 50 },
    { label: '= Operating Profit (EBIT)', value: 24, color: '#ffd740', w: 42 },
    { label: '– Tax & Interest', value: -10, color: '#ff5252', w: 18 },
    { label: '= Net Profit', value: 14, color: '#00e676', w: 25 },
  ];
  return (
    <svg viewBox="0 0 320 175" style={{ width: '100%', maxWidth: 480, height: 'auto', display: 'block', margin: '0 auto' }}>
      <rect width="320" height="175" fill="rgba(var(--fg),.02)" rx="8" />
      {items.map((item, i) => (
        <g key={i}>
          <text x="5" y={14 + i * 23} fill="rgba(var(--fg),.55)" fontSize="8" fontFamily="Inter">{item.label}</text>
          <rect x="155" y={5 + i * 23} width={item.w} height="14" fill={`${item.color}25`} stroke={`${item.color}50`} strokeWidth="0.5" rx="2" />
          <text x={155 + item.w + 5} y={15 + i * 23} fill={item.color} fontSize="8" fontFamily="Inter" fontWeight="700">
            {item.value > 0 ? `J$${item.value}B` : `J$${Math.abs(item.value)}B`}
          </text>
        </g>
      ))}
      <text x="160" y="168" textAnchor="middle" fill="rgba(var(--fg),.25)" fontSize="7" fontFamily="Inter">Illustrative GraceKennedy 2022 figures (approximate, in billions JMD)</text>
    </svg>
  );
}

function DiagramQuote() {
  return (
    <svg viewBox="0 0 320 170" style={{ width: '100%', maxWidth: 480, height: 'auto', display: 'block', margin: '0 auto' }}>
      <rect width="320" height="170" fill="rgba(0,0,0,.2)" rx="8" stroke="rgba(0,230,118,.2)" strokeWidth="1" />
      <text x="12" y="22" fill="#00e676" fontSize="14" fontFamily="Inter" fontWeight="800">GK</text>
      <text x="50" y="22" fill="rgba(var(--fg),.5)" fontSize="10" fontFamily="Inter">GraceKennedy Ltd · JSE</text>
      <text x="12" y="48" fill="#fff" fontSize="24" fontFamily="Inter" fontWeight="800">J$75.50</text>
      <text x="140" y="48" fill="#00e676" fontSize="11" fontFamily="Inter" fontWeight="700">▲ +2.03%</text>
      {[
        ['Open', 'J$74.00'], ['Prev Close', 'J$73.99'], ['High', 'J$76.00'],
        ['Low', 'J$73.80'], ['Volume', '45,200'], ['52W High', 'J$92.00'],
        ['52W Low', 'J$58.50'], ['Bid', 'J$75.20'], ['Ask', 'J$75.80'],
      ].map(([label, val], i) => (
        <g key={label}>
          <text x={12 + (i % 3) * 104} y={72 + Math.floor(i / 3) * 28} fill="rgba(var(--fg),.35)" fontSize="8" fontFamily="Inter">{label}</text>
          <text x={12 + (i % 3) * 104} y={86 + Math.floor(i / 3) * 28} fill="rgba(var(--fg),.85)" fontSize="10" fontFamily="Inter" fontWeight="600">{val}</text>
        </g>
      ))}
      <text x="160" y="162" textAnchor="middle" fill="rgba(var(--fg),.2)" fontSize="7" fontFamily="Inter">Spread = Ask – Bid = J$0.60 · Settlement T+2</text>
    </svg>
  );
}

function DiagramRenderer({ diagramKey }: { diagramKey: string }) {
  // Interactive, drag-to-learn simulators embedded right in the lesson
  if (diagramKey === 'candlestick') return <CandlestickSim />;
  if (diagramKey === 'moving-average') return <MovingAverageSim />;
  if (diagramKey === 'rsi') return <RSISim />;
  if (diagramKey === 'pe-comparison') return <PEComparisonSim />;
  if (diagramKey === 'risk-profiles') return <RiskProfileSim />;
  if (diagramKey === 'compound-growth') return <CompoundGrowthSim />;
  if (diagramKey === 'diversification') return <DiversificationSim />;
  // Static reference diagrams
  if (diagramKey === 'balance-sheet') return <DiagramBalanceSheet />;
  if (diagramKey === 'exchanges') return <DiagramExchanges />;
  if (diagramKey === 'income-statement') return <DiagramIncomeStatement />;
  if (diagramKey === 'quote') return <DiagramQuote />;
  return null;
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const levelStyle = (l: Course['level']): React.CSSProperties => {
  if (l === 'Beginner') return { background: 'rgba(0,230,118,.12)', color: '#00e676', border: '1px solid rgba(0,230,118,.25)' };
  if (l === 'Intermediate') return { background: 'rgba(64,196,255,.12)', color: '#40c4ff', border: '1px solid rgba(64,196,255,.25)' };
  return { background: 'rgba(206,147,216,.12)', color: '#ce93d8', border: '1px solid rgba(206,147,216,.25)' };
};

const pill: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  padding: '2px 9px', borderRadius: 999, fontSize: 10, fontWeight: 700,
};

const moduleTypeIcon = (t: Module['type']) => {
  if (t === 'quiz') return <HelpCircle size={13} />;
  if (t === 'exercise') return <Activity size={13} />;
  return <FileText size={13} />;
};

const moduleTypeColor = (t: Module['type']) => {
  if (t === 'quiz') return '#ffd740';
  if (t === 'exercise') return '#ce93d8';
  return 'rgba(var(--fg),.5)';
};

const calloutStyle = (type: Callout['type']): { border: string; bg: string; icon: string; iconColor: string } => ({
  tip: { border: 'rgba(0,230,118,.3)', bg: 'rgba(0,230,118,.06)', icon: '💡', iconColor: '#00e676' },
  warning: { border: 'rgba(255,215,64,.3)', bg: 'rgba(255,215,64,.06)', icon: '⚠️', iconColor: '#ffd740' },
  info: { border: 'rgba(64,196,255,.3)', bg: 'rgba(64,196,255,.06)', icon: 'ℹ️', iconColor: '#40c4ff' },
  example: { border: 'rgba(206,147,216,.3)', bg: 'rgba(206,147,216,.06)', icon: '📊', iconColor: '#ce93d8' },
}[type]);

// ── Live Exercise Panel ───────────────────────────────────────────────────────

function LiveExercisePanel({ mode }: { mode: 'quote' | 'technical' }) {
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [grades, setGrades] = useState<Record<number, { score: number; label: string; color: string; feedback: string }>>({});
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const { data: stocks, isLoading, error } = useQuery<LiveLearnStock[]>({
    queryKey: ['jse-live-learn'],
    queryFn: async () => { const r = await fetch('/api/stocks'); return r.json(); },
    staleTime: 60000,
  });

  const stock = useMemo(() => {
    if (!stocks) return null;
    const valid = stocks.filter((s) => (s.price ?? 0) > 0 && (s.prevClose ?? 0) > 0 && s.symbol);
    if (!valid.length) return null;
    // Rotate the featured stock each minute — Date.now() is intentional here.
    // eslint-disable-next-line react-hooks/purity
    const idx = Math.floor(Date.now() / 60000) % Math.min(valid.length, 15);
    return valid[idx];
  }, [stocks]);

  function gradeStep(i: number, modelAnswer: string) {
    const userText = userAnswers[i] ?? '';
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s.%$]/g, ' ').trim();
    const stopWords = new Set(['the','a','an','is','are','was','were','it','in','on','of','to','and','or','that','this','with','for','from','as','at','be','by','not','we','you','i','they','he','she','its','has','have','had','will','would','can','could','should','been','being','do','does','did','about','up','out','if','so','but','what','which','who','when','where','how']);
    const tokens = (normalize(modelAnswer).match(/\b[\w.%$]+\b/g) ?? []).filter(t => t.length > 2 && !stopWords.has(t));
    const keywords = [...new Set(tokens)];
    if (!keywords.length) return;
    const matched = keywords.filter(kw => normalize(userText).includes(kw));
    const score = matched.length / keywords.length;
    const label = score >= 0.6 ? 'Excellent' : score >= 0.35 ? 'Partial Credit' : 'Needs Work';
    const color = score >= 0.6 ? '#00e676' : score >= 0.35 ? '#ffd740' : '#ff5252';
    const feedback = score >= 0.6 ? `You hit ${matched.length} of ${keywords.length} key points.` : score >= 0.35 ? `${matched.length}/${keywords.length} key points — review what you missed.` : `Only ${matched.length}/${keywords.length} key points found.`;
    setGrades(prev => ({ ...prev, [i]: { score, label, color, feedback } }));
    setRevealed(prev => new Set([...prev, i]));
  }

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 0', color: 'rgba(var(--fg),.4)', fontSize: 13 }}>
      <Wifi size={16} style={{ animation: 'pulse 1.5s infinite' }} /> Fetching live JSE market data…
    </div>
  );
  if (error || !stock) return (
    <div style={{ padding: '16px', background: 'rgba(255,82,82,.06)', border: '1px solid rgba(255,82,82,.2)', borderRadius: 10, fontSize: 13, color: 'rgba(var(--fg),.5)' }}>
      Live data unavailable. Markets may be closed or the API is unreachable. Try again during JSE trading hours (9:30 AM – 1:30 PM Jamaica time).
    </div>
  );

  const pctChange = ((stock.price - stock.prevClose) / stock.prevClose) * 100;
  const rangeWidth = stock.high52 && stock.low52 ? stock.high52 - stock.low52 : null;
  const posInRange = (rangeWidth && stock.low52 != null) ? ((stock.price - stock.low52) / rangeWidth) * 100 : null;

  const quoteSteps = [
    {
      instruction: `Calculate the percentage change from ${stock.symbol}'s previous close of J$${stock.prevClose?.toFixed(2)} to today's price of J$${stock.price?.toFixed(2)}.`,
      answer: `Change = (${stock.price.toFixed(2)} – ${stock.prevClose.toFixed(2)}) / ${stock.prevClose.toFixed(2)} × 100 = ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%. ${stock.symbol} is ${pctChange >= 0 ? 'up' : 'down'} ${Math.abs(pctChange).toFixed(2)}% on the session.`,
    },
    ...(stock.high52 && stock.low52 ? [{
      instruction: `Where does J$${stock.price.toFixed(2)} sit within ${stock.symbol}'s 52-week range of J$${stock.low52.toFixed(2)} – J$${stock.high52.toFixed(2)}? What does this tell you?`,
      answer: `Range width = J$${rangeWidth?.toFixed(2)}. Current price is ${posInRange?.toFixed(0)}% from the 52-week low. ${posInRange! > 75 ? 'The stock is in the upper quarter of its 52-week range — trading near historical highs. Momentum is strong but limited upside headroom before hitting resistance.' : posInRange! < 25 ? 'Near the 52-week low — either a value opportunity or continued weakness. Investigate recent news before buying.' : 'In the middle of the range — no extreme technical signal either way. The stock is in equilibrium.'}`,
    }] : []),
    {
      instruction: `Based on the data above, write a one-sentence short-term assessment of ${stock.symbol} and whether you would investigate further.`,
      answer: `${stock.symbol} is ${pctChange >= 0 ? 'showing positive momentum' : 'under selling pressure'} with a ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}% move today. ${Math.abs(pctChange) > 3 ? 'A move this size warrants checking for news — earnings announcement, dividend declaration, or sector catalyst.' : 'The quiet price action suggests no major catalyst; monitor for a breakout with volume confirmation.'} ${posInRange !== null ? (posInRange > 70 ? 'Near the 52-week high — any entry here needs a clear catalyst.' : posInRange < 30 ? 'Near the 52-week low — potential support zone.' : '') : ''}`,
    },
  ];

  const techSteps = [
    {
      instruction: `${stock.symbol} has moved ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}% today. If you saw this as a single candlestick on a daily chart, what type would it likely be (bullish/bearish) and what does it signal?`,
      answer: `${pctChange > 2 ? `A +${pctChange.toFixed(2)}% day produces a bullish (green) candle. If the close is near the day's high, it signals strong buying conviction — buyers were in control all session. This is a positive momentum signal.` : pctChange < -2 ? `A ${pctChange.toFixed(2)}% day produces a bearish (red) candle. If price closed near the day's low, sellers dominated throughout — a bearish continuation signal.` : `A small ${Math.abs(pctChange).toFixed(2)}% move creates a narrow candle body — potentially a Doji if open and close are very close. Doji signals market indecision and often precedes a directional breakout.`}`,
    },
    ...(stock.high52 && stock.low52 ? [{
      instruction: `${stock.symbol} is at J$${stock.price.toFixed(2)} vs its 52-week low of J$${stock.low52.toFixed(2)} and high of J$${stock.high52.toFixed(2)}. Identify potential support and resistance levels.`,
      answer: `Key support: J$${stock.low52.toFixed(2)} (52-week low — psychological floor, many buyers watch this level). Key resistance: J$${stock.high52.toFixed(2)} (52-week high — where sellers previously emerged). ${posInRange! < 30 ? `Current price is near support — high risk/reward if the level holds. Stop-loss would go just below J$${(stock.low52 * 0.97).toFixed(2)}.` : posInRange! > 70 ? `Current price is near resistance — a breakout above J$${stock.high52.toFixed(2)} on strong volume would be a significant bullish signal. Failure here risks a pullback.` : `Price is between key levels — wait for a move toward one extreme with volume before taking a position.`}`,
    }] : []),
    {
      instruction: `If RSI for ${stock.symbol} were at ${Math.abs(pctChange) > 3 ? (pctChange > 0 ? '72' : '26') : '52'}, what would that suggest and how would you combine it with today's price action?`,
      answer: `${Math.abs(pctChange) > 3 && pctChange > 0 ? 'RSI at 72 = overbought territory. Combined with a strong +' + pctChange.toFixed(2) + '% day, this suggests momentum but also that the rally may be extended. Look for confirmation (continued buying next session) before entering — or wait for a pullback to a better entry.' : Math.abs(pctChange) > 3 && pctChange < 0 ? 'RSI at 26 = oversold territory. Combined with a sharp decline, this could signal a selling climax — the last sellers capitulating. A bounce from here with a bullish candle would be a high-probability reversal setup.' : 'RSI at 52 = neutral zone. No overbought/oversold signal. The indicator is not providing a directional edge — rely on trend direction (price vs moving averages) and support/resistance levels instead.'}`,
    },
  ];

  const steps = mode === 'quote' ? quoteSteps : techSteps;

  return (
    <div>
      <div style={{ background: 'rgba(0,230,118,.06)', border: '1px solid rgba(0,230,118,.25)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Wifi size={13} color="#00e676" />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#00e676' }}>Live JSE Data</span>
          <span style={{ fontSize: 11, color: 'rgba(var(--fg),.3)', marginLeft: 'auto' }}>Updates every 30s</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#fff' }}>
          {stock.name ?? stock.symbol} <span style={{ color: 'rgba(var(--fg),.4)', fontWeight: 400 }}>({stock.symbol})</span>
          <span style={{ marginLeft: 12, color: pctChange >= 0 ? '#00e676' : '#ff5252', fontSize: 13 }}>
            J${stock.price.toFixed(2)} &nbsp;{pctChange >= 0 ? '▲' : '▼'} {Math.abs(pctChange).toFixed(2)}%
          </span>
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(var(--fg),.45)' }}>
          Prev Close J${stock.prevClose.toFixed(2)}
          {stock.high52 ? ` · 52W H J$${stock.high52.toFixed(2)}` : ''}
          {stock.low52 ? ` · 52W L J$${stock.low52.toFixed(2)}` : ''}
          {stock.volume ? ` · Vol ${stock.volume.toLocaleString()}` : ''}
        </p>
      </div>

      {steps.map((step, i) => {
        const grade = grades[i];
        const isRevealed = revealed.has(i);
        return (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ background: 'rgba(var(--fg),.03)', border: `1px solid ${grade ? grade.color + '40' : 'rgba(var(--fg),.08)'}`, borderRadius: 12, padding: '14px 16px', transition: 'border-color .3s' }}>
              <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'rgba(var(--fg),.85)', lineHeight: 1.5 }}>
                <span style={{ color: '#00e676', fontWeight: 800, marginRight: 6 }}>Q{i + 1}.</span>{step.instruction}
              </p>
              {!grade && (
                <div style={{ marginBottom: 10 }}>
                  <textarea
                    value={userAnswers[i] ?? ''}
                    onChange={e => setUserAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                    placeholder="Type your answer here…"
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(var(--fg),.04)', border: '1px solid rgba(var(--fg),.12)', borderRadius: 8, padding: '10px 12px', color: 'rgba(var(--fg),.85)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button onClick={() => gradeStep(i, step.answer)} disabled={!(userAnswers[i] ?? '').trim()} style={{ padding: '7px 18px', borderRadius: 8, background: (userAnswers[i] ?? '').trim() ? 'rgba(0,230,118,.15)' : 'rgba(var(--fg),.04)', border: `1px solid ${(userAnswers[i] ?? '').trim() ? 'rgba(0,230,118,.35)' : 'rgba(var(--fg),.08)'}`, color: (userAnswers[i] ?? '').trim() ? '#00e676' : 'rgba(var(--fg),.25)', fontSize: 11, fontWeight: 700, cursor: (userAnswers[i] ?? '').trim() ? 'pointer' : 'not-allowed' }}>
                      Submit &amp; Grade
                    </button>
                    <button onClick={() => setRevealed(prev => new Set([...prev, i]))} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.08)', color: 'rgba(var(--fg),.35)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Skip — Reveal Answer
                    </button>
                  </div>
                </div>
              )}
              {grade && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: grade.color + '14', border: `1px solid ${grade.color}33` }}>
                  <span style={{ fontSize: 18 }}>{grade.label === 'Excellent' ? '🎯' : grade.label === 'Partial Credit' ? '📝' : '💡'}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: grade.color }}>{grade.label} — {Math.round(grade.score * 100)}%</p>
                    <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(var(--fg),.5)' }}>{grade.feedback}</p>
                  </div>
                </div>
              )}
              {grade && userAnswers[i] && (
                <div style={{ background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.07)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                  <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(var(--fg),.3)' }}>Your Answer</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg),.6)', lineHeight: 1.6 }}>{userAnswers[i]}</p>
                </div>
              )}
              {isRevealed && (
                <div style={{ background: 'rgba(0,230,118,.06)', border: '1px solid rgba(0,230,118,.2)', borderRadius: 8, padding: '10px 14px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(0,230,118,.6)' }}>Model Answer</p>
                  <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg),.75)', lineHeight: 1.65 }}>{step.answer}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Module Viewer ─────────────────────────────────────────────────────────────

function ModuleViewer({
  module, moduleIndex, totalModules, isComplete, onComplete, onPrev, onNext, onBack,
}: {
  module: Module; moduleIndex: number; totalModules: number;
  isComplete: boolean; onComplete: () => void;
  onPrev: (() => void) | null; onNext: (() => void) | null; onBack: () => void;
}) {
  const [revealedSteps, setRevealedSteps] = useState<Set<number>>(new Set());
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [grades, setGrades] = useState<Record<number, { score: number; label: string; color: string; feedback: string }>>({});
  const { content } = module;

  const revealStep = (i: number) => setRevealedSteps(prev => new Set([...prev, i]));

  function gradeAnswer(stepIndex: number, modelAnswer: string) {
    const userText = userAnswers[stepIndex] ?? '';
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s.%$]/g, ' ').trim();
    const user = normalize(userText);
    const model = normalize(modelAnswer);
    const stopWords = new Set(['the','a','an','is','are','was','were','it','in','on','of','to','and','or','that','this','with','for','from','as','at','be','by','not','we','you','i','they','he','she','its','has','have','had','will','would','can','could','should','been','being','do','does','did','about','up','out','if','so','but','what','which','who','when','where','how']);
    const modelTokens = (model.match(/\b[\w.%$]+\b/g) ?? []).filter(t => t.length > 2 && !stopWords.has(t));
    const keywords = [...new Set(modelTokens)];
    if (keywords.length === 0) return;
    const matched = keywords.filter(kw => user.includes(kw));
    const score = matched.length / keywords.length;
    let label: string; let color: string; let feedback: string;
    if (score >= 0.6) { label = 'Excellent'; color = '#00e676'; feedback = `You covered ${matched.length} of ${keywords.length} key points.`; }
    else if (score >= 0.35) { label = 'Partial Credit'; color = '#ffd740'; feedback = `${matched.length} of ${keywords.length} key points found — review what you missed.`; }
    else { label = 'Needs Work'; color = '#ff5252'; feedback = `Only ${matched.length} of ${keywords.length} key points. Check the model answer below.`; }
    setGrades(prev => ({ ...prev, [stepIndex]: { score, label, color, feedback } }));
    revealStep(stepIndex);
  }

  const allStepsRevealed = content.exercise
    ? content.exercise.steps.every((_, i) => revealedSteps.has(i))
    : false;

  const allQuizAnswered = content.quiz
    ? content.quiz.every((_, i) => quizAnswers[i] !== undefined)
    : false;

  const quizScore = content.quiz
    ? content.quiz.filter((q, i) => quizAnswers[i] === q.correct).length
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(var(--fg),.06)', border: '1px solid rgba(var(--fg),.1)', color: 'rgba(var(--fg),.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          <ChevronLeft size={13} /> Back to roadmap
        </button>
        <span style={{ fontSize: 11, color: 'rgba(var(--fg),.3)' }}>Module {moduleIndex + 1} of {totalModules}</span>
        {isComplete && (
          <span style={{ ...pill, background: 'rgba(0,230,118,.12)', color: '#00e676', border: '1px solid rgba(0,230,118,.25)', marginLeft: 'auto' }}>
            <CheckCircle size={10} /> Completed
          </span>
        )}
      </div>

      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: moduleTypeColor(module.type) }}>{moduleTypeIcon(module.type)}</span>
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: moduleTypeColor(module.type) }}>
            {module.type === 'quiz' ? 'Knowledge Check' : module.type === 'exercise' ? 'Hands-On Exercise' : 'Lesson'}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(var(--fg),.25)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={9} /> {module.duration} min
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{module.title}</h2>
      </div>

      {/* Lesson content */}
      {content.paragraphs && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {content.paragraphs.map((p, i) => (
            <p key={i} style={{ margin: 0, fontSize: 14, color: i === 0 ? 'rgba(var(--fg),.9)' : 'rgba(var(--fg),.75)', lineHeight: 1.85, fontWeight: i === 0 ? 500 : 400 }}>{p}</p>
          ))}
        </div>
      )}

      {/* Diagram */}
      {content.diagramKey && (
        <div style={{ background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.08)', borderRadius: 14, padding: '20px 16px', marginBottom: 24 }}>
          <DiagramRenderer diagramKey={content.diagramKey} />
          {content.diagramCaption && (
            <p style={{ margin: '12px 0 0', fontSize: 11, color: 'rgba(var(--fg),.35)', textAlign: 'center', lineHeight: 1.5 }}>{content.diagramCaption}</p>
          )}
        </div>
      )}

      {/* Callouts */}
      {content.callouts?.map((c, i) => {
        const s = calloutStyle(c.type);
        return (
          <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: '12px 16px', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{s.icon}</span>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg),.8)', lineHeight: 1.6 }}>{c.text}</p>
          </div>
        );
      })}

      {/* Key Terms */}
      {content.keyTerms && content.keyTerms.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(var(--fg),.35)' }}>Key Terms</p>
          <div style={{ display: 'grid', gap: 8 }}>
            {content.keyTerms.map(t => (
              <div key={t.term} style={{ background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.07)', borderRadius: 10, padding: '10px 14px' }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: '#00e676' }}>{t.term}</span>
                <span style={{ fontSize: 12, color: 'rgba(var(--fg),.55)', marginLeft: 8 }}>— {t.def}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exercise */}
      {content.exercise && (
        <div style={{ marginBottom: 24 }}>
          {content.exercise.liveData ? (
            <LiveExercisePanel mode={module.id.startsWith('ta-') ? 'technical' : 'quote'} />
          ) : (<>
          <div style={{ background: 'rgba(206,147,216,.06)', border: '1px solid rgba(206,147,216,.2)', borderRadius: 14, padding: '16px 18px', marginBottom: 16 }}>
            <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#ce93d8' }}>Scenario</p>
            <p style={{ margin: 0, fontSize: 13, color: 'rgba(var(--fg),.8)', lineHeight: 1.7 }}>{content.exercise.scenario}</p>
          </div>
          {content.exercise.steps.map((step, i) => {
            const grade = grades[i];
            const revealed = revealedSteps.has(i);
            return (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ background: 'rgba(var(--fg),.03)', border: `1px solid ${grade ? grade.color + '40' : 'rgba(var(--fg),.08)'}`, borderRadius: 12, padding: '14px 16px', transition: 'border-color .3s' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'rgba(var(--fg),.85)', lineHeight: 1.5 }}>
                    <span style={{ color: '#ce93d8', fontWeight: 800, marginRight: 6 }}>Q{i + 1}.</span>{step.instruction}
                  </p>

                  {/* Answer input — always shown until graded */}
                  {!grade && (
                    <div style={{ marginBottom: 10 }}>
                      <textarea
                        value={userAnswers[i] ?? ''}
                        onChange={e => setUserAnswers(prev => ({ ...prev, [i]: e.target.value }))}
                        placeholder="Type your answer here…"
                        rows={3}
                        style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(var(--fg),.04)', border: '1px solid rgba(var(--fg),.12)', borderRadius: 8, padding: '10px 12px', color: 'rgba(var(--fg),.85)', fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => gradeAnswer(i, step.answer)}
                          disabled={!(userAnswers[i] ?? '').trim()}
                          style={{ padding: '7px 18px', borderRadius: 8, background: (userAnswers[i] ?? '').trim() ? 'rgba(206,147,216,.2)' : 'rgba(var(--fg),.05)', border: `1px solid ${(userAnswers[i] ?? '').trim() ? 'rgba(206,147,216,.4)' : 'rgba(var(--fg),.1)'}`, color: (userAnswers[i] ?? '').trim() ? '#ce93d8' : 'rgba(var(--fg),.3)', fontSize: 11, fontWeight: 700, cursor: (userAnswers[i] ?? '').trim() ? 'pointer' : 'not-allowed', transition: 'all .2s' }}
                        >
                          Submit &amp; Grade
                        </button>
                        <button
                          onClick={() => revealStep(i)}
                          style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.08)', color: 'rgba(var(--fg),.35)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                        >
                          Skip — Reveal Answer
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Grade badge */}
                  {grade && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: grade.color + '14', border: `1px solid ${grade.color}33` }}>
                      <span style={{ fontSize: 18 }}>{grade.label === 'Excellent' ? '🎯' : grade.label === 'Partial Credit' ? '📝' : '💡'}</span>
                      <div>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: grade.color }}>{grade.label} — {Math.round(grade.score * 100)}%</p>
                        <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(var(--fg),.5)' }}>{grade.feedback}</p>
                      </div>
                    </div>
                  )}

                  {/* User's answer (shown after grading) */}
                  {grade && userAnswers[i] && (
                    <div style={{ background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.07)', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(var(--fg),.3)' }}>Your Answer</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg),.6)', lineHeight: 1.6 }}>{userAnswers[i]}</p>
                    </div>
                  )}

                  {/* Model answer — shown after reveal (either from grading or skip) */}
                  {revealed && (
                    <div style={{ background: 'rgba(0,230,118,.06)', border: '1px solid rgba(0,230,118,.2)', borderRadius: 8, padding: '10px 14px' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'rgba(0,230,118,.6)' }}>Model Answer</p>
                      <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg),.75)', lineHeight: 1.65 }}>{step.answer}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </>)}
        </div>
      )}

      {/* Quiz */}
      {content.quiz && (
        <div style={{ marginBottom: 24 }}>
          {allQuizAnswered && (
            <div style={{ background: quizScore >= content.quiz.length * 0.8 ? 'rgba(0,230,118,.08)' : 'rgba(255,215,64,.08)', border: `1px solid ${quizScore >= content.quiz.length * 0.8 ? 'rgba(0,230,118,.3)' : 'rgba(255,215,64,.3)'}`, borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Award size={20} color={quizScore >= content.quiz.length * 0.8 ? '#00e676' : '#ffd740'} />
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#fff' }}>{quizScore}/{content.quiz.length} correct — {Math.round(quizScore / content.quiz.length * 100)}%</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(var(--fg),.5)' }}>{quizScore >= content.quiz.length * 0.8 ? 'Excellent work!' : 'Review the explanations below and try again.'}</p>
              </div>
            </div>
          )}
          {content.quiz.map((q, qi) => {
            const answered = quizAnswers[qi] !== undefined;
            const correct = quizAnswers[qi] === q.correct;
            return (
              <div key={qi} style={{ marginBottom: 16, background: 'rgba(var(--fg),.02)', border: '1px solid rgba(var(--fg),.07)', borderRadius: 14, padding: '16px 18px' }}>
                <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: '#fff', lineHeight: 1.5 }}>
                  <span style={{ color: '#ffd740', fontWeight: 800, marginRight: 6 }}>Q{qi + 1}.</span>{q.q}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {q.options.map((opt, oi) => {
                    let bg = 'rgba(var(--fg),.04)';
                    let border = 'rgba(var(--fg),.08)';
                    let color = 'rgba(var(--fg),.75)';
                    if (answered) {
                      if (oi === q.correct) { bg = 'rgba(0,230,118,.1)'; border = 'rgba(0,230,118,.35)'; color = '#00e676'; }
                      else if (oi === quizAnswers[qi] && !correct) { bg = 'rgba(255,82,82,.1)'; border = 'rgba(255,82,82,.35)'; color = '#ff5252'; }
                    }
                    return (
                      <button key={oi}
                        onClick={() => !answered && setQuizAnswers(prev => ({ ...prev, [qi]: oi }))}
                        style={{ padding: '10px 14px', borderRadius: 9, background: bg, border: `1px solid ${border}`, color, fontSize: 12, fontWeight: answered && oi === q.correct ? 700 : 400, cursor: answered ? 'default' : 'pointer', textAlign: 'left', transition: 'all .15s' }}
                      >{opt}</button>
                    );
                  })}
                </div>
                {answered && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(64,196,255,.06)', border: '1px solid rgba(64,196,255,.2)', borderRadius: 8 }}>
                    <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg),.65)', lineHeight: 1.6 }}><span style={{ color: '#40c4ff', fontWeight: 700 }}>Explanation: </span>{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* External Links */}
      {content.links && content.links.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(var(--fg),.35)' }}>Further Reading</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {content.links.map(link => (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.07)', textDecoration: 'none', transition: 'border-color .15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(64,196,255,.3)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(var(--fg),.07)')}
              >
                <ExternalLink size={13} color="#40c4ff" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#40c4ff' }}>{link.title}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(var(--fg),.45)' }}>{link.description}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Citations */}
      {content.citations && content.citations.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(var(--fg),.25)' }}>Sources</p>
          {content.citations.map((c, i) => (
            <p key={i} style={{ margin: '0 0 4px', fontSize: 10, color: 'rgba(var(--fg),.3)', lineHeight: 1.5 }}>• {c}</p>
          ))}
        </div>
      )}

      {/* Footer nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 16, borderTop: '1px solid rgba(var(--fg),.07)', flexWrap: 'wrap', marginTop: 'auto' }}>
        <button onClick={onPrev ?? undefined} disabled={!onPrev}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: 'rgba(var(--fg),.05)', border: '1px solid rgba(var(--fg),.1)', color: onPrev ? 'rgba(var(--fg),.6)' : 'rgba(var(--fg),.2)', fontSize: 12, fontWeight: 600, cursor: onPrev ? 'pointer' : 'not-allowed' }}>
          <ChevronLeft size={13} /> Previous
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {!isComplete && (
            <button
              onClick={onComplete}
              disabled={module.type === 'exercise' ? !allStepsRevealed : module.type === 'quiz' ? !allQuizAnswered : false}
              style={{ padding: '9px 20px', borderRadius: 10, background: '#00e676', color: 'var(--color-bg)', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, opacity: (module.type === 'exercise' && !allStepsRevealed) || (module.type === 'quiz' && !allQuizAnswered) ? 0.4 : 1 }}>
              <CheckCircle size={13} /> Mark Complete
            </button>
          )}
          {onNext && (
            <button onClick={onNext}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, background: 'rgba(0,230,118,.12)', border: '1px solid rgba(0,230,118,.25)', color: '#00e676', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Next <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Course Roadmap ────────────────────────────────────────────────────────────

function CourseRoadmap({
  course, progress, onSelectModule, onBack,
}: {
  course: Course; progress: Record<string, boolean>;
  onSelectModule: (idx: number) => void; onBack: () => void;
}) {
  const completed = course.modules.filter(m => progress[m.id]).length;
  const pct = Math.round((completed / course.modules.length) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Back */}
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(var(--fg),.06)', border: '1px solid rgba(var(--fg),.1)', color: 'rgba(var(--fg),.6)', fontSize: 11, fontWeight: 600, cursor: 'pointer', marginBottom: 20, width: 'fit-content' }}>
        <ChevronLeft size={13} /> All Courses
      </button>

      {/* Course header */}
      <div style={{ background: `linear-gradient(135deg, ${course.color}0a 0%, transparent 60%), rgba(var(--fg),.02)`, border: `1px solid ${course.color}25`, borderRadius: 18, padding: '24px 22px', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <span style={{ ...pill, ...levelStyle(course.level) }}>{course.level}</span>
          {course.tag && <span style={{ ...pill, background: `${course.color}18`, color: course.color, border: `1px solid ${course.color}35` }}>{course.tag}</span>}
          <span style={{ ...pill, background: 'transparent', color: 'rgba(var(--fg),.35)', border: 'none', gap: 4 }}>
            <Clock size={9} /> {course.estimatedHours}h estimated
          </span>
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 800, color: '#fff' }}>{course.title}</h1>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'rgba(var(--fg),.55)', lineHeight: 1.6 }}>{course.description}</p>
        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 99, background: 'rgba(var(--fg),.07)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: course.color, borderRadius: 99, transition: 'width .5s cubic-bezier(.4,0,.2,1)' }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: course.color, flexShrink: 0 }}>{pct}% complete</span>
        </div>
      </div>

      {/* Module list */}
      <p style={{ margin: '0 0 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(var(--fg),.35)' }}>
        Course Curriculum — {course.modules.length} modules
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {course.modules.map((mod, idx) => {
          const done = progress[mod.id];
          const tc = moduleTypeColor(mod.type);
          return (
            <button key={mod.id} onClick={() => onSelectModule(idx)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                borderRadius: 14, background: done ? `${course.color}08` : 'rgba(var(--fg),.03)',
                border: `1px solid ${done ? course.color + '30' : 'rgba(var(--fg),.07)'}`,
                cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = course.color + '40'; (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = done ? course.color + '30' : 'rgba(var(--fg),.07)'; (e.currentTarget as HTMLElement).style.transform = ''; }}
            >
              {/* Step number / check */}
              <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: done ? course.color + '20' : 'rgba(var(--fg),.05)', border: `1px solid ${done ? course.color + '40' : 'rgba(var(--fg),.1)'}` }}>
                {done ? <CheckCircle size={14} color={course.color} /> : <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(var(--fg),.4)' }}>{idx + 1}</span>}
              </div>
              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ color: tc }}>{moduleTypeIcon(mod.type)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: tc, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {mod.type === 'quiz' ? 'Quiz' : mod.type === 'exercise' ? 'Exercise' : 'Lesson'}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(var(--fg),.25)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Clock size={8} />{mod.duration}m
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: done ? 600 : 500, color: done ? '#fff' : 'rgba(var(--fg),.8)' }}>{mod.title}</p>
              </div>
              <Play size={14} color={course.color} opacity={0.6} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Course Card (home grid) ───────────────────────────────────────────────────

function CourseCard({ course, progress, onClick }: {
  course: Course; progress: Record<string, boolean>; onClick: () => void;
}) {
  const completed = course.modules.filter(m => progress[m.id]).length;
  const pct = Math.round((completed / course.modules.length) * 100);
  const [hov, setHov] = useState(false);

  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? `${course.color}0a` : 'rgba(var(--fg),.025)',
        border: `1px solid ${hov ? course.color + '40' : 'rgba(var(--fg),.07)'}`,
        borderRadius: 20, padding: '22px 20px', cursor: 'pointer',
        transition: 'all .2s', transform: hov ? 'translateY(-3px)' : 'none',
        boxShadow: hov ? `0 12px 40px ${course.color}12` : 'none',
        display: 'flex', flexDirection: 'column', gap: 12, position: 'relative', overflow: 'hidden',
      }}>
      {/* Top glow */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${course.color}60, transparent)`, opacity: hov ? 1 : 0, transition: 'opacity .2s' }} />
      {/* Tags */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ ...pill, ...levelStyle(course.level) }}>{course.level}</span>
        {course.tag && <span style={{ ...pill, background: `${course.color}18`, color: course.color, border: `1px solid ${course.color}35` }}>{course.tag}</span>}
      </div>
      {/* Title */}
      <div>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{course.title}</h3>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(var(--fg),.4)' }}>{course.subtitle}</p>
      </div>
      {/* Description */}
      <p style={{ margin: 0, fontSize: 12, color: 'rgba(var(--fg),.55)', lineHeight: 1.65, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{course.description}</p>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'rgba(var(--fg),.35)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BookOpen size={10} /> {course.modules.length} modules</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={10} /> {course.estimatedHours}h</span>
      </div>
      {/* Progress */}
      {pct > 0 && (
        <div>
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(var(--fg),.07)', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: course.color, borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: 10, color: course.color, fontWeight: 700 }}>{pct}% complete</span>
        </div>
      )}
      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: course.color, marginTop: 'auto' }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>{pct === 0 ? 'Start course' : pct === 100 ? 'Review course' : 'Continue'}</span>
        <ChevronRight size={13} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Learn() {
  const [progress, setProgress] = useState<Record<string, boolean>>(loadProgress);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeModuleIdx, setActiveModuleIdx] = useState<number | null>(null);

  const activeCourse = COURSES.find(c => c.id === activeCourseId) ?? null;
  const activeModule = activeCourse && activeModuleIdx !== null ? activeCourse.modules[activeModuleIdx] : null;

  const markComplete = (moduleId: string) => {
    setProgress(prev => {
      const next = { ...prev, [moduleId]: true };
      saveProgress(next);
      return next;
    });
  };

  const totalModules = COURSES.reduce((a, c) => a + c.modules.length, 0);
  const totalCompleted = COURSES.reduce((a, c) => a + c.modules.filter(m => progress[m.id]).length, 0);
  const overallPct = Math.round((totalCompleted / totalModules) * 100);

  // Module viewer
  if (activeCourse && activeModule && activeModuleIdx !== null) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
        <ModuleViewer
          module={activeModule}
          moduleIndex={activeModuleIdx}
          totalModules={activeCourse.modules.length}
          isComplete={!!progress[activeModule.id]}
          onComplete={() => { markComplete(activeModule.id); }}
          onPrev={activeModuleIdx > 0 ? () => setActiveModuleIdx(activeModuleIdx - 1) : null}
          onNext={activeModuleIdx < activeCourse.modules.length - 1 ? () => setActiveModuleIdx(activeModuleIdx + 1) : null}
          onBack={() => setActiveModuleIdx(null)}
        />
      </div>
    );
  }

  // Course roadmap
  if (activeCourse) {
    return (
      <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>
        <CourseRoadmap
          course={activeCourse}
          progress={progress}
          onSelectModule={idx => setActiveModuleIdx(idx)}
          onBack={() => setActiveCourseId(null)}
        />
      </div>
    );
  }

  // Courses home
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Award size={22} color="#00e676" />
            Learning Hub
          </h1>
          <p style={{ margin: '5px 0 0', fontSize: 13, color: 'rgba(var(--fg),.45)' }}>
            Full courses on Caribbean &amp; US investing — lessons, exercises, quizzes, and real-world analysis.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(var(--fg),.04)', border: '1px solid rgba(var(--fg),.08)', borderRadius: 12 }}>
          <Zap size={13} color="#00e676" />
          <span style={{ fontSize: 11, color: 'rgba(var(--fg),.5)', fontWeight: 600 }}>{totalCompleted}/{totalModules} modules done</span>
        </div>
      </div>

      {/* Overall progress */}
      <div style={{ background: 'rgba(var(--fg),.03)', border: '1px solid rgba(var(--fg),.07)', borderRadius: 14, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(var(--fg),.7)' }}>Overall Progress</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: '#00e676' }}>{overallPct}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: 'rgba(var(--fg),.07)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${overallPct}%`, background: 'linear-gradient(90deg, #00e676, #40c4ff)', borderRadius: 99, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }} />
        </div>
      </div>

      {/* Course grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {COURSES.map(course => (
          <CourseCard
            key={course.id}
            course={course}
            progress={progress}
            onClick={() => setActiveCourseId(course.id)}
          />
        ))}
      </div>

      {/* Interactive, visual-first simulators */}
      <InteractiveSimulators />

      {/* Quick reference glossary */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={15} color="#00e676" /> Quick Reference — Key Terms
        </h2>
        <div style={{ display: 'grid', gap: 8 }}>
          {[
            ['Market Cap', 'Share Price × Total Shares. The total market value of a company. NCB Financial Group has a market cap over J$300 billion.'],
            ['P/E Ratio', 'Price ÷ Earnings Per Share. How much you pay for each dollar of annual profit. Compare within sectors only.'],
            ['Dividend Yield', 'Annual Dividend ÷ Price × 100. The cash return you receive just from dividends, independent of price changes.'],
            ['Beta', 'A stock\'s volatility relative to the market. Beta 1.5 = 50% more volatile than the index. Higher beta = higher risk and reward.'],
            ['EPS', 'Earnings Per Share = Net Profit ÷ Shares Outstanding. The core driver of stock valuation.'],
            ['Support Level', 'A price where the stock has historically found buyers and bounced. Breaking below support is a bearish signal.'],
            ['Resistance Level', 'A price where selling has historically overwhelmed buying. Breaking above resistance is a bullish signal.'],
            ['Volume', 'Shares traded in a session. High volume confirms price moves; low volume makes price moves suspect.'],
          ].map(([term, def]) => (
            <GlossaryRow key={term} term={term} definition={def} />
          ))}
        </div>
      </section>
    </div>
  );
}

function GlossaryRow({ term, definition }: { term: string; definition: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ background: 'rgba(var(--fg),.025)', border: '1px solid rgba(var(--fg),.07)', borderRadius: 12, overflow: 'hidden', transition: 'border-color .15s' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', cursor: 'pointer', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={11} color="#00e676" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'left' }}>{term}</span>
        </div>
        {open ? <ChevronRight size={13} color="rgba(var(--fg),.35)" style={{ transform: 'rotate(90deg)' }} /> : <ChevronRight size={13} color="rgba(var(--fg),.35)" />}
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(var(--fg),.06)' }}>
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'rgba(var(--fg),.6)', lineHeight: 1.65 }}>{definition}</p>
        </div>
      )}
    </div>
  );
}
