import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  TrendingUp, Play, Loader, Clock, BarChart2, Building2,
  CalendarDays, BrainCircuit, Sigma, Eye
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { analyticsService, forecastService } from '../../services/apiServices';
import styles from './ForecastPage.module.css';

const MODEL_OPTIONS = [
  { value: 'holt_winters', label: 'Holt-Winters' },
  { value: 'moving_average', label: 'Moving Average' },
];

const fmtCurrency = (n) => {
  if (n == null) return '-';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Number(n).toLocaleString()}`;
};

const modelLabel = (modelName) => MODEL_OPTIONS.find(model => model.value === modelName)?.label || modelName;

export default function ForecastPage() {
  const [filterOptions, setFilterOptions] = useState({ businesses: [], years: [] });
  const [filters, setFilters] = useState({ business_id: '', base_year: '', model_name: 'holt_winters' });
  const [forecast, setForecast] = useState(null);
  const [history, setHistory] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingRunId, setLoadingRunId] = useState(null);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const options = await analyticsService.getFilterOptions();
        setFilterOptions(options);

        const defaultBusinessId = options.default_business_id || options.businesses?.[0]?.id || '';
        const defaultBusiness = options.businesses?.find(
          business => Number(business.id) === Number(defaultBusinessId)
        );
        const yearPool = defaultBusiness?.years?.length ? defaultBusiness.years : options.years;
        const defaultYear = options.default_year || yearPool?.[0] || '';

        setFilters(prev => ({
          ...prev,
          business_id: defaultBusinessId,
          base_year: defaultYear,
        }));
      } catch (err) {
        toast.error('Failed to load forecast filters');
        console.error('Forecast filters load failed:', err);
      } finally {
        setLoading(false);
      }
    };

    loadFilters();
  }, []);

  useEffect(() => {
    if (!filters.business_id || !filters.base_year) return;

    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const params = {
          business_id: Number(filters.business_id),
          base_year: Number(filters.base_year),
        };
        const data = await forecastService.getHistory(params);
        setHistory(Array.isArray(data) ? data : []);
      } catch (err) {
        toast.error('Failed to load forecast history');
        console.error('Forecast history load failed:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [filters.business_id, filters.base_year]);

  const selectedBusiness = filterOptions.businesses?.find(
    business => Number(business.id) === Number(filters.business_id)
  );
  const availableYears = selectedBusiness?.years?.length ? selectedBusiness.years : filterOptions.years || [];
  const chartData = forecast?.results || [];
  const totalPredicted = chartData.reduce((sum, row) => sum + Number(row.predicted_revenue || 0), 0);
  const avgPredicted = chartData.length ? totalPredicted / chartData.length : 0;

  const handleBusinessChange = (event) => {
    const nextBusinessId = Number(event.target.value);
    const nextBusiness = filterOptions.businesses?.find(business => Number(business.id) === nextBusinessId);
    const nextYears = nextBusiness?.years?.length ? nextBusiness.years : filterOptions.years || [];
    const currentYear = Number(filters.base_year);
    const nextYear = nextYears.includes(currentYear) ? currentYear : nextYears[0] || '';
    setForecast(null);
    setFilters(prev => ({ ...prev, business_id: nextBusinessId, base_year: nextYear }));
  };

  const handleBaseYearChange = (event) => {
    setForecast(null);
    setFilters(prev => ({ ...prev, base_year: Number(event.target.value) }));
  };

  const handleModelChange = (event) => {
    setForecast(null);
    setFilters(prev => ({ ...prev, model_name: event.target.value }));
  };

  const handleGenerate = async () => {
    if (!filters.business_id || !filters.base_year) {
      toast.error('Please select business and base year first');
      return;
    }

    setGenerating(true);
    try {
      const payload = {
        business_id: Number(filters.business_id),
        base_year: Number(filters.base_year),
        model_name: filters.model_name,
      };
      const result = await forecastService.generate(payload);
      setForecast(result);
      toast.success(`Forecast generated for ${result.target_year}`);

      const historyData = await forecastService.getHistory({
        business_id: payload.business_id,
        base_year: payload.base_year,
      });
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Forecast generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleViewRun = async (runId) => {
    setLoadingRunId(runId);
    try {
      const run = await forecastService.getRun(runId);
      setForecast(run);
      setFilters(prev => ({
        ...prev,
        business_id: run.business_id,
        base_year: run.base_year,
        model_name: run.model_name,
      }));
      toast.success(`Loaded forecast run #${run.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load forecast run');
    } finally {
      setLoadingRunId(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className={styles.loading}>
          <Loader size={24} className={styles.spinAnim} />
          <span>Loading forecast setup...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="fade-in">
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Revenue Forecast</h1>
            <p className={styles.pageDesc}>Forecast the next 12 months from base-year monthly revenue</p>
          </div>
        </div>

        <div className={styles.generateCard}>
          <div className={styles.field}>
            <label className={styles.label}><Building2 size={13} /> Business</label>
            <select className={styles.select} value={filters.business_id} onChange={handleBusinessChange}>
              {filterOptions.businesses?.map(business => (
                <option key={business.id} value={business.id}>{business.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}><CalendarDays size={13} /> Base Year</label>
            <select className={styles.select} value={filters.base_year} onChange={handleBaseYearChange}>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label}><BrainCircuit size={13} /> Model</label>
            <select className={styles.select} value={filters.model_name} onChange={handleModelChange}>
              {MODEL_OPTIONS.map(model => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
            </select>
          </div>

          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={generating || !filters.business_id || !filters.base_year}
          >
            {generating
              ? <><span className={styles.spinner} /> Generating...</>
              : <><Play size={14} /> Generate 12-Month Forecast</>
            }
          </button>
        </div>

        {chartData.length > 0 && (
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Target Year</span>
              <strong className={styles.summaryValue}>{forecast.target_year}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total Forecast</span>
              <strong className={styles.summaryValue}>{fmtCurrency(totalPredicted)}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Avg Monthly</span>
              <strong className={styles.summaryValue}>{fmtCurrency(avgPredicted)}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Model Engine</span>
              <strong className={styles.summaryValue}>{forecast.parameters?.engine || forecast.model_name}</strong>
            </div>
          </div>
        )}

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>
            <TrendingUp size={16} /> Predicted Monthly Revenue
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" tickFormatter={value => value?.slice(5) || value} />
                <YAxis
                  tickFormatter={value => fmtCurrency(value)}
                  domain={[0, 'dataMax']}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip
                  formatter={(value) => [fmtCurrency(value), 'Predicted Revenue']}
                  labelFormatter={label => `Month: ${label}`}
                  contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="predicted_revenue"
                  stroke="#06B6D4"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  dot={{ r: 3, fill: '#06B6D4' }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.emptyChart}>
              <BarChart2 size={40} color="#CBD5E1" />
              <p>No forecast generated yet. Choose a base year and click generate.</p>
            </div>
          )}
        </div>

        <h3 className={styles.sectionTitle}>
          <Clock size={16} /> Forecast History
        </h3>
        {loadingHistory ? (
          <div className={styles.loading}>
            <Loader size={24} className={styles.spinAnim} />
            <span>Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <div className={styles.chartCard}>
            <div className={styles.emptyChart}>
              <Clock size={32} color="#CBD5E1" />
              <p>No forecast history for this selection.</p>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Business</th>
                  <th>Years</th>
                  <th>Model</th>
                  <th>Total Forecast</th>
                  <th>Rows</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row, i) => (
                  <tr key={row.id || i} className="fade-in">
                    <td className={styles.numCell}>#{row.id}</td>
                    <td>{row.business_name || `Business #${row.business_id}`}</td>
                    <td>{row.base_year} to {row.target_year}</td>
                    <td>
                      <span className={styles.modelTag}>
                        <Sigma size={12} /> {modelLabel(row.model_name)}
                      </span>
                    </td>
                    <td className={styles.numCell}>{fmtCurrency(row.total_predicted_revenue)}</td>
                    <td className={styles.numCell}>{row.result_count}</td>
                    <td className={styles.mono}>
                      {row.created_at ? format(new Date(row.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.viewBtn}
                        onClick={() => handleViewRun(row.id)}
                        disabled={loadingRunId === row.id}
                      >
                        {loadingRunId === row.id
                          ? <><span className={styles.tinySpinner} /> Loading</>
                          : <><Eye size={13} /> View</>
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
