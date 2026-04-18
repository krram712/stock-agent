// ============================================================
// REACT NATIVE MOBILE APP — Complete Implementation
// ============================================================

// ─── src/types/index.ts ──────────────────────────────────────
export type Horizon = 'day' | 'weekly' | 'monthly' | 'quarterly' | 'longterm';
export type Verdict = 'STRONG_BULL' | 'MILD_BULL' | 'NEUTRAL' | 'MILD_BEAR' | 'STRONG_BEAR';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tier: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
}

export interface StockQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  marketCap: string;
  week52High: number;
  week52Low: number;
  timestamp: string;
}

export interface TechnicalIndicators {
  ema9: number; ema20: number; ema50: number; ema200: number;
  sma20: number; sma50: number; sma200: number; vwap: number;
  rsi14: number;
  macdLine: number; macdSignal: number; macdHistogram: number;
  stochK: number; stochD: number; williamsR: number; cci: number;
  bollingerUpper: number; bollingerMiddle: number; bollingerLower: number;
  bollingerWidth: number; bollingerSqueeze: boolean;
  atr14: number; adx14: number;
  cmf: number; mfi: number; obvTrend: string;
  aroonUp: number; aroonDown: number;
  parabolicSar: number; sarBullish: boolean;
  goldenCross: boolean; deathCross: boolean; overallTrend: string;
}

export interface StockAnalysis {
  id: string;
  ticker: string;
  horizon: Horizon;
  overallScore: number;
  verdict: Verdict;
  entryLow: number; entryHigh: number;
  stopLoss: number;
  target1: number; target2: number; target3: number;
  riskReward: number;
  executiveSummary: any;
  technicalAnalysis: any;
  supportResistance: any;
  fundamentals: any;
  entryExitSignals: any;
  bullBearScorecard: any;
  riskFactors: any;
  tradePlan: any;
  customAnalysis?: string;
  createdAt: string;
}

export interface Watchlist {
  id: string;
  name: string;
  tickers: string[];
}


// ─── src/services/api.ts ─────────────────────────────────────
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Request interceptor — attach JWT
    this.client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    // Response interceptor — handle 401 refresh
    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        if (error.response?.status === 401) {
          const refreshToken = await AsyncStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const res = await this.client.post('/api/v1/auth/refresh', null,
                { params: { refreshToken } });
              await AsyncStorage.setItem('accessToken', res.data.accessToken);
              await AsyncStorage.setItem('refreshToken', res.data.refreshToken);
              error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
              return this.client(error.config);
            } catch {
              await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  register = (data: any) => this.client.post('/api/v1/auth/register', data);
  login = (data: any) => this.client.post('/api/v1/auth/login', data);
  logout = (refreshToken: string) =>
    this.client.post('/api/v1/auth/logout', null, { params: { refreshToken } });

  // Stock data
  getQuote = (ticker: string) => this.client.get(`/api/v1/stocks/${ticker}/quote`);
  getTechnicals = (ticker: string) => this.client.get(`/api/v1/stocks/${ticker}/technicals`);
  getHistory = (ticker: string, interval = '1D', range = '3M') =>
    this.client.get(`/api/v1/stocks/${ticker}/history`, { params: { interval, range } });
  searchStocks = (q: string) => this.client.get('/api/v1/stocks/search', { params: { q } });
  getNews = (ticker: string) => this.client.get(`/api/v1/stocks/${ticker}/news`);

  // Analysis
  analyze = (data: { ticker: string; horizon: string; customPrompt?: string; forceRefresh?: boolean }) =>
    this.client.post('/api/v1/analysis', data);
  getAnalysisHistory = (page = 0, size = 20) =>
    this.client.get('/api/v1/analysis/history', { params: { page, size } });

  // Watchlists
  getWatchlists = () => this.client.get('/api/v1/watchlists');
  createWatchlist = (data: any) => this.client.post('/api/v1/watchlists', data);
  updateWatchlistTickers = (id: string, tickers: string[]) =>
    this.client.put(`/api/v1/watchlists/${id}/tickers`, tickers);
  deleteWatchlist = (id: string) => this.client.delete(`/api/v1/watchlists/${id}`);

  // Alerts
  getAlerts = () => this.client.get('/api/v1/alerts');
  createAlert = (data: any) => this.client.post('/api/v1/alerts', data);
  deleteAlert = (id: string) => this.client.delete(`/api/v1/alerts/${id}`);
}

