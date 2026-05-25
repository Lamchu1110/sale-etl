import { useEffect, useState } from 'react';
import {
  DollarSign, ShoppingCart, Package, TrendingUp,
  BarChart2, PieChart as PieIcon, Building2, CalendarDays,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie,
  Cell, Legend
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { analyticsService } from '../../services/apiServices';
import styles from './DashboardPage.module.css';

const COLORS = [
  '#6366F1', '#22C55E', '#F59E0B', '#EC4899', '#06B6D4',
  '#8B5CF6', '#EF4444', '#14B8A6', '#F97316', '#84CC16',
  '#A855F7', '#0EA5E9', '#10B981', '#FBBF24', '#FB923C',
  '#E879F9', '#34D399', '#60A5FA', '#F472B6', '#A3E635',
];

const fmt = (n) => {
  if (n == null) return '-';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return Number(n).toLocaleString();
};

const fmtCurrency = (n) => {
  if (n == null) return '-';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Number(n).toLocaleString()}`;
};

const MAX_LEGEND = 8;
function CompactLegend({ payload = [] }) {
  const visible = payload.slice(0, MAX_LEGEND);
  const remaining = payload.length - MAX_LEGEND;
  return (
    <div className={styles.legendWrap}>
      {visible.map((entry, i) => (
        <span key={i} className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
      {remaining > 0 && <span className={styles.legendMore}>+{remaining} more</span>}
    </div>
  );
}

function ChartEmpty({ message }) {
  return <div className={styles.emptyChart}>{message}</div>;
}

export default function DashboardPage() {
  const [filterOptions, setFilterOptions] = useState({ businesses: [], years: [] });
  const [filters, setFilters] = useState({ business_id: '', data_year: '' });
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [byRegion, setByRegion] = useState([]);
  const [byProduct, setByProduct] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');

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

        setFilters({
          business_id: defaultBusinessId,
          data_year: defaultYear,
        });

        if (!defaultBusinessId || !defaultYear) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Dashboard filters failed:', err);
        setError('Unable to load dashboard filters.');
        setLoading(false);
      }
    };

    loadFilters();
  }, []);

  useEffect(() => {
    if (!filters.business_id || !filters.data_year) return;

    const loadDashboard = async () => {
      setDataLoading(true);
      setError('');
      try {
        const params = {
          business_id: Number(filters.business_id),
          data_year: Number(filters.data_year),
        };
        const [s, t, r, p] = await Promise.all([
          analyticsService.getSummary(params),
          analyticsService.getRevenueTrend(params),
          analyticsService.getRevenueByRegion(params),
          analyticsService.getRevenueByProduct(8, params),
        ]);
        setSummary(s);
        setTrend(t);
        setByRegion(r);
        setByProduct(p);
      } catch (err) {
        console.error('Dashboard load failed:', err);
        setError('Unable to load dashboard data for the selected filters.');
      } finally {
        setLoading(false);
        setDataLoading(false);
      }
    };

    loadDashboard();
  }, [filters.business_id, filters.data_year]);

  const selectedBusiness = filterOptions.businesses?.find(
    business => Number(business.id) === Number(filters.business_id)
  );
  const availableYears = selectedBusiness?.years?.length ? selectedBusiness.years : filterOptions.years || [];

  const handleBusinessChange = (event) => {
    const nextBusinessId = Number(event.target.value);
    const nextBusiness = filterOptions.businesses?.find(business => Number(business.id) === nextBusinessId);
    const nextYears = nextBusiness?.years?.length ? nextBusiness.years : filterOptions.years || [];
    const currentYear = Number(filters.data_year);
    const nextYear = nextYears.includes(currentYear) ? currentYear : nextYears[0] || '';
    setFilters({ business_id: nextBusinessId, data_year: nextYear });
  };

  const handleYearChange = (event) => {
    setFilters(prev => ({ ...prev, data_year: Number(event.target.value) }));
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="fade-in">
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Sales Dashboard</h1>
              <p className={styles.pageDesc}>Loading analytics data...</p>
            </div>
          </div>
          <div className={styles.kpiGrid}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.skeletonKpi} style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <div className={styles.chartGrid}>
            <div className={styles.skeletonChart} />
          </div>
          <div className={styles.chartGridHalf}>
            <div className={styles.skeletonChart} />
            <div className={styles.skeletonChart} />
          </div>
        </div>
      </AppLayout>
    );
  }

  const kpis = [
    { label: 'Total Revenue', value: fmtCurrency(summary?.total_revenue), icon: DollarSign, color: 'purple' },
    { label: 'Total Orders', value: fmt(summary?.total_orders), icon: ShoppingCart, color: 'green' },
    { label: 'Total Quantity', value: fmt(summary?.total_quantity), icon: Package, color: 'amber' },
    { label: 'Avg Order Value', value: fmtCurrency(summary?.avg_order_value), icon: TrendingUp, color: 'pink' },
  ];

  const TOP_N = 10;
  const pieData = (() => {
    if (!byRegion || byRegion.length <= TOP_N) return byRegion;
    const top = byRegion.slice(0, TOP_N);
    const otherRevenue = byRegion.slice(TOP_N).reduce((sum, row) => sum + row.revenue, 0);
    return [...top, { label: 'Others', revenue: otherRevenue }];
  })();

  const hasDashboardData = Number(summary?.total_revenue || 0) > 0 || byRegion.length > 0 || byProduct.length > 0;

  return (
    <AppLayout>
      <div className="fade-in">
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Sales Dashboard</h1>
            <p className={styles.pageDesc}>
              Base-year revenue analytics by business and year
            </p>
          </div>

          <div className={styles.filterPanel}>
            <label className={styles.filterField}>
              <span><Building2 size={14} /> Business</span>
              <select value={filters.business_id} onChange={handleBusinessChange}>
                {filterOptions.businesses?.map(business => (
                  <option key={business.id} value={business.id}>{business.name}</option>
                ))}
              </select>
            </label>

            <label className={styles.filterField}>
              <span><CalendarDays size={14} /> Year</span>
              <select value={filters.data_year} onChange={handleYearChange}>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {!hasDashboardData && !error && (
          <div className={styles.emptyBanner}>
            No base-year aggregate data found for this selection. Upload a base CSV and run ETL first.
          </div>
        )}

        <div className={styles.kpiGrid}>
          {kpis.map((kpi, i) => (
            <div key={kpi.label} className={styles.kpiCard} style={{ animationDelay: `${i * 0.08}s` }}>
              <div className={`${styles.kpiIcon} ${styles[kpi.color]}`}>
                <kpi.icon size={22} />
              </div>
              <div className={styles.kpiInfo}>
                <div className={styles.kpiLabel}>{kpi.label}</div>
                <div className={styles.kpiValue}>{kpi.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.chartGrid}>
          <div className={`${styles.chartCard} ${dataLoading ? styles.chartMuted : ''}`}>
            <div className={styles.chartTitle}>
              <TrendingUp size={16} /> Monthly Revenue Trend
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={value => fmtCurrency(value)}
                  tick={{ fontSize: 11 }}
                  width={60}
                  domain={[0, 'dataMax']}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip
                  formatter={(value) => [fmtCurrency(value), 'Revenue']}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.period || ''}
                  contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#6366F1' }}
                  activeDot={{ r: 5, fill: '#6366F1' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartGridHalf}>
          <div className={`${styles.chartCard} ${dataLoading ? styles.chartMuted : ''}`}>
            <div className={styles.chartTitle}>
              <PieIcon size={16} /> Revenue by Region
            </div>
            {pieData.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="revenue"
                    nameKey="label"
                    cx="50%"
                    cy="45%"
                    outerRadius="60%"
                    innerRadius="35%"
                    paddingAngle={2}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [fmtCurrency(value), 'Revenue']} />
                  <Legend content={<CompactLegend />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No region data for this selection." />
            )}
          </div>

          <div className={`${styles.chartCard} ${dataLoading ? styles.chartMuted : ''}`}>
            <div className={styles.chartTitle}>
              <BarChart2 size={16} /> Top Products by Revenue
            </div>
            {byProduct.length ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={byProduct} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={value => fmtCurrency(value)} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [fmtCurrency(value), 'Revenue']} />
                  <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                    {byProduct.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ChartEmpty message="No product data for this selection." />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
