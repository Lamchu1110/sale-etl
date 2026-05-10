import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  CheckCircle, XCircle, Clock, RefreshCw,
  ChevronRight, AlertTriangle, FileText,
  Play, Loader, Database, Filter, Search
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/common/StatusBadge';
import { uploadService, etlService } from '../../services/apiServices';
import styles from './ETLStatusPage.module.css';

// ─── ETL Pipeline Steps ────────────────────────────────────────────
const ETL_STEPS = [
  { key: 'extract',   label: 'Extract',   icon: FileText,    desc: 'Reading CSV file'     },
  { key: 'validate',  label: 'Validate',  icon: CheckCircle, desc: 'Checking schema'      },
  { key: 'transform', label: 'Transform', icon: Filter,      desc: 'Cleaning data'        },
  { key: 'load',      label: 'Load',      icon: Database,    desc: 'Saving to database'   },
  { key: 'complete',  label: 'Complete',  icon: CheckCircle, desc: 'Pipeline finished'    },
];

function getStepState(stepKey, logs) {
  const stepLogs = logs.filter(l => l.step === stepKey);
  if (!stepLogs.length) return 'idle';
  const last = stepLogs[stepLogs.length - 1];
  if (last.level === 'ERROR') return 'failed';
  return 'success'; // INFO = completed successfully
}

// ─── Step Indicator ────────────────────────────────────────────────
function StepIndicator({ step, state, isLast }) {
  const Icon = step.icon;
  return (
    <div className={styles.stepWrap}>
      <div className={`${styles.step} ${styles[`step_${state}`]}`}>
        <div className={styles.stepIcon}>
          {state === 'running'
            ? <Loader size={15} className={styles.spinAnim} />
            : state === 'success'
            ? <CheckCircle size={15} />
            : state === 'failed'
            ? <XCircle size={15} />
            : <Icon size={15} />}
        </div>
        <div className={styles.stepInfo}>
          <span className={styles.stepLabel}>{step.label}</span>
          <span className={styles.stepDesc}>{step.desc}</span>
        </div>
      </div>
      {!isLast && (
        <div className={`${styles.stepLine} ${state === 'success' ? styles.stepLineDone : ''}`} />
      )}
    </div>
  );
}

