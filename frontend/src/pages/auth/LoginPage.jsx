import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Eye, EyeOff, Database, Lock, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/apiServices';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const [form, setForm]         = useState({ username: '', password: '' });
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [errors, setErrors]     = useState({});
  const { login }               = useAuth();
  const navigate                = useNavigate();

  const validate = () => {
    const e = {};
    if (!form.username.trim()) e.username = 'Username is required';
    if (!form.password)        e.password = 'Password is required';
    if (form.password && form.password.length < 4) e.password = 'Password too short';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Step 1: Get token
      const tokenData = await authService.login(form.username, form.password);
      // Step 2: Temporarily store token for the next request
      localStorage.setItem('access_token', tokenData.access_token);
      // Step 3: Fetch user profile
      const userData = await authService.getMe();
      login(userData, tokenData.access_token);
      toast.success(`Welcome back, ${userData.username}!`);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Login failed. Please try again.';
      toast.error(msg);
      setErrors({ password: msg });
      localStorage.removeItem('access_token');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Left decorative panel */}
      <div className={styles.panel}>
        <div className={styles.panelContent}>
          <div className={styles.panelIcon}>
            <Database size={40} color="#fff" />
          </div>
          <h1 className={styles.panelTitle}>Sales ETL &amp;<br />Analytics Platform</h1>
          <p className={styles.panelDesc}>
            Automate your sales data pipeline. Clean, transform, and
            visualize data from multiple sources in one place.
          </p>
          <div className={styles.features}>
            {['ETL Pipeline Automation', 'Real-time Analytics Dashboard', 'Multi-source Data Upload', 'Role-based Access Control'].map(f => (
              <div key={f} className={styles.feature}>
                <div className={styles.featureDot} />
                <span>{f}</span>
              </div>
            ))}
          </div>
          {/* Decorative circles */}
          <div className={styles.circle1} />
          <div className={styles.circle2} />
        </div>
      </div>

      {/* Right form panel */}
      <div className={styles.formSide}>
        <div className={styles.formBox}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>Welcome back</h2>
            <p className={styles.formSub}>Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className={styles.form}>
            {/* Username */}
            <div className={styles.field}>
              <label className={styles.label}>Username</label>
              <div className={`${styles.inputWrap} ${errors.username ? styles.hasError : ''}`}>
                <User size={16} className={styles.inputIcon} />
                <input
                  name="username"
                  type="text"
                  placeholder="Enter your username"
                  className={styles.input}
                  value={form.username}
                  onChange={handleChange}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              {errors.username && <p className={styles.error}>{errors.username}</p>}
            </div>

            {/* Password */}
            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <div className={`${styles.inputWrap} ${errors.password ? styles.hasError : ''}`}>
                <Lock size={16} className={styles.inputIcon} />
                <input
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Enter your password"
                  className={styles.input}
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="current-password"
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(p => !p)}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className={styles.error}>{errors.password}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading
                ? <><span className={styles.spinner} /> Signing in...</>
                : 'Sign In'
              }
            </button>
          </form>

          {/* Demo hint */}
          <div className={styles.demoHint}>
            <p className={styles.demoTitle}>Demo accounts</p>
            <div className={styles.demoAccounts}>
              <code>admin / admin123</code>
              <code>user / user123</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
