import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const apiClient = axios.create({ baseURL: BASE_URL, timeout: 30000 });

const getAccessToken = (): string | null => {
  const direct = localStorage.getItem('accessToken');
  if (direct) return direct;

  // Fallback: token may exist only in Zustand persisted state after first load.
  // Do NOT fall back if axiom-storage was explicitly cleared (logout / failed refresh).
  try {
    const raw = localStorage.getItem('axiom-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = parsed?.state?.accessToken;
    if (typeof token === 'string' && token.length > 0) {
      localStorage.setItem('accessToken', token);
      return token;
    }
  } catch {
    // Ignore malformed storage and proceed without token.
  }
  return null;
};

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await apiClient.post('/api/v1/auth/refresh', null, { params: { refreshToken } });
          localStorage.setItem('accessToken', res.data.accessToken);
          localStorage.setItem('refreshToken', res.data.refreshToken);
          error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return apiClient(error.config);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('axiom-storage'); // clear Zustand cache so LoginPage doesn't auto-redirect back
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  auth: {
    login: (d: any)      => apiClient.post('/api/v1/auth/login', d),
    register: (d: any)   => apiClient.post('/api/v1/auth/register', d),
    logout: (rt: string) => apiClient.post('/api/v1/auth/logout', null, { params: { refreshToken: rt } }),
  },
  stocks: {
    quote: (t: string)                         => apiClient.get(`/api/v1/stocks/${t}/quote`),
    technicals: (t: string)                    => apiClient.get(`/api/v1/stocks/${t}/technicals`),
    history: (t: string, i = '1D', r = '3M')  => apiClient.get(`/api/v1/stocks/${t}/history`, { params: { interval: i, range: r } }),
    news: (t: string)                          => apiClient.get(`/api/v1/stocks/${t}/news`),
    search: (q: string)                        => apiClient.get('/api/v1/stocks/search', { params: { q } }),
    fundamentals: (t: string)                  => apiClient.get(`/api/v1/stocks/${t}/fundamentals`),
  },
  analysis: {
    run: (d: any)              => apiClient.post('/api/v1/analysis', d),
    history: (page=0, size=20) => apiClient.get('/api/v1/analysis/history', { params: { page, size } }),
    getById: (id: string)      => apiClient.get(`/api/v1/analysis/${id}`),
  },
  watchlists: {
    getAll: ()                             => apiClient.get('/api/v1/watchlists'),
    create: (d: any)                       => apiClient.post('/api/v1/watchlists', d),
    updateTickers: (id: string, t: any[])  => apiClient.put(`/api/v1/watchlists/${id}/tickers`, t),
    delete: (id: string)                   => apiClient.delete(`/api/v1/watchlists/${id}`),
  },
  alerts: {
    getAll: ()            => apiClient.get('/api/v1/alerts'),
    create: (d: any)      => apiClient.post('/api/v1/alerts', d),
    delete: (id: string)  => apiClient.delete(`/api/v1/alerts/${id}`),
  },
  scripts: {
    getAll: (category?: string)    => apiClient.get('/api/v1/scripts', { params: category ? { category } : {} }),
    getById: (id: string)          => apiClient.get(`/api/v1/scripts/${id}`),
    create: (d: any)               => apiClient.post('/api/v1/scripts', d),
    update: (id: string, d: any)   => apiClient.put(`/api/v1/scripts/${id}`, d),
    delete: (id: string)           => apiClient.delete(`/api/v1/scripts/${id}`),
  },
  admin: {
    listUsers:   ()           => apiClient.get('/api/v1/admin/users'),
    approveUser: (id: string) => apiClient.put(`/api/v1/admin/users/${id}/approve`),
    rejectUser:  (id: string) => apiClient.put(`/api/v1/admin/users/${id}/reject`),
  },
};

