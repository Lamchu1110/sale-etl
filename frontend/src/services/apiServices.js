import api from './api';

// ── Auth ──────────────────────────────────────────────────────────────────
export const authService = {
  login: (usernameOrEmail, password) =>
    api.post('/auth/login', { username_or_email: usernameOrEmail, password }).then(r => r.data),
  getMe: () => api.get('/auth/me').then(r => r.data),
  register: (username, email, password, role = 'user') =>
    api.post('/auth/register', { username, email, password, role }).then(r => r.data),
};

// ── Upload ────────────────────────────────────────────────────────────────
export const businessService = {
  getAll: () => api.get('/businesses').then(r => r.data),
  create: (data) => api.post('/businesses', data).then(r => r.data),
};

export const uploadService = {
  uploadCSV: (file, onProgress, metadata = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('business_id', metadata.business_id || 1);
    if (metadata.data_year) form.append('data_year', metadata.data_year);
    form.append('data_type', metadata.data_type || 'base');
    return api.post('/uploads/csv', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: e => onProgress && onProgress(Math.round((e.loaded * 100) / e.total)),
    }).then(r => r.data);
  },
  getBatches: () => api.get('/uploads/batches').then(r => r.data),
  getBatch:   (id) => api.get(`/uploads/batches/${id}`).then(r => r.data),
};

// ── ETL ───────────────────────────────────────────────────────────────────
export const etlService = {
  runETL:      (batchId) => api.post(`/etl/process/${batchId}`).then(r => r.data),
  getLogs:     (batchId) => api.get(`/etl/logs/${batchId}`).then(r => r.data),
  getQuality:  (batchId) => api.get(`/etl/quality/${batchId}`).then(r => r.data),
  getPreview:  (batchId) => api.get(`/etl/preview/${batchId}`).then(r => r.data),
};

// ── Analytics ─────────────────────────────────────────────────────────────
export const analyticsService = {
  getFilterOptions:   ()       => api.get('/analytics/filters').then(r => r.data),
  getSummary:         (params) => api.get('/analytics/summary', { params }).then(r => r.data),
  getRevenueByRegion: (params) => api.get('/analytics/revenue-by-region', { params }).then(r => r.data),
  getRevenueByProduct:(limit = 10, params = {}) => api.get('/analytics/revenue-by-product', { params: { ...params, limit } }).then(r => r.data),
  getRevenueTrend:    (params) => api.get('/analytics/trend', { params }).then(r => r.data),
  getKPIs:            (params) => api.get('/analytics/kpis', { params }).then(r => r.data),
};

// ── Forecast ──────────────────────────────────────────────────────────────
export const forecastService = {
  generate:    (payload) => api.post('/forecast/generate', payload).then(r => r.data),
  getHistory:  (params)  => api.get('/forecast/history', { params }).then(r => r.data),
  getRun:      (id)      => api.get(`/forecast/runs/${id}`).then(r => r.data),
};

export const evaluationService = {
  evaluateRun: (forecastRunId) => api.post(`/evaluation/forecast-runs/${forecastRunId}`).then(r => r.data),
  getHistory:  (params) => api.get('/evaluation/history', { params }).then(r => r.data),
  getDetail:   (id) => api.get(`/evaluation/${id}`).then(r => r.data),
  exportCsv:   (id) => api.get(`/evaluation/${id}/export`, { responseType: 'blob' }).then(r => r.data),
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const adminService = {
  // Batches
  getAllBatches:   (params) => api.get('/admin/batches', { params }).then(r => r.data),
  getBatchDetail:  (id)     => api.get(`/admin/batches/${id}`).then(r => r.data),
  updateBatch:     (id, data) => api.patch(`/admin/batches/${id}`, data).then(r => r.data),
  deleteBatch:     (id)     => api.delete(`/admin/batches/${id}`).then(r => r.data),

  // Logs & Quality
  getAllLogs:      (params) => api.get('/admin/logs', { params }).then(r => r.data),
  getAllQuality:   (params) => api.get('/admin/quality', { params }).then(r => r.data),
  getTechSummary:  ()       => api.get('/admin/technical-summary').then(r => r.data),

  // Users
  getUsers:        ()       => api.get('/admin/users').then(r => r.data),
  createUser:      (data)   => api.post('/admin/users', data).then(r => r.data),
  updateUser:      (id, data) => api.patch(`/admin/users/${id}`, data).then(r => r.data),
  deleteUser:      (id)     => api.delete(`/admin/users/${id}`).then(r => r.data),
};
