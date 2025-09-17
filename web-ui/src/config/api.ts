// Use environment variable or default to backend URL
// In Docker: REACT_APP_API_URL will be set to http://localhost:3000
const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT = parseInt(process.env.REACT_APP_API_TIMEOUT || '30000', 10);

export const apiConfig = {
  baseUrl: API_BASE_URL,
  timeout: API_TIMEOUT,
  endpoints: {
    auth: {
      signin: '/api/auth/signin',
      signup: '/api/auth/signup',
      refresh: '/api/auth/refresh',
      me: '/api/auth/me',
    },
    rfq: {
      parse: '/api/rfqs/parse',
      map: '/api/rfqs/runs/:runId/map',
      getRun: '/api/rfqs/runs/:runId',
    },
    quotes: {
      create: '/api/quotes',
      get: '/api/quotes/:quoteId',
      list: '/api/quotes',
      pdf: '/api/quotes/:quoteId/pdf',
    },
    credits: {
      get: '/api/credits',
      set: '/api/credits/set',
      purchase: '/api/credits/purchase',
    },
    sku: {
      test: '/api/sku/test',
    },
    schemas: {
      list: '/api/schemas',
    },
    dashboard: {
      stats: '/api/dashboard/stats',
    },
  },
};

export const getApiUrl = (endpoint: string): string => {
  return `${apiConfig.baseUrl}${endpoint}`;
};