// ─── Log Row ───────────────────────────────────────────────────────
function LogRow({ log, index }) {
  return (
    <div
      className={`${styles.logRow} ${styles[`log_${log.level?.toLowerCase()}`] || ''} fade-in`}
      style={{ animationDelay: `${index * 0.035}s` }}
    >
      <span className={styles.logTime}>
        {log.created_at ? format(new Date(log.created_at), 'HH:mm:ss') : '—'}
      </span>
      <span className={styles.logStep}>{log.step || '—'}</span>
      <span className={styles.logStatus}>
        <span className={styles.logDot} />
        {log.level}
      </span>
      <span className={styles.logMsg}>{log.message}</span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────
export default function ETLStatusPage() {
  const [batches, setBatches]             = useState([]);
  const [selectedId, setSelectedId]       = useState(null);
  const [etlData, setEtlData]             = useState(null);
  const [loading, setLoading]             = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [search, setSearch]               = useState('');
  const [runningETL, setRunningETL]       = useState({});
  const pollingRef                        = useRef(null);

  // Load all batches
  const fetchBatches = useCallback(async () => {
    try {
      const data = await uploadService.getBatches();
      setBatches(data);
    } catch (err) {
      toast.error('Failed to load batches');
      console.error('Fetch batches failed:', err);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  // Load ETL status for selected batch (using getBatch + getLogs)
  const fetchStatus = useCallback(async (id) => {
    if (!id) return;
    setStatusLoading(true);
    try {
      const [batch, logs] = await Promise.all([
        uploadService.getBatch(id),
        etlService.getLogs(id),
      ]);
      setEtlData({ batch_id: id, batch_status: batch.file_status, logs });
      setBatches(prev =>
        prev.map(b => b.id === id ? { ...b, file_status: batch.file_status } : b)
      );
    } catch (err) {
      toast.error('Failed to load ETL status');
      console.error('Fetch status failed:', err);
    }
    finally { setStatusLoading(false); }
  }, []);

  // Auto-poll when processing
  useEffect(() => {
    clearInterval(pollingRef.current);
    if (selectedId && etlData?.batch_status === 'processing') {
      pollingRef.current = setInterval(() => fetchStatus(selectedId), 2000);
    }
    return () => clearInterval(pollingRef.current);
  }, [selectedId, etlData?.batch_status, fetchStatus]);

  const handleSelect = (id) => {
    setSelectedId(id);
    setEtlData(null);
    fetchStatus(id);
  };

  const handleRunETL = async (batchId, e) => {
    e.stopPropagation();
    setRunningETL(p => ({ ...p, [batchId]: true }));
    try {
      await etlService.runETL(batchId);
      handleSelect(batchId);
      setTimeout(fetchBatches, 1500);
    } catch (err) {
      toast.error('Failed to run ETL');
      console.error('ETL run failed:', err);
    }
    finally { setRunningETL(p => ({ ...p, [batchId]: false })); }
  };

  const filtered = batches.filter(b =>
    b.file_name.toLowerCase().includes(search.toLowerCase()) ||
    (b.file_status || '').toLowerCase().includes(search.toLowerCase())
  );

  const logs        = etlData?.logs || [];
  const batchStatus = etlData?.batch_status || '';
  const currentBatch = batches.find(b => b.id === selectedId);

  return (
    <AppLayout>
      <div className="fade-in">
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>ETL Status</h1>
            <p className={styles.pageDesc}>
              Monitor pipeline processing logs for each upload batch
            </p>
          </div>
          <button className={styles.refreshBtn} onClick={fetchBatches}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className={styles.layout}>

          {/* ──────────── Left Panel: Batch List ──────────── */}
          <div className={styles.leftPanel}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>Batches</span>
              <span className={styles.badge}>{batches.length}</span>
            </div>

            <div className={styles.searchBox}>
              <Search size={13} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className={styles.batchList}>
              {loading ? (
                [1,2,3,4].map(i => (
                  <div key={i} className={styles.skeletonItem}
                    style={{ animationDelay: `${i*0.08}s` }} />
                ))
              ) : filtered.length === 0 ? (
                <div className={styles.emptyList}>
                  <FileText size={28} color="#CBD5E1" />
                  <p>No batches found</p>
                </div>
              ) : filtered.map(b => (
                <div
                  key={b.id}
                  className={`${styles.batchItem} ${selectedId === b.id ? styles.batchActive : ''}`}
                  onClick={() => handleSelect(b.id)}
                >
                  <div className={styles.batchTop}>
                    <span className={styles.batchName}>
                      <FileText size={12} />
                      {b.file_name}
                    </span>
                    <ChevronRight size={13} className={styles.chevron} />
                  </div>
                  <div className={styles.batchBottom}>
                    <StatusBadge status={b.file_status} />
                    <span className={styles.batchMeta}>
                      #{b.id} · {b.uploaded_at ? format(new Date(b.uploaded_at), 'dd/MM HH:mm') : '—'}
                    </span>
                  </div>
                  {(b.file_status === 'uploaded' || b.file_status === 'failed') && (
                    <button
                      className={styles.runBtn}
                      onClick={e => handleRunETL(b.id, e)}
                      disabled={runningETL[b.id]}
                    >
                      {runningETL[b.id]
                        ? <><span className={styles.spinnerXs} /> Running</>
                        : <><Play size={10} /> Run ETL</>}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ──────────── Right Panel: ETL Detail ──────────── */}
          <div className={styles.rightPanel}>
            {!selectedId ? (
              <div className={styles.emptyDetail}>
                <Database size={48} color="#CBD5E1" />
                <p>Select a batch to view ETL pipeline status</p>
              </div>

            ) : statusLoading && !etlData ? (
              <div className={styles.emptyDetail}>
                <Loader size={32} color="#94A3B8" className={styles.spinAnim} />
                <p style={{ color: 'var(--text-muted)', marginTop: 12 }}>Loading...</p>
              </div>

            ) : etlData ? (
              <div className={styles.detailContent}>

                {/* Detail Header */}
                <div className={styles.detailHead}>
                  <div>
                    <h2 className={styles.detailTitle}>
                      Batch #{etlData.batch_id}
                    </h2>
                    <p className={styles.detailSub}>{currentBatch?.file_name}</p>
                  </div>
                  <div className={styles.detailMeta}>
                    <StatusBadge status={batchStatus} />
                    {batchStatus === 'processing' && (
                      <span className={styles.liveBadge}>
                        <span className={styles.liveDot} /> Live
                      </span>
                    )}
                    <button
                      className={styles.iconBtn}
                      onClick={() => fetchStatus(selectedId)}
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                {/* Stats */}
                {currentBatch && (
                  <div className={styles.statsRow}>
                    {[
                      { label: 'Total Rows',   val: currentBatch.total_rows,   color: '' },
                      { label: 'Valid Rows',    val: currentBatch.valid_rows,   color: styles.green },
                      { label: 'Invalid Rows',  val: currentBatch.invalid_rows, color: currentBatch.invalid_rows > 0 ? styles.red : '' },
                      { label: 'Log Entries',   val: logs.length,               color: '' },
                    ].map(s => (
                      <div key={s.label} className={styles.statCard}>
                        <span className={`${styles.statNum} ${s.color}`}>{s.val}</span>
                        <span className={styles.statLabel}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pipeline Steps */}
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Pipeline Steps</h3>
                  <div className={styles.stepsRow}>
                    {ETL_STEPS.map((step, i) => (
                      <StepIndicator
                        key={step.key}
                        step={step}
                        state={getStepState(step.key, logs)}
                        isLast={i === ETL_STEPS.length - 1}
                      />
                    ))}
                  </div>
                </div>

                {/* Error Panel */}
                {(batchStatus === 'failed' || logs.some(l => l.level === 'ERROR')) && (
                  <div className={styles.errorPanel}>
                    <div className={styles.errorPanelHead}>
                      <AlertTriangle size={15} />
                      <span>ETL Errors Detected</span>
                    </div>
                    {logs.filter(l => l.level === 'ERROR').map((l, i) => (
                      <div key={i} className={styles.errorItem}>
                        <span className={styles.errorStep}>[{l.step}]</span>
                        <span>{l.message}</span>
                      </div>
                    ))}
                    {currentBatch?.error_summary && (
                      <div className={styles.errorSummary}>
                        <strong>Summary:</strong> {currentBatch.error_summary}
                      </div>
                    )}
                  </div>
                )}

                {/* Log Viewer */}
                <div className={styles.section}>
                  <div className={styles.logHead}>
                    <h3 className={styles.sectionTitle}>Processing Logs</h3>
                    <span className={styles.logCount}>{logs.length} entries</span>
                  </div>
                  <div className={styles.logTable}>
                    <div className={styles.logTableHead}>
                      <span>Time</span>
                      <span>Step</span>
                      <span>Status</span>
                      <span>Message</span>
                    </div>
                    <div className={styles.logTableBody}>
                      {logs.length === 0 ? (
                        <div className={styles.emptyLog}>
                          <Clock size={24} color="#CBD5E1" />
                          <p>No logs yet. Run ETL to see activity.</p>
                        </div>
                      ) : (
                        logs.map((log, i) => <LogRow key={log.id} log={log} index={i} />)
                      )}
                    </div>
                  </div>
                </div>

              </div>
            ) : null}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
