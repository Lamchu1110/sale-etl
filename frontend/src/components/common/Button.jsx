import styles from './Button.module.css';

const variants = { primary: 'primary', outline: 'outline', danger: 'danger', ghost: 'ghost' };

export default function Button({
  children, variant = 'primary', loading = false,
  disabled = false, fullWidth = false, size = 'md',
  icon, onClick, type = 'button', ...props
}) {
  return (
    <button
      type={type}
      className={[
        styles.btn,
        styles[variant],
        styles[size],
        fullWidth ? styles.full : '',
        loading  ? styles.loading : '',
      ].join(' ')}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading
        ? <span className={styles.spinner} />
        : <>{icon && <span className={styles.icon}>{icon}</span>}{children}</>
      }
    </button>
  );
}
