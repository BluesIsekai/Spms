import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import './Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { login, error: authError } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container-stitch">
      {/* Decorative Glows */}
      <div className="glow-orb glow-orb-top-left"></div>
      <div className="glow-orb glow-orb-bottom-right"></div>

      {/* Main Card */}
      <div className="auth-card-stitch">
        {/* Logo & Header */}
        <div className="auth-header-stitch">
          <h1 className="auth-logo-stitch">SPMS</h1>
          <h2 className="auth-title-stitch">Welcome Back</h2>
          <p className="auth-subtitle-stitch">Continue Your Trading Journey</p>
        </div>

        {/* Error Messages */}
        {error && <div className="auth-error-stitch">{error}</div>}
        {authError && <div className="auth-error-stitch">{authError}</div>}

        {/* Form */}
        <form onSubmit={handleLogin} className="auth-form-stitch">
          {/* Email Field */}
          <div className="form-group-stitch">
            <label htmlFor="email" className="form-label-stitch">
              EMAIL ADDRESS
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="form-input-stitch"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Password Field */}
          <div className="form-group-stitch">
            <div className="form-label-row">
              <label htmlFor="password" className="form-label-stitch">
                PASSWORD
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="show-toggle-stitch"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-input-stitch"
              disabled={loading}
            />
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="form-actions-stitch">
            <label className="checkbox-stitch">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
              />
              <span>Remember me</span>
            </label>
            <Link to="/forgot-password" className="forgot-link-stitch">
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary-stitch"
            disabled={loading || !email || !password}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Divider */}
        <div className="divider-stitch">
          <span>Don't have account?</span>
        </div>

        {/* Sign Up Link */}
        <Link to="/signup">
          <button type="button" className="btn-secondary-stitch">
            Sign Up
          </button>
        </Link>
      </div>

      {/* Footer */}
      <footer className="auth-footer-stitch">
        <div className="footer-links-stitch">
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Service</a>
          <a href="#disclosure">Regulatory Disclosures</a>
        </div>
        <div className="footer-copyright">© 2024 SPMS. SOVEREIGN PRECISION.</div>
      </footer>
    </div>
  );
}
