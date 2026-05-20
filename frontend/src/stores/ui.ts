import { create } from 'zustand';

export type AuthModalView = 'login' | 'signup' | '2fa' | 'forgot' | 'reset';
export type Theme = 'dark' | 'light';

interface UIState {
  authModalOpen: boolean;
  authModalView: AuthModalView;
  stockDetailSymbol: string | null;
  theme: Theme;
  focusMode: boolean;
  tosAccepted: boolean;
}

interface UIActions {
  openAuthModal: (view?: AuthModalView) => void;
  closeAuthModal: () => void;
  setAuthModalView: (view: AuthModalView) => void;
  openStockDetail: (symbol: string) => void;
  closeStockDetail: () => void;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  toggleFocusMode: () => void;
  acceptTos: () => void;
}

type UIStore = UIState & UIActions;

const savedTheme = (localStorage.getItem('gf_theme') as Theme) ?? 'dark';
const tosAccepted = !!localStorage.getItem('gf_tos');

export const useUIStore = create<UIStore>((set, get) => ({
  authModalOpen: false,
  authModalView: 'login',
  stockDetailSymbol: null,
  theme: savedTheme,
  focusMode: false,
  tosAccepted,

  openAuthModal: (view = 'login') => set({ authModalOpen: true, authModalView: view }),
  closeAuthModal: () => set({ authModalOpen: false, authModalView: 'login' }),
  setAuthModalView: (view) => set({ authModalView: view }),
  openStockDetail: (symbol) => set({ stockDetailSymbol: symbol }),
  closeStockDetail: () => set({ stockDetailSymbol: null }),

  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('gf_theme', next);
    set({ theme: next });
  },
  setTheme: (t) => {
    localStorage.setItem('gf_theme', t);
    set({ theme: t });
  },
  toggleFocusMode: () => set(s => ({ focusMode: !s.focusMode })),
  acceptTos: () => {
    localStorage.setItem('gf_tos', '1');
    set({ tosAccepted: true });
  },
}));
