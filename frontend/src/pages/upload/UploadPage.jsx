import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'react-hot-toast';
import {
  Upload, FileText, CheckCircle, XCircle,
  RefreshCw, Clock, ChevronRight, AlertCircle
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/common/StatusBadge';
import { businessService, uploadService, etlService } from '../../services/apiServices';
import styles from './UploadPage.module.css';
import { format } from 'date-fns';

const currentYear = new Date().getFullYear();

export default function UploadPage() {
  const [file, setFile]           = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [batches, setBatches]     = useState([]);
  const [businesses, setBusinesses] = useState([]);
  const [metadata, setMetadata] = useState({
    business_id: 1,
    data_year: currentYear,
    data_type: 'base',
  });
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [runningETL, setRunningETL] = useState({});

  // Load batch history
  const fetchBatches = useCallback(async () => {
    try {
      const data = await uploadService.getBatches();
      setBatches(data);
    } catch (err) {
      toast.error('Failed to load upload history');
      console.error('Fetch batches failed:', err);
    }
    finally { setLoadingBatches(false); }
  }, []);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  useEffect(() => {
    const loadBusinesses = async () => {
      try {
        const data = await businessService.getAll();
        setBusinesses(data);
        setMetadata(p => (
          data.length && !data.some(b => b.id === Number(p.business_id))
            ? { ...p, business_id: data[0].id }
            : p
        ));
      } catch (err) {
        toast.error('Failed to load businesses');
        console.error('Fetch businesses failed:', err);
      }
    };
    loadBusinesses();
  }, []);

  // Dropzone
  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length) {
      toast.error('Only .csv files are accepted');
      return;
    }
    setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleUpload = async () => {
    if (!file) return;
    if (!metadata.data_year || metadata.data_year < 1900 || metadata.data_year > 2200) {
      toast.error('Data year must be between 1900 and 2200');
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const batch = await uploadService.uploadCSV(file, setProgress, metadata);
      toast.success(`File uploaded! Batch #${batch.id} created.`);
      setFile(null);
      setProgress(0);
      fetchBatches();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRunETL = async (batchId) => {
    setRunningETL(p => ({ ...p, [batchId]: true }));
    try {
      await etlService.runETL(batchId);
      toast.success(`ETL started for batch #${batchId}`);
      // Poll for update after 2s
      setTimeout(fetchBatches, 2000);
      setTimeout(fetchBatches, 5000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start ETL');
    } finally {
      setRunningETL(p => ({ ...p, [batchId]: false }));
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getBusinessName = (id) =>
    businesses.find(b => b.id === Number(id))?.name || 'Default Business';

  return (
    <AppLayout>
      <div className="fade-in">
        {/* Page header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Upload Sales Data</h1>
            <p className={styles.pageDesc}>
              Upload CSV files to trigger the ETL pipeline
            </p>
          </div>
          <button className={styles.refreshBtn} onClick={fetchBatches}>
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        {/* Upload zone */}
        <div className={styles.uploadCard}>
          <div className={styles.metadataGrid}>
            <label className={styles.metaField}>
              <span>Business</span>
              <select
                className={styles.metaInput}
                value={metadata.business_id}
                onChange={e => setMetadata(p => ({ ...p, business_id: Number(e.target.value) }))}
                disabled={uploading}
              >
                {businesses.length === 0 ? (
                  <option value={1}>Default Business</option>
                ) : businesses.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>

            <label className={styles.metaField}>
              <span>Data Year</span>
              <input
                className={styles.metaInput}
                type="number"
                min={1900}
                max={2200}
                value={metadata.data_year}
                onChange={e => setMetadata(p => ({ ...p, data_year: Number(e.target.value) }))}
                disabled={uploading}
              />
            </label>

            <label className={styles.metaField}>
              <span>Data Type</span>
              <select
                className={styles.metaInput}
                value={metadata.data_type}
                onChange={e => setMetadata(p => ({ ...p, data_type: e.target.value }))}
                disabled={uploading}
              >
                <option value="base">Base year data</option>
                <option value="actual">Actual comparison data</option>
              </select>
            </label>
          </div>

          <div
            {...getRootProps()}
            className={`${styles.dropzone} ${isDragActive ? styles.dragging : ''} ${file ? styles.hasFile : ''}`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className={styles.filePreview}>
                <div className={styles.fileIcon}>
                  <FileText size={28} color="#4F46E5" />
                </div>
                <div className={styles.fileInfo}>
                  <p className={styles.fileName}>{file.name}</p>
                  <p className={styles.fileSize}>{formatBytes(file.size)}</p>
                </div>
                <button
                  className={styles.removeFile}
                  onClick={e => { e.stopPropagation(); setFile(null); }}
                  disabled={uploading}
                >
                  <XCircle size={18} />
                </button>
              </div>
            ) : (
              <div className={styles.dropContent}>
                <div className={styles.dropIcon}>
                  <Upload size={30} color={isDragActive ? '#4F46E5' : '#94A3B8'} />
                </div>
                <p className={styles.dropTitle}>
                  {isDragActive ? 'Drop your CSV here' : 'Drag & drop CSV file here'}
                </p>
                <p className={styles.dropSub}>or <span>click to browse</span></p>
                <p className={styles.dropHint}>Only .csv files supported</p>
              </div>
            )}
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className={styles.progressWrap}>
              <div className={styles.progressBar}>
                <div className={styles.progressFill} style={{ width: `${progress}%` }} />
              </div>
              <span className={styles.progressLabel}>{progress}%</span>
            </div>
          )}

          {/* Upload button */}
          {file && !uploading && (
            <button className={styles.uploadBtn} onClick={handleUpload}>
              <Upload size={16} />
              Upload & Create Batch
            </button>
          )}
          {uploading && (
            <button className={styles.uploadBtn} disabled>
              <span className={styles.spinner} />
              Uploading...
            </button>
          )}

          {/* CSV schema hint */}
          <div className={styles.schemaHint}>
            <AlertCircle size={14} />
            <span>Required columns: <code>order_id, order_date, product_name, category, quantity, unit_price, total_revenue, store_name, region_name</code></span>
          </div>
        </div>

        {/* Batch history */}
        <div className={styles.historySection}>
          <h2 className={styles.sectionTitle}>Upload History</h2>

          {loadingBatches ? (
            <div className={styles.loadingRows}>
              {[1,2,3].map(i => <div key={i} className={styles.skeletonRow} style={{ animationDelay: `${i*0.1}s` }} />)}
            </div>
          ) : batches.length === 0 ? (
            <div className={styles.empty}>
              <FileText size={40} color="#CBD5E1" />
              <p>No uploads yet. Upload your first CSV file above.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>File Name</th>
                    <th>Business</th>
                    <th>Year</th>
                    <th>Type</th>
                    <th>Upload Time</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Valid</th>
                    <th>Invalid</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b, i) => (
                    <tr key={b.id} style={{ animationDelay: `${i * 0.05}s` }} className="fade-in">
                      <td className={styles.idCell}>#{b.id}</td>
                      <td>
                        <div className={styles.fileCell}>
                          <FileText size={14} color="#94A3B8" />
                          <span>{b.file_name}</span>
                        </div>
                      </td>
                      <td>{getBusinessName(b.business_id)}</td>
                      <td className={styles.numCell}>{b.data_year || '—'}</td>
                      <td>
                        <span className={`${styles.typeBadge} ${styles[`type_${b.data_type || 'base'}`]}`}>
                          {b.data_type || 'base'}
                        </span>
                      </td>
                      <td className={styles.timeCell}>
                        <Clock size={12} />
                        {b.uploaded_at ? format(new Date(b.uploaded_at), 'dd MMM yyyy, HH:mm') : '—'}
                      </td>
                      <td><StatusBadge status={b.file_status} /></td>
                      <td className={styles.numCell}>{b.total_rows}</td>
                      <td className={`${styles.numCell} ${styles.green}`}>{b.valid_rows}</td>
                      <td className={`${styles.numCell} ${b.invalid_rows > 0 ? styles.red : ''}`}>{b.invalid_rows}</td>
                      <td>
                        <div className={styles.actions}>
                          {b.file_status === 'uploaded' || b.file_status === 'failed' ? (
                            <button
                              className={styles.runBtn}
                              onClick={() => handleRunETL(b.id)}
                              disabled={runningETL[b.id]}
                            >
                              {runningETL[b.id]
                                ? <><span className={styles.spinnerSm} /> Running</>
                                : <><RefreshCw size={13} /> Run ETL</>
                              }
                            </button>
                          ) : b.file_status === 'processing' ? (
                            <span className={styles.processingLabel}>
                              <span className={styles.spinnerSm} /> Processing...
                            </span>
                          ) : (
                            <span className={styles.doneLabel}>
                              <CheckCircle size={13} /> Done
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
