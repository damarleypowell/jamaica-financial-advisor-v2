import { create } from 'zustand';

export type AuthModalView = 'login' | 'signup' | '2fa' | 'forgot' | 'reset';

interface UIState {
  authModalOpen: boolean;
  authModalView: AuthModalView;
  stockDetailSymbol: string | null;
}

interface UIActions {
  openAuthModal: (view?: AuthModalView) => void;
  closeAuthModal: () => void;
  setAuthModalView: (view: AuthModalView) => void;
  openStockDetail: (symbol: string) => void;
  closeStockDetail: () => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set) => ({
  authModalOpen: false,
  authModalView: 'login',
  stockDetailSymbol: null,

  openAuthModal: (view = 'login') =>
    set({ authModalOpen: true, authModalView: view }),

  closeAuthModal: () =>
    set({ authModalOpen: false, authModalView: 'login' }),

  setAuthModalView: (view) => set({ authModalView: view }),

  openStockDetail: (symbol) => set({ stockDetailSymbol: symbol }),

  closeStockDetail: () => set({ stockDetailSymbol: null }),
}));
