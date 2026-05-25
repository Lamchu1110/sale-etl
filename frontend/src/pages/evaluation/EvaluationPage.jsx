import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  Activity, BarChart3, CheckCircle2, Clock, Eye, Loader,
  Download, Lightbulb, Play, Sigma, Target, TrendingDown, TrendingUp,
  Trophy
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { evaluationService, forecastService } from '../../services/apiServices';
import styles from './EvaluationPage.module.css';

const fmtCurrency = (n) => {
  if (n == null) return '-';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Number(n).toLocaleString()}`;
};

const fmtPercent = (n) => (n == null ? '-' : `${Number(n).toFixed(2)}%`);

const modelLabel = (modelName) => {
  if (modelName === 'holt_winters') return 'Holt-Winters';
  if (modelName === 'moving_average') return 'Moving Average';
  return modelName || '-';
};

export default function EvaluationPage() {
  const [forecastRuns, setForecastRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [loadingEvalId, setLoadingEvalId] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [runs, evaluations] = await Promise.all([
          forecastService.getHistory(),
          evaluationService.getHistory(),
        ]);
        const runList = Array.isArray(runs) ? runs : [];
        setForecastRuns(runList);
        setHistory(Array.isArray(evaluations) ? evaluations : []);
        setSelectedRunId(runList[0]?.id || '');
      } catch (err) {
        toast.error('Failed to load evaluation data');
        console.error('Evaluation load failed:', err);
      } finally {
        setLoading(false);
      }
    };

    loadInitial();
  }, []);

  const handleEvaluate = async () => {
    if (!selectedRunId) {
      toast.error('Please select a forecast run first');
      return;
    }

    setEvaluating(true);
    try {
      const result = await evaluationService.evaluateRun(selectedRunId);
      setEvaluation(result);
      toast.success(`Accuracy: ${fmtPercent(result.accuracy)}`);
      const evaluations = await evaluationService.getHistory();
      setHistory(Array.isArray(evaluations) ? evaluations : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Evaluation failed');
    } finally {
      setEvaluating(false);
    }
  };

  const handleViewEvaluation = async (evaluationId) => {
    setLoadingEvalId(evaluationId);
    try {
      const detail = await evaluationService.getDetail(evaluationId);
      setEvaluation(detail);
      setSelectedRunId(detail.forecast_run_id);
      toast.success(`Loaded evaluation #${detail.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load evaluation');
    } finally {
      setLoadingEvalId(null);
    }
  };

  const handleExportCsv = async () => {
    if (!evaluation?.id) {
      toast.error('Load an evaluation before exporting');
      return;
    }

    setExporting(true);
    try {
      const blob = await evaluationService.exportCsv(evaluation.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `forecast_evaluation_${evaluation.id}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV report exported');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className={styles.loading}>
          <Loader size={24} className={styles.spinAnim} />
          <span>Loading evaluation data...</span>
        </div>
      </AppLayout>
    );
  }

  const chartData = evaluation?.month_errors || [];
  const selectedRun = forecastRuns.find(run => Number(run.id) === Number(selectedRunId));

  return (
    <AppLayout>
      <div className="fade-in">
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Forecast Evaluation</h1>
            <p className={styles.pageDesc}>Compare forecast results against actual monthly revenue</p>
          </div>
        </div>

        <div className={styles.controlCard}>
          <div className={styles.field}>
            <label className={styles.label}><Sigma size={13} /> Forecast Run</label>
            <select
              className={styles.select}
              value={selectedRunId}
              onChange={event => setSelectedRunId(Number(event.target.value))}
            >
              {forecastRuns.map(run => (
                <option key={run.id} value={run.id}>
                  #{run.id} - {run.business_name || `Business #${run.business_id}`} - {run.base_year} to {run.target_year} - {modelLabel(run.model_name)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className={styles.evaluateBtn}
            onClick={handleEvaluate}
            disabled={evaluating || !selectedRunId}
          >
            {evaluating
              ? <><span className={styles.spinner} /> Evaluating...</>
              : <><Play size={14} /> Evaluate Forecast</>
            }
          </button>
        </div>

        {!forecastRuns.length && (
          <div className={styles.emptyBanner}>
            No forecast runs found. Generate a forecast before running evaluation.
          </div>
        )}

        {selectedRun && !evaluation && (
          <div className={styles.hintBanner}>
            Selected run targets actual year <strong>{selectedRun.target_year}</strong>. Upload actual data for that year before evaluation.
          </div>
        )}

        {evaluation && (
          <>
            <div className={styles.reportHeader}>
              <div>
                <span className={styles.reportEyebrow}>Evaluation Report</span>
                <h2 className={styles.reportTitle}>
                  {evaluation.business_name || `Business #${evaluation.business_id}`} - {evaluation.base_year} to {evaluation.actual_year}
                </h2>
                <p className={styles.reportDesc}>
                  Model: {modelLabel(evaluation.model_name)} | Forecast run #{evaluation.forecast_run_id} | Evaluation #{evaluation.id}
                </p>
              </div>
              <button
                type="button"
                className={styles.exportBtn}
                onClick={handleExportCsv}
                disabled={exporting}
              >
                {exporting
                  ? <><span className={styles.tinySpinner} /> Exporting</>
                  : <><Download size={14} /> Export CSV</>
                }
              </button>
            </div>

            <div className={styles.metricGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricIcon}><Target size={18} /></div>
                <span className={styles.metricLabel}>MAE</span>
                <strong className={styles.metricValue}>{fmtCurrency(evaluation.mae)}</strong>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricIcon}><Activity size={18} /></div>
                <span className={styles.metricLabel}>RMSE</span>
                <strong className={styles.metricValue}>{fmtCurrency(evaluation.rmse)}</strong>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricIcon}><TrendingDown size={18} /></div>
                <span className={styles.metricLabel}>MAPE</span>
                <strong className={styles.metricValue}>{fmtPercent(evaluation.mape)}</strong>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricIcon}><CheckCircle2 size={18} /></div>
                <span className={styles.metricLabel}>Accuracy</span>
                <strong className={styles.metricValue}>{fmtPercent(evaluation.accuracy)}</strong>
              </div>
            </div>

            <div className={styles.reportGrid}>
              <div className={styles.insightCard}>
                <div className={styles.reportCardTitle}>
                  <Lightbulb size={16} /> Auto Insights
                </div>
                <ul className={styles.insightList}>
                  {(evaluation.insights || []).map((insight, index) => (
                    <li key={index}>{insight}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.monthCard}>
                <div className={styles.reportCardTitle}>
                  <Trophy size={16} /> Best / Worst Month
                </div>
                <div className={styles.monthPair}>
                  <div>
                    <span className={styles.monthLabel}>Best Month</span>
                    <strong>{evaluation.best_month_period || '-'}</strong>
                  </div>
                  <div>
                    <span className={styles.monthLabel}>Worst Month</span>
                    <strong>{evaluation.worst_month_period || '-'}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.chartCard}>
              <div className={styles.chartTitle}>
                <TrendingUp size={16} /> Forecast vs Actual Revenue
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" tickFormatter={value => value?.slice(5) || value} />
                  <YAxis tickFormatter={value => fmtCurrency(value)} />
                  <Tooltip
                    formatter={(value, name) => [fmtCurrency(value), name === 'forecast_revenue' ? 'Forecast' : 'Actual']}
                    labelFormatter={label => `Month: ${label}`}
                    contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="forecast_revenue" name="Forecast" stroke="#6366F1" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="actual_revenue" name="Actual" stroke="#22C55E" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Forecast</th>
                    <th>Actual</th>
                    <th>Error</th>
                    <th>Abs Error</th>
                    <th>Error %</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map(row => (
                    <tr key={row.month}>
                      <td>{row.period}</td>
                      <td className={styles.numCell}>{fmtCurrency(row.forecast_revenue)}</td>
                      <td className={styles.numCell}>{fmtCurrency(row.actual_revenue)}</td>
                      <td className={styles.numCell}>{fmtCurrency(row.error)}</td>
                      <td className={styles.numCell}>{fmtCurrency(row.abs_error)}</td>
                      <td className={styles.numCell}>{fmtPercent(row.error_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h3 className={styles.sectionTitle}>
          <Clock size={16} /> Evaluation History
        </h3>
        {history.length === 0 ? (
          <div className={styles.chartCard}>
            <div className={styles.emptyChart}>
              <BarChart3 size={36} color="#CBD5E1" />
              <p>No evaluation history yet.</p>
            </div>
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Run</th>
                  <th>Business</th>
                  <th>Years</th>
                  <th>Accuracy</th>
                  <th>MAPE</th>
                  <th>Months</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {history.map(row => (
                  <tr key={row.id}>
                    <td className={styles.numCell}>#{row.id}</td>
                    <td className={styles.numCell}>#{row.forecast_run_id}</td>
                    <td>{row.business_name || `Business #${row.business_id}`}</td>
                    <td>{row.base_year} to {row.actual_year}</td>
                    <td className={styles.numCell}>{fmtPercent(row.accuracy)}</td>
                    <td className={styles.numCell}>{fmtPercent(row.mape)}</td>
                    <td className={styles.numCell}>{row.evaluated_months}</td>
                    <td className={styles.mono}>
                      {row.created_at ? format(new Date(row.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.viewBtn}
                        onClick={() => handleViewEvaluation(row.id)}
                        disabled={loadingEvalId === row.id}
                      >
                        {loadingEvalId === row.id
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
