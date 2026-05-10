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
export const uploadService = {
  uploadCSV: (file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
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
  getSummary:         (params) => api.get('/analytics/summary', { params }).then(r => r.data),
  getRevenueByRegion: ()       => api.get('/analytics/revenue-by-region').then(r => r.data),
  getRevenueByProduct:(limit = 10) => api.get('/analytics/revenue-by-product', { params: { limit } }).then(r => r.data),
  getRevenueTrend:    ()       => api.get('/analytics/trend').then(r => r.data),
  getKPIs:            ()       => api.get('/analytics/kpis').then(r => r.data),
};

// ── Forecast ──────────────────────────────────────────────────────────────
export const forecastService = {
  generate:    (periods = 7) => api.post('/forecast/generate', { periods }).then(r => r.data),
  getHistory:  ()            => api.get('/forecast/history').then(r => r.data),
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
