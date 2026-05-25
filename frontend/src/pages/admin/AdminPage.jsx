import { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import {
  Loader, FileText, ClipboardList, BarChart2,
  Settings, RefreshCw, ShieldAlert, Activity,
  Users, Trash2, Pencil, Plus, X, Check, AlertTriangle,
} from 'lucide-react';
import AppLayout from '../../components/layout/AppLayout';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/apiServices';
import styles from './AdminPage.module.css';

const TABS = [
  { key: 'batches', label: 'Batches',      icon: FileText      },
  { key: 'users',   label: 'Users',        icon: Users         },
  { key: 'logs',    label: 'ETL Logs',     icon: ClipboardList },
  { key: 'quality', label: 'Quality',      icon: BarChart2     },
  { key: 'tech',    label: 'Tech Summary', icon: Activity      },
];

/* ─── Generic Modal ──────────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button className={styles.modalClose} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

/* ─── Confirm Dialog ─────────────────────────────────────────────────── */
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <Modal title="Confirm Action" onClose={onCancel}>
      <div className={styles.confirmContent}>
        <AlertTriangle size={36} color="#EF4444" />
        <p>{message}</p>
      </div>
      <div className={styles.modalFooter}>
        <button className={styles.btnSecondary} onClick={onCancel}>Cancel</button>
        <button className={`${styles.btnDanger}`} onClick={onConfirm}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </Modal>
  );
}

/* ─── Form Field ─────────────────────────────────────────────────────── */
function Field({ label, error, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

/* ─── Main AdminPage ─────────────────────────────────────────────────── */
export default function AdminPage() {
  const { user }              = useAuth();
  const [tab, setTab]         = useState('batches');
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (activeTab) => {
    setLoading(true);
    try {
      let result;
      switch (activeTab) {
        case 'batches': result = await adminService.getAllBatches(); break;
        case 'users':   result = await adminService.getUsers();     break;
        case 'logs':    result = await adminService.getAllLogs();    break;
        case 'quality': result = await adminService.getAllQuality(); break;
        case 'tech':    result = await adminService.getTechSummary(); break;
        default: break;
      }
      setData(result);
    } catch (err) {
      console.error('Admin fetch error:', err);
      toast.error('Failed to load data');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(tab); }, [tab, fetchData]);

  const handleTabChange = (key) => { setTab(key); setData(null); };

  if (user?.role !== 'admin') {
    return (
      <AppLayout>
        <div className="fade-in">
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Admin Panel</h1>
              <p className={styles.pageDesc}>Administrative tools and system monitoring</p>
            </div>
          </div>
          <div className={styles.forbiddenCard}>
            <ShieldAlert size={48} color="#EF4444" />
            <p>Access denied. This page is restricted to administrators only.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="fade-in">
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Admin Panel</h1>
            <p className={styles.pageDesc}>System monitoring, user management, and batch control</p>
          </div>
          <button className={styles.refreshBtn} onClick={() => fetchData(tab)}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        <div className={styles.tabs}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => handleTabChange(t.key)}
            >
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={styles.loading}>
            <Loader size={28} className={styles.spinAnim} />
            <span>Loading {tab}…</span>
          </div>
        ) : (
          <>
            {tab === 'batches' && <BatchesTab data={data} setData={setData} />}
            {tab === 'users'   && <UsersTab   data={data} setData={setData} />}
            {tab === 'logs'    && <LogsTab    data={data} />}
            {tab === 'quality' && <QualityTab data={data} />}
            {tab === 'tech'    && <TechTab    data={data} />}
          </>
        )}
      </div>
    </AppLayout>
  );
}

