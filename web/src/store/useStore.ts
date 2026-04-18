import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

interface AppState {
  user: any;
  accessToken: string | null;
  isLoading: boolean;
  currentAnalysis: any;
  analysisHistory: any[];
  isAnalyzing: boolean;
  analysisError: string | null;
  watchlists: any[];

  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
  runAnalysis: (ticker: string, horizon: string, customPrompt?: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  loadWatchlists: () => Promise<void>;
  clearAnalysisError: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null, accessToken: null, isLoading: false,
      currentAnalysis: null, analysisHistory: [], isAnalyzing: false, analysisError: null,
      watchlists: [],

      login: async (email, password) => {
        set({ isLoading: true });
        const res = await api.auth.login({ email, password });
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        set({ user: res.data.user, accessToken: res.data.accessToken, isLoading: false });
      },

      register: async (data) => {
        set({ isLoading: true });
        const res = await api.auth.register(data);
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('refreshToken', res.data.refreshToken);
        set({ user: res.data.user, accessToken: res.data.accessToken, isLoading: false });
      },

      logout: async () => {
        const rt = localStorage.getItem('refreshToken');
        if (rt) await api.auth.logout(rt).catch(() => {});
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, currentAnalysis: null });
      },

      runAnalysis: async (ticker, horizon, customPrompt) => {
        set({ isAnalyzing: true, analysisError: null });
        try {
          const res = await api.analysis.run({ ticker, horizon, customPrompt });
          set({ currentAnalysis: res.data, isAnalyzing: false });
        } catch (err: any) {
          set({ isAnalyzing: false, analysisError: err.response?.data?.message || 'Analysis failed. Ensure the backend is running.' });
        }
      },

      loadHistory: async () => {
        const res = await api.analysis.history();
        set({ analysisHistory: res.data.content || [] });
      },

      loadWatchlists: async () => {
        const res = await api.watchlists.getAll();
        set({ watchlists: res.data });
      },

      clearAnalysisError: () => set({ analysisError: null }),
    }),
    { name: 'axiom-storage', partialize: (s) => ({ user: s.user, accessToken: s.accessToken }) }
  )
);