export const api = new ApiService();


// ─── src/store/authStore.ts ──────────────────────────────────
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null, accessToken: null, refreshToken: null, isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await api.login({ email, password });
          const { user, accessToken, refreshToken } = res.data;
          await AsyncStorage.setItem('accessToken', accessToken);
          await AsyncStorage.setItem('refreshToken', refreshToken);
          set({ user, accessToken, refreshToken, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (data) => {
        set({ isLoading: true });
        try {
          const res = await api.register(data);
          const { user, accessToken, refreshToken } = res.data;
          await AsyncStorage.setItem('accessToken', accessToken);
          await AsyncStorage.setItem('refreshToken', refreshToken);
          set({ user, accessToken, refreshToken, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) await api.logout(refreshToken).catch(() => {});
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        set({ user: null, accessToken: null, refreshToken: null });
      },
    }),
    { name: 'auth-storage', storage: createJSONStorage(() => AsyncStorage) }
  )
);


// ─── src/store/analysisStore.ts ──────────────────────────────
import { create } from 'zustand';
import { api } from '../services/api';
import { StockAnalysis, Horizon } from '../types';

interface AnalysisStore {
  currentAnalysis: StockAnalysis | null;
  history: StockAnalysis[];
  isAnalyzing: boolean;
  error: string | null;
  runAnalysis: (ticker: string, horizon: Horizon, customPrompt?: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  clearError: () => void;
}

export const useAnalysisStore = create<AnalysisStore>((set) => ({
  currentAnalysis: null, history: [], isAnalyzing: false, error: null,

  runAnalysis: async (ticker, horizon, customPrompt) => {
    set({ isAnalyzing: true, error: null });
    try {
      const res = await api.analyze({ ticker, horizon, customPrompt });
      set({ currentAnalysis: res.data, isAnalyzing: false });
    } catch (err: any) {
      set({ isAnalyzing: false, error: err.response?.data?.message || 'Analysis failed' });
    }
  },

  loadHistory: async () => {
    try {
      const res = await api.getAnalysisHistory();
      set({ history: res.data.content || [] });
    } catch {}
  },

  clearError: () => set({ error: null }),
}));


// ─── src/navigation/AppNavigator.tsx ────────────────────────
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';

// Screens (defined below)
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import AnalysisScreen from '../screens/AnalysisScreen';
import AnalysisResultScreen from '../screens/AnalysisResultScreen';
import WatchlistScreen from '../screens/WatchlistScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icons: any = {
            Home: focused ? 'home' : 'home-outline',
            Watchlist: focused ? 'list' : 'list-outline',
            History: focused ? 'time' : 'time-outline',
            Profile: focused ? 'person' : 'person-outline',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#00ff88',
        tabBarInactiveTintColor: '#4a6070',
        tabBarStyle: { backgroundColor: '#0a1520', borderTopColor: '#1a2a35' },
        headerStyle: { backgroundColor: '#06101a' },
        headerTintColor: '#c8d6e0',
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Watchlist" component={WatchlistScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useAuthStore();
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#06101a' }, headerTintColor: '#c8d6e0' }}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Analysis" component={AnalysisScreen} options={{ title: 'Stock Analysis' }} />
            <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} options={{ title: 'Analysis Result' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}


// ─── src/screens/HomeScreen.tsx ──────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAnalysisStore } from '../store/analysisStore';
import { Horizon } from '../types';
import { colors } from '../utils/theme';

const HORIZONS: { id: Horizon; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'longterm', label: 'Long Term' },
];

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { runAnalysis, isAnalyzing, error, clearError } = useAnalysisStore();
  const [ticker, setTicker] = useState('');
  const [horizon, setHorizon] = useState<Horizon>('weekly');
  const [customPrompt, setCustomPrompt] = useState('');

  const handleAnalyze = async () => {
    const sym = ticker.trim().toUpperCase();
    if (!sym) return Alert.alert('Error', 'Please enter a ticker symbol');
    clearError();
    await runAnalysis(sym, horizon, customPrompt || undefined);
    navigation.navigate('AnalysisResult');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.dotRow}>
            <View style={styles.dot} />
            <Text style={styles.headerSub}>AXIOM TRADING INTELLIGENCE</Text>
            <View style={styles.dot} />
          </View>
          <Text style={styles.headerTitle}>AI Stock{'\n'}Analysis Agent</Text>
          <Text style={styles.headerCaption}>TECHNICAL · FUNDAMENTAL · PRECISION SIGNALS</Text>
        </View>

        {/* Input Card */}
        <View style={styles.card}>
          <Text style={styles.label}>TICKER SYMBOL</Text>
          <TextInput
            style={styles.tickerInput}
            value={ticker}
            onChangeText={t => setTicker(t.toUpperCase().replace(/[^A-Z.]/g, ''))}
            placeholder="AAPL"
            placeholderTextColor="#1e3545"
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>INVESTMENT HORIZON</Text>
          <View style={styles.horizonRow}>
            {HORIZONS.map(h => (
              <TouchableOpacity
                key={h.id}
                style={[styles.horizonBtn, horizon === h.id && styles.horizonBtnActive]}
                onPress={() => setHorizon(h.id)}
              >
                <Text style={[styles.horizonText, horizon === h.id && styles.horizonTextActive]}>
                  {h.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>CUSTOM PROMPT (OPTIONAL)</Text>
          <TextInput
            style={styles.promptInput}
            value={customPrompt}
            onChangeText={setCustomPrompt}
            placeholder="e.g. Compare with MSFT, check options flow..."
            placeholderTextColor="#1e3545"
            multiline
            numberOfLines={2}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.analyzeBtn, (!ticker.trim() || isAnalyzing) && styles.analyzeBtnDisabled]}
            onPress={handleAnalyze}
            disabled={!ticker.trim() || isAnalyzing}
          >
            {isAnalyzing ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#00ff88" size="small" />
                <Text style={styles.analyzeBtnText}>ANALYZING {ticker}...</Text>
              </View>
            ) : (
              <Text style={styles.analyzeBtnText}>⚡ RUN FULL ANALYSIS</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Quick picks */}
        <View style={styles.quickSection}>
          <Text style={styles.quickTitle}>QUICK PICKS</Text>
          <View style={styles.quickRow}>
            {['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META'].map(t => (
              <TouchableOpacity key={t} style={styles.quickChip} onPress={() => setTicker(t)}>
                <Text style={styles.quickChipText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06101a' },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24, paddingTop: 8 },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00ff88' },
  headerSub: { fontSize: 9, letterSpacing: 3, color: '#00ff88', fontFamily: 'monospace' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 34, marginBottom: 6 },
  headerCaption: { fontSize: 9, color: '#2a4050', letterSpacing: 2, fontFamily: 'monospace' },
  card: { backgroundColor: 'rgba(255,255,255,0.025)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.12)', borderRadius: 14, padding: 18, marginBottom: 16 },
  label: { fontSize: 8, letterSpacing: 2, color: '#3d5a6e', marginBottom: 6, fontFamily: 'monospace' },
  tickerInput: { backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.35)', borderRadius: 8, padding: 12, color: '#00ff88', fontSize: 22, fontWeight: '800', fontFamily: 'monospace', letterSpacing: 4 },
  horizonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  horizonBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  horizonBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: 'rgba(0,255,136,0.6)' },
  horizonText: { fontSize: 11, color: '#3d5a6e', fontFamily: 'monospace', fontWeight: '600' },
  horizonTextActive: { color: '#00ff88' },
  promptInput: { backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: 10, color: '#c8d6e0', fontSize: 13, minHeight: 60 },
  errorText: { color: '#ef4444', fontSize: 12, marginTop: 8 },
  analyzeBtn: { marginTop: 14, padding: 14, backgroundColor: 'rgba(0,255,136,0.15)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.4)', borderRadius: 9, alignItems: 'center' },
  analyzeBtnDisabled: { backgroundColor: 'rgba(0,255,136,0.03)', borderColor: 'rgba(0,255,136,0.1)' },
  analyzeBtnText: { color: '#00ff88', fontSize: 12, fontWeight: '700', fontFamily: 'monospace', letterSpacing: 3 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quickSection: { marginTop: 8 },
  quickTitle: { fontSize: 8, letterSpacing: 2, color: '#2a4050', marginBottom: 8, fontFamily: 'monospace' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 6 },
  quickChipText: { color: '#4a6a7e', fontSize: 12, fontFamily: 'monospace', fontWeight: '600' },
});


// ─── src/screens/AnalysisResultScreen.tsx ───────────────────
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAnalysisStore } from '../store/analysisStore';
import { Verdict } from '../types';

const VERDICT_COLORS: Record<Verdict, string> = {
  STRONG_BULL: '#00ff88', MILD_BULL: '#fbbf24',
  NEUTRAL: '#94a3b8', MILD_BEAR: '#fb923c', STRONG_BEAR: '#ef4444',
};
const VERDICT_EMOJI: Record<Verdict, string> = {
  STRONG_BULL: '🐂', MILD_BULL: '📈', NEUTRAL: '⚖️', MILD_BEAR: '📉', STRONG_BEAR: '🐻',
};

function ScoreRing({ score, verdict }: { score: number; verdict: Verdict }) {
  const color = VERDICT_COLORS[verdict] || '#64748b';
  return (
    <View style={[rStyles.ring, { borderColor: color }]}>
      <Text style={[rStyles.score, { color }]}>{score}</Text>
      <Text style={rStyles.scoreLabel}>/100</Text>
    </View>
  );
}

function SectionCard({ title, color, children }: any) {
  const [open, setOpen] = useState(true);
  return (
    <View style={[sStyles.card, { borderLeftColor: color }]}>
      <TouchableOpacity style={sStyles.header} onPress={() => setOpen(o => !o)}>
        <Text style={[sStyles.title, { color }]}>{title}</Text>
        <Text style={sStyles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && <View style={sStyles.body}>{children}</View>}
    </View>
  );
}

function InfoRow({ label, value, valueColor }: any) {
  return (
    <View style={iStyles.row}>
      <Text style={iStyles.label}>{label}</Text>
      <Text style={[iStyles.value, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

export default function AnalysisResultScreen() {
  const { currentAnalysis, isAnalyzing } = useAnalysisStore();

  if (isAnalyzing) {
    return (
      <View style={resultStyles.loading}>
        <ActivityIndicator size="large" color="#00ff88" />
        <Text style={resultStyles.loadingText}>Analyzing market data...</Text>
      </View>
    );
  }

  if (!currentAnalysis) {
    return (
      <View style={resultStyles.loading}>
        <Text style={resultStyles.loadingText}>No analysis available</Text>
      </View>
    );
  }

  const a = currentAnalysis;
  const verdictColor = VERDICT_COLORS[a.verdict] || '#64748b';

  return (
    <ScrollView style={resultStyles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Banner */}
      <View style={resultStyles.banner}>
        <ScoreRing score={a.overallScore} verdict={a.verdict} />
        <View style={{ flex: 1 }}>
          <Text style={resultStyles.bannerTicker}>{a.ticker}</Text>
          <Text style={[resultStyles.bannerVerdict, { color: verdictColor }]}>
            {VERDICT_EMOJI[a.verdict]} {a.verdict.replace('_', ' ')}
          </Text>
          <Text style={resultStyles.bannerHorizon}>{a.horizon.toUpperCase()}</Text>
        </View>
      </View>

      <View style={{ padding: 14 }}>
        {/* Entry/Exit Quick Summary */}
        <View style={resultStyles.signalCard}>
          <Text style={resultStyles.signalTitle}>TRADE SIGNALS</Text>
          <View style={resultStyles.signalGrid}>
            <View style={resultStyles.signalItem}>
              <Text style={resultStyles.signalLabel}>ENTRY</Text>
              <Text style={[resultStyles.signalValue, { color: '#00ff88' }]}>
                ${a.entryLow?.toFixed(2)} – ${a.entryHigh?.toFixed(2)}
              </Text>
            </View>
            <View style={resultStyles.signalItem}>
              <Text style={resultStyles.signalLabel}>STOP</Text>
              <Text style={[resultStyles.signalValue, { color: '#ef4444' }]}>
                ${a.stopLoss?.toFixed(2)}
              </Text>
            </View>
            <View style={resultStyles.signalItem}>
              <Text style={resultStyles.signalLabel}>T1</Text>
              <Text style={[resultStyles.signalValue, { color: '#fbbf24' }]}>
                ${a.target1?.toFixed(2)}
              </Text>
            </View>
            <View style={resultStyles.signalItem}>
              <Text style={resultStyles.signalLabel}>T2</Text>
              <Text style={[resultStyles.signalValue, { color: '#fbbf24' }]}>
                ${a.target2?.toFixed(2)}
              </Text>
            </View>
            <View style={resultStyles.signalItem}>
              <Text style={resultStyles.signalLabel}>T3</Text>
              <Text style={[resultStyles.signalValue, { color: '#fbbf24' }]}>
                ${a.target3?.toFixed(2)}
              </Text>
            </View>
            <View style={resultStyles.signalItem}>
              <Text style={resultStyles.signalLabel}>R/R</Text>
              <Text style={[resultStyles.signalValue, { color: '#00d4ff' }]}>
                1:{a.riskReward?.toFixed(1)}
              </Text>
            </View>
          </View>
        </View>

        {/* Sections */}
        <SectionCard title="⚡ Executive Summary" color="#00ff88">
          <Text style={resultStyles.sectionText}>
            {typeof a.executiveSummary === 'string' ? a.executiveSummary : JSON.stringify(a.executiveSummary, null, 2)}
          </Text>
        </SectionCard>

        <SectionCard title="📐 Technical Analysis" color="#fbbf24">
          {a.technicalAnalysis && Object.entries(a.technicalAnalysis as any).map(([k, v]) => (
            <InfoRow key={k} label={k} value={String(v)} />
          ))}
        </SectionCard>

        <SectionCard title="🎯 Support & Resistance" color="#f97316">
          {a.supportResistance && Object.entries(a.supportResistance as any).map(([k, v]) => (
            <InfoRow key={k} label={k.toUpperCase()} value={`$${Number(v).toFixed(2)}`} />
          ))}
        </SectionCard>

        <SectionCard title="🏛 Fundamentals" color="#34d399">
          {a.fundamentals && Object.entries(a.fundamentals as any).slice(0, 12).map(([k, v]) => (
            <InfoRow key={k} label={k} value={String(v)} />
          ))}
        </SectionCard>

        <SectionCard title="🐂🐻 Bull/Bear Scorecard" color="#ff9f43">
          {a.bullBearScorecard && Object.entries(a.bullBearScorecard as any).map(([k, v]) => (
            <InfoRow key={k} label={k} value={String(v)} />
          ))}
        </SectionCard>

        <SectionCard title="⚠️ Risk Factors" color="#ef4444">
          <Text style={resultStyles.sectionText}>
            {typeof a.riskFactors === 'string' ? a.riskFactors : JSON.stringify(a.riskFactors, null, 2)}
          </Text>
        </SectionCard>

        <SectionCard title="📋 Trade Plan" color="#00ff88">
          <Text style={resultStyles.sectionText}>
            {typeof a.tradePlan === 'string' ? a.tradePlan : JSON.stringify(a.tradePlan, null, 2)}
          </Text>
        </SectionCard>

        {a.customAnalysis && (
          <SectionCard title="💬 Custom Analysis" color="#e879f9">
            <Text style={resultStyles.sectionText}>{a.customAnalysis}</Text>
          </SectionCard>
        )}
      </View>
    </ScrollView>
  );
}

const resultStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06101a' },
  loading: { flex: 1, backgroundColor: '#06101a', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#3a7058', fontFamily: 'monospace', fontSize: 13 },
  banner: { backgroundColor: 'rgba(0,255,136,0.05)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,255,136,0.1)', padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16 },
  bannerTicker: { fontSize: 28, fontWeight: '800', color: '#00ff88', fontFamily: 'monospace', letterSpacing: 2 },
  bannerVerdict: { fontSize: 16, fontWeight: '700', fontFamily: 'monospace', marginVertical: 2 },
  bannerHorizon: { fontSize: 9, color: '#2a4050', fontFamily: 'monospace', letterSpacing: 2 },
  signalCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 14, marginBottom: 12 },
  signalTitle: { fontSize: 9, letterSpacing: 2, color: '#3d5a6e', fontFamily: 'monospace', marginBottom: 12 },
  signalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  signalItem: { flex: 1, minWidth: '28%', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: 8, alignItems: 'center' },
  signalLabel: { fontSize: 9, color: '#3d5a6e', fontFamily: 'monospace', letterSpacing: 1, marginBottom: 4 },
  signalValue: { fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  sectionText: { color: '#8ba0b0', fontSize: 12, lineHeight: 20, fontFamily: 'monospace' },
});

const rStyles = StyleSheet.create({
  ring: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: 24, fontWeight: '800', fontFamily: 'monospace', lineHeight: 28 },
  scoreLabel: { fontSize: 9, color: '#3d5a6e', fontFamily: 'monospace' },
});

const sStyles = StyleSheet.create({
  card: { backgroundColor: 'rgba(255,255,255,0.018)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)', borderLeftWidth: 3, borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  header: { padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  chevron: { fontSize: 9, color: '#3d5a6e' },
  body: { padding: 12, paddingTop: 0 },
});

const iStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  label: { fontSize: 11, color: '#3d5a6e', fontFamily: 'monospace', flex: 1 },
  value: { fontSize: 11, color: '#8ba0b0', fontFamily: 'monospace', textAlign: 'right', flex: 1 },
});


// ─── package.json ────────────────────────────────────────────
/*
{
  "name": "axiom-mobile",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "build:android": "eas build --platform android",
    "build:ios": "eas build --platform ios"
  },
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.0",
    "expo-status-bar": "~1.12.1",
    "react": "18.2.0",
    "react-native": "0.74.5",
    "@react-navigation/native": "^6.1.17",
    "@react-navigation/native-stack": "^6.9.26",
    "@react-navigation/bottom-tabs": "^6.5.20",
    "@react-native-async-storage/async-storage": "1.23.1",
    "axios": "^1.7.4",
    "zustand": "^4.5.4",
    "@expo/vector-icons": "^14.0.2",
    "react-native-safe-area-context": "4.10.5",
    "react-native-screens": "3.31.1",
    "victory-native": "^41.1.0",
    "react-native-gesture-handler": "~2.17.1",
    "react-native-reanimated": "~3.10.1",
    "expo-notifications": "~0.28.9",
    "expo-secure-store": "~13.0.2"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.79",
    "typescript": "~5.3.3"
  }
}
*/
