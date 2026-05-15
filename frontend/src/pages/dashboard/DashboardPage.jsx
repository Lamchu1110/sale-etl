import { useState, useEffect } from 'react';
import {
  DollarSign, ShoppingCart, Package, TrendingUp,
  BarChart2, PieChart as PieIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie,
  Cell, Legend
} from 'recharts';
import AppLayout from '../../components/layout/AppLayout';
import { analyticsService } from '../../services/apiServices';
import styles from './DashboardPage.module.css';

// Expanded palette for many-region pie charts
const COLORS = [
  '#6366F1','#22C55E','#F59E0B','#EC4899','#06B6D4',
  '#8B5CF6','#EF4444','#14B8A6','#F97316','#84CC16',
  '#A855F7','#0EA5E9','#10B981','#FBBF24','#FB923C',
  '#E879F9','#34D399','#60A5FA','#F472B6','#A3E635',
];

const fmt = (n) => {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return Number(n).toLocaleString();
};

const fmtCurrency = (n) => {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Number(n).toLocaleString()}`;
};

// Custom legend that limits to top N entries to prevent overflow
const MAX_LEGEND = 8;
function CompactLegend({ payload }) {
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
      {remaining > 0 && (
        <span className={styles.legendMore}>+{remaining} more</span>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary]     = useState(null);
  const [trend, setTrend]         = useState([]);
  const [byRegion, setByRegion]   = useState([]);
  const [byProduct, setByProduct] = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, t, r, p] = await Promise.all([
          analyticsService.getSummary(),
          analyticsService.getRevenueTrend(),
          analyticsService.getRevenueByRegion(),
          analyticsService.getRevenueByProduct(8),
        ]);
        setSummary(s);
        setTrend(t);
        setByRegion(r);
        setByProduct(p);
      } catch (err) {
        console.error('Dashboard load failed:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

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
            {[1,2,3,4].map(i => <div key={i} className={styles.skeletonKpi} style={{ animationDelay: `${i*0.1}s` }} />)}
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
    { label: 'Total Revenue',   value: fmtCurrency(summary?.total_revenue),   icon: DollarSign,  color: 'purple' },
    { label: 'Total Orders',    value: fmt(summary?.total_orders),             icon: ShoppingCart, color: 'green'  },
    { label: 'Total Quantity',  value: fmt(summary?.total_quantity),           icon: Package,      color: 'amber'  },
    { label: 'Avg Order Value', value: fmtCurrency(summary?.avg_order_value),  icon: TrendingUp,   color: 'pink'   },
  ];

  // BUG FIX: Show top 10 regions in pie to avoid label collision
  // All revenue still displayed, just grouped beyond top 10
  const TOP_N = 10;
  const pieData = (() => {
    if (!byRegion || byRegion.length <= TOP_N) return byRegion;
    const top = byRegion.slice(0, TOP_N);
    const otherRevenue = byRegion.slice(TOP_N).reduce((s, r) => s + r.revenue, 0);
    return [...top, { label: 'Others', revenue: otherRevenue }];
  })();

  return (
    <AppLayout>
      <div className="fade-in">
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Sales Dashboard</h1>
            <p className={styles.pageDesc}>Revenue analytics and key performance indicators</p>
          </div>
        </div>

        {/* KPI Cards */}
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

        {/* Revenue Trend Chart — BUG FIX: added top margin to prevent clipping */}
        <div className={styles.chartGrid}>
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>
              <TrendingUp size={16} /> Revenue Trend
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tickFormatter={v => v?.slice(5) || v} tick={{ fontSize: 11 }} />
               {/* Update YAxis at DashboardPage.jsx */}
                <YAxis 
                  tickFormatter={v => fmtCurrency(v)} 
                  tick={{ fontSize: 11 }} 
                  width={60} 
                  domain={['dataMin', 'dataMax']}
                  padding={{ top: 20, bottom: 20 }}
                />
                <Tooltip
                  formatter={(v) => [fmtCurrency(v), 'Revenue']}
                  labelFormatter={l => `Date: ${l}`}
                  contentStyle={{ borderRadius: 10, border: '1px solid var(--border)', fontSize: 12 }}
                />
                <Line
                  type="monotone" dataKey="revenue"
                  stroke="#6366F1" strokeWidth={2.5}
                  dot={false} activeDot={{ r: 5, fill: '#6366F1' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Charts */}
        <div className={styles.chartGridHalf}>
          {/* BUG FIX: Revenue by Region — removed external labels (caused collision),
              limited to top 10 + Others, use compact custom legend */}
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>
              <PieIcon size={16} /> Revenue by Region
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="revenue"
                  nameKey="label"
                  cx="50%" cy="45%"
                  outerRadius="60%"
                  innerRadius="35%"
                  paddingAngle={2}
                  /* Removed label prop — caused massive overlap with 50+ regions */
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [fmtCurrency(v), 'Revenue']} />
                <Legend content={<CompactLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Top Products */}
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}>
              <BarChart2 size={16} /> Top Products by Revenue
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={byProduct} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={v => fmtCurrency(v)} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmtCurrency(v), 'Revenue']} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                  {byProduct.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
