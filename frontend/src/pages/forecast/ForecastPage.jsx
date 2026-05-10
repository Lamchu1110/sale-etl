import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  TrendingUp, Play, Loader, Clock, BarChart2
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { forecastService } from '../../services/apiServices';
import styles from './ForecastPage.module.css';

const fmtCurrency = (n) => {
  if (n == null) return '—';
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Number(n).toLocaleString()}`;
};

export default function ForecastPage() {
  const [periods, setPeriods]     = useState(7);
  const [forecast, setForecast]   = useState(null);
  const [history, setHistory]     = useState([]);
  const [generating, setGen]      = useState(false);
  const [loadingHist, setLoadH]   = useState(true);

  // Load history on mount
  useEffect(() => {
    const load = async () => {
      try {
        const h = await forecastService.getHistory();
        setHistory(Array.isArray(h) ? h : []);
      } catch (err) {
        toast.error('Failed to load forecast history');
        console.error('Forecast history load failed:', err);
      }
      finally { setLoadH(false); }
    };
    load();
  }, []);

  const handleGenerate = async () => {
    if (periods < 1 || periods > 90) {
      toast.error('Periods must be between 1 and 90');
      return;
    }
    setGen(true);
    try {
      const result = await forecastService.generate(periods);
      setForecast(result);
      toast.success(`Forecast generated for ${periods} periods!`);
      // Refresh history
      const h = await forecastService.getHistory();
      setHistory(Array.isArray(h) ? h : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Forecast generation failed');
    } finally {
      setGen(false);
    }
  };

  // Extract chart data from forecast — backend returns a plain array
  const chartData = Array.isArray(forecast) ? forecast : (forecast?.predictions || forecast?.forecast_data || []);

  return (
    <AppLayout>
      <div className="fade-in">
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Revenue Forecast</h1>
            <p className={styles.pageDesc}>Generate sales predictions using historical data</p>
          </div>
        </div>

        {/* Generate Card */}
        <div className={styles.generateCard}>
          <div className={styles.field}>
            <label className={styles.label}>Forecast Periods (days)</label>
            <input
              className={styles.input}
              type="number"
              min={1}
              max={90}
              value={periods}
              onChange={e => setPeriods(Number(e.target.value))}
              disabled={generating}
            />
          </div>
          <button
            className={styles.generateBtn}
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating
              ? <><span className={styles.spinner} /> Generating...</>
              : <><Play size={14} /> Generate Forecast</>
            }
          </button>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>
              <TrendingUp size={16} /> Predicted Revenue
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="target_date"
                  tickFormatter={v => v?.slice(5) || v}
                />
                <YAxis tickFormatter={v => fmtCurrency(v)} />
                <Tooltip
                  formatter={(v) => [fmtCurrency(v), 'Predicted Revenue']}
                  labelFormatter={l => `Date: ${l}`}
                  contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="predicted_revenue"
                  stroke="#06B6D4"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#06B6D4' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {!forecast && chartData.length === 0 && (
          <div className={styles.chartCard}>
            <div className={styles.emptyChart}>
              <BarChart2 size={40} color="#CBD5E1" />
              <p>No forecast data yet. Click "Generate Forecast" above.</p>
            </div>
          </div>
        )}

        {/* History */}
        <h3 className={styles.sectionTitle}>
          <Clock size={16} /> Forecast History
        </h3>
        {loadingHist ? (
          <div className={styles.loading}>
            <Loader size={24} className={styles.spinAnim} />
            <span>Loading history...</span>
          </div>
        ) : history.length === 0 ? (
          <div className={styles.chartCard}>
            <div className={styles.emptyChart}>
              <Clock size={32} color="#CBD5E1" />
              <p>No forecast history yet.</p>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Target Date</th>
                  <th>Predicted Revenue</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={h.id || i} className="fade-in">
                    <td className={styles.numCell}>{h.id}</td>
                    <td>{h.target_date || '—'}</td>
                    <td className={styles.numCell}>{fmtCurrency(h.predicted_revenue)}</td>
                    <td className={styles.mono}>
                      {h.created_at ? format(new Date(h.created_at), 'dd/MM/yyyy HH:mm') : '—'}
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
