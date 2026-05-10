import styles from './StatusBadge.module.css';

const config = {
  pending:    { label: 'Pending',    cls: 'warning' },
  uploaded:   { label: 'Uploaded',   cls: 'warning' },
  processing: { label: 'Processing', cls: 'info'    },
  success:    { label: 'Success',    cls: 'success'  },
  processed:  { label: 'Processed',  cls: 'success'  },
  failed:     { label: 'Failed',     cls: 'danger'   },
  started:    { label: 'Started',    cls: 'info'     },
  running:    { label: 'Running',    cls: 'info'     },
  complete:   { label: 'Complete',   cls: 'success'  },
};

export default function StatusBadge({ status }) {
  const { label, cls } = config[status] || { label: status, cls: 'warning' };
  return <span className={`${styles.badge} ${styles[cls]}`}>{label}</span>;
}