/* ─── Batches Tab (Read + Edit notes + Delete) ───────────────────────── */
function BatchesTab({ data, setData }) {
  const [confirm, setConfirm]   = useState(null);   // batch to delete
  const [editing, setEditing]   = useState(null);   // batch being edited
  const [editForm, setEditForm] = useState({ notes: '', file_status: '' });
  const [saving, setSaving]     = useState(false);

  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className={styles.empty}><FileText size={36} color="#CBD5E1" /><p>No batch data available</p></div>;
  }

  const openEdit = (batch) => {
    setEditing(batch);
    setEditForm({ notes: batch.notes || '', file_status: batch.file_status });
  };

  const handleSaveEdit = async () => {
    if (saving) return;
    setSaving(true);
    const prev = data;
    // Optimistic update
    setData(d => d.map(b => b.id === editing.id ? { ...b, ...editForm } : b));
    try {
      const updated = await adminService.updateBatch(editing.id, editForm);
      setData(d => d.map(b => b.id === updated.id ? updated : b));
      toast.success('Batch updated successfully');
      setEditing(null);
    } catch (err) {
      setData(prev); // rollback
      toast.error(err?.response?.data?.detail || 'Failed to update batch');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (batch) => {
    const prev = data;
    setConfirm(null);
    // Optimistic update
    setData(d => d.filter(b => b.id !== batch.id));
    try {
      await adminService.deleteBatch(batch.id);
      toast.success(`Batch #${batch.id} deleted`);
    } catch (err) {
      setData(prev); // rollback
      toast.error(err?.response?.data?.detail || 'Failed to delete batch');
    }
  };

  return (
    <>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th><th>File Name</th><th>Uploaded</th><th>Status</th>
              <th>Year</th><th>Type</th><th>Total</th><th>Valid</th><th>Invalid</th><th>Notes</th>
              <th className={styles.actionsCol}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map(b => (
              <tr key={b.id} className="fade-in">
                <td className={styles.numCell}>#{b.id}</td>
                <td className={styles.fileCell}>{b.file_name}</td>
                <td>{b.uploaded_at ? format(new Date(b.uploaded_at), 'dd MMM yyyy, HH:mm') : '—'}</td>
                <td><StatusBadge status={b.file_status} /></td>
                <td className={styles.numCell}>{b.data_year || '—'}</td>
                <td>
                  <span className={`${styles.typeBadge} ${styles[`type_${b.data_type || 'base'}`]}`}>
                    {b.data_type || 'base'}
                  </span>
                </td>
                <td className={styles.numCell}>{b.total_rows}</td>
                <td className={`${styles.numCell} ${styles.green}`}>{b.valid_rows}</td>
                <td className={`${styles.numCell} ${b.invalid_rows > 0 ? styles.red : ''}`}>{b.invalid_rows}</td>
                <td className={styles.notesCell}>{b.notes || <span className={styles.muted}>—</span>}</td>
                <td>
                  <div className={styles.actionBtns}>
                    <button className={styles.btnIcon} title="Edit" onClick={() => openEdit(b)}>
                      <Pencil size={14} />
                    </button>
                    <button className={`${styles.btnIcon} ${styles.danger}`} title="Delete"
                      onClick={() => setConfirm(b)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing && (
        <Modal title={`Edit Batch #${editing.id}`} onClose={() => setEditing(null)}>
          <Field label="Status">
            <select className={styles.select}
              value={editForm.file_status}
              onChange={e => setEditForm(f => ({ ...f, file_status: e.target.value }))}>
              {['uploaded', 'processing', 'processed', 'failed'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea className={styles.textarea} rows={3}
              placeholder="Add notes about this batch…"
              value={editForm.notes}
              onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Field>
          <div className={styles.modalFooter}>
            <button className={styles.btnSecondary} onClick={() => setEditing(null)}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader size={14} className={styles.spinAnim} /> : <Check size={14} />}
              Save
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Confirm */}
      {confirm && (
        <ConfirmDialog
          message={`Delete batch #${confirm.id} (${confirm.file_name})? This will also remove all related ETL data and cannot be undone.`}
          onConfirm={() => handleDelete(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

/* ─── Users Tab (Full CRUD) ──────────────────────────────────────────── */
function UsersTab({ data, setData }) {
  const { user: me }            = useAuth();
  const [confirm, setConfirm]   = useState(null);
  const [modal, setModal]       = useState(null);  // { mode: 'create'|'edit', user?: obj }
  const [form, setForm]         = useState({ username: '', email: '', password: '', role: 'user', is_active: true });
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);

  if (!data || !Array.isArray(data)) {
    return <div className={styles.empty}><Users size={36} color="#CBD5E1" /><p>No users found</p></div>;
  }

  const openCreate = () => {
    setForm({ username: '', email: '', password: '', role: 'user', is_active: true });
    setErrors({});
    setModal({ mode: 'create' });
  };

  const openEdit = (u) => {
    setForm({ username: u.username, email: u.email, password: '', role: u.role, is_active: u.is_active });
    setErrors({});
    setModal({ mode: 'edit', user: u });
  };

  const validate = () => {
    const e = {};
    if (modal.mode === 'create') {
      if (!form.username.trim() || form.username.trim().length < 3) e.username = 'Min 3 characters';
      if (!form.email.trim() || !form.email.includes('@')) e.email = 'Valid email required';
      if (!form.password || form.password.length < 6) e.password = 'Min 6 characters';
    } else {
      if (form.email && !form.email.includes('@')) e.email = 'Valid email required';
      if (form.password && form.password.length < 6) e.password = 'Min 6 characters or leave blank';
    }
    if (!['user', 'admin'].includes(form.role)) e.role = 'Must be user or admin';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || saving) return;
    setSaving(true);
    try {
      if (modal.mode === 'create') {
        const created = await adminService.createUser({
          username: form.username.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
        });
        setData(d => [created, ...(d || [])]);
        toast.success(`User "${created.username}" created`);
      } else {
        const payload = { role: form.role, is_active: form.is_active };
        if (form.email) payload.email = form.email.trim().toLowerCase();
        if (form.password) payload.password = form.password;
        const updated = await adminService.updateUser(modal.user.id, payload);
        setData(d => (d || []).map(u => u.id === updated.id ? updated : u));
        toast.success(`User "${updated.username}" updated`);
      }
      setModal(null);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u) => {
    const prev = data;
    setConfirm(null);
    setData(d => (d || []).filter(x => x.id !== u.id));
    try {
      await adminService.deleteUser(u.id);
      toast.success(`User "${u.username}" deleted`);
    } catch (err) {
      setData(prev);
      toast.error(err?.response?.data?.detail || 'Failed to delete user');
    }
  };

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <>
      <div className={styles.tableToolbar}>
        <span className={styles.tableCount}>{data.length} users</span>
        <button className={styles.btnPrimary} onClick={openCreate}>
          <Plus size={14} /> Add User
        </button>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th><th>Username</th><th>Email</th><th>Role</th>
              <th>Status</th><th>Created</th><th className={styles.actionsCol}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map(u => (
              <tr key={u.id} className="fade-in">
                <td className={styles.numCell}>{u.id}</td>
                <td>
                  <div className={styles.userCell}>
                    <span className={styles.avatarSmall}>{u.username?.[0]?.toUpperCase()}</span>
                    {u.username}
                    {u.id === me?.id && <span className={styles.youBadge}>you</span>}
                  </div>
                </td>
                <td>{u.email}</td>
                <td>
                  <span className={`${styles.roleBadge} ${styles[`role_${u.role}`]}`}>{u.role}</span>
                </td>
                <td>
                  <span className={`${styles.levelBadge} ${u.is_active ? styles.levelINFO : styles.levelERROR}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>{u.created_at ? format(new Date(u.created_at), 'dd MMM yyyy') : '—'}</td>
                <td>
                  <div className={styles.actionBtns}>
                    <button className={styles.btnIcon} title="Edit" onClick={() => openEdit(u)}>
                      <Pencil size={14} />
                    </button>
                    {u.id !== me?.id && (
                      <button className={`${styles.btnIcon} ${styles.danger}`} title="Delete"
                        onClick={() => setConfirm(u)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'Add New User' : `Edit User — ${modal.user?.username}`}
          onClose={() => setModal(null)}
        >
          {modal.mode === 'create' && (
            <Field label="Username *" error={errors.username}>
              <input className={styles.input} placeholder="username" value={form.username}
                onChange={e => setF('username', e.target.value)} />
            </Field>
          )}
          <Field label={modal.mode === 'edit' ? 'Email' : 'Email *'} error={errors.email}>
            <input className={styles.input} type="email" placeholder="user@example.com" value={form.email}
              onChange={e => setF('email', e.target.value)} />
          </Field>
          <Field label={modal.mode === 'edit' ? 'New Password (leave blank to keep)' : 'Password *'} error={errors.password}>
            <input className={styles.input} type="password" placeholder="••••••"
              value={form.password} onChange={e => setF('password', e.target.value)} />
          </Field>
          <Field label="Role" error={errors.role}>
            <select className={styles.select} value={form.role} onChange={e => setF('role', e.target.value)}>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </Field>
          {modal.mode === 'edit' && (
            <Field label="Status">
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setF('is_active', e.target.checked)} />
                Active account
              </label>
            </Field>
          )}
          <div className={styles.modalFooter}>
            <button className={styles.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={saving}>
              {saving ? <Loader size={14} className={styles.spinAnim} /> : <Check size={14} />}
              {modal.mode === 'create' ? 'Create User' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          message={`Delete user "${confirm.username}"? This cannot be undone.`}
          onConfirm={() => handleDelete(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

/* ─── Logs Tab ───────────────────────────────────────────────────────── */
function LogsTab({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className={styles.empty}><ClipboardList size={36} color="#CBD5E1" /><p>No log entries found</p></div>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr><th>ID</th><th>Batch</th><th>Step</th><th>Level</th><th>Message</th><th>Time</th></tr>
        </thead>
        <tbody>
          {data.map(log => (
            <tr key={log.id} className="fade-in">
              <td className={styles.numCell}>{log.id}</td>
              <td className={styles.numCell}>#{log.batch_id}</td>
              <td>{log.step || '—'}</td>
              <td>
                <span className={`${styles.levelBadge} ${styles[`level${log.level}`] || ''}`}>{log.level}</span>
              </td>
              <td>{log.message}</td>
              <td className={styles.mono}>{log.created_at ? format(new Date(log.created_at), 'dd/MM HH:mm:ss') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Quality Tab ────────────────────────────────────────────────────── */
function QualityTab({ data }) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className={styles.empty}><BarChart2 size={36} color="#CBD5E1" /><p>No quality reports available</p></div>;
  }
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr><th>ID</th><th>Batch</th><th>Missing</th><th>Duplicates</th><th>Invalid</th><th>Summary</th><th>Time</th></tr>
        </thead>
        <tbody>
          {data.map((q, i) => (
            <tr key={q.id || i} className="fade-in">
              <td className={styles.numCell}>{q.id}</td>
              <td className={styles.numCell}>#{q.batch_id}</td>
              <td className={`${styles.numCell} ${q.missing_count > 0 ? styles.red : ''}`}>{q.missing_count ?? '—'}</td>
              <td className={`${styles.numCell} ${q.duplicate_count > 0 ? styles.red : ''}`}>{q.duplicate_count ?? '—'}</td>
              <td className={`${styles.numCell} ${q.invalid_count > 0 ? styles.red : ''}`}>{q.invalid_count ?? '—'}</td>
              <td className={styles.summaryCell}>{q.summary || '—'}</td>
              <td className={styles.mono}>{q.created_at ? format(new Date(q.created_at), 'dd/MM HH:mm') : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Tech Summary Tab ───────────────────────────────────────────────── */
function TechTab({ data }) {
  if (!data) {
    return <div className={styles.empty}><Activity size={36} color="#CBD5E1" /><p>No tech summary available</p></div>;
  }
  return (
    <div className={styles.techGrid}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className={styles.techCard}>
          <div className={styles.techLabel}>{key.replace(/_/g, ' ')}</div>
          <div className={styles.techValue}>
            {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
          </div>
        </div>
      ))}
    </div>
  );
}
