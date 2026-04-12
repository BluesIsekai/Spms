import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import './Auth.css';

export default function Signup() {
  const navigate = useNavigate();
  const { register, error: authError } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!fullName || !email || !password || !confirmPassword) {
        throw new Error('All fields are required');
      }

      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      await register(email, password, fullName);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
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
          <h2 className="auth-title-stitch">Create Account</h2>
          <p className="auth-subtitle-stitch">Start Your Trading Journey</p>
        </div>

        {/* Error Messages */}
        {error && <div className="auth-error-stitch">{error}</div>}
        {authError && <div className="auth-error-stitch">{authError}</div>}

        {/* Form */}
        <form onSubmit={handleSignup} className="auth-form-stitch">
          {/* Full Name Field */}
          <div className="form-group-stitch">
            <label htmlFor="fullName" className="form-label-stitch">
              FULL NAME
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alexander Vance"
              className="form-input-stitch"
              disabled={loading}
              autoFocus
            />
          </div>

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
              placeholder="avance@company.com"
              className="form-input-stitch"
              disabled={loading}
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
              placeholder="••••••••••••"
              className="form-input-stitch"
              disabled={loading}
            />
            <p className="form-helper-stitch">Strong security required</p>
          </div>

          {/* Confirm Password Field */}
          <div className="form-group-stitch">
            <label htmlFor="confirmPassword" className="form-label-stitch">
              CONFIRM PASSWORD
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="form-input-stitch"
              disabled={loading}
            />
          </div>

          {/* Password Strength Indicator */}
          <div className="strength-indicator-stitch">
            <div className="strength-bars">
              <div className="strength-bar filled"></div>
              <div className="strength-bar filled"></div>
              <div className="strength-bar"></div>
              <div className="strength-bar"></div>
            </div>
            <span className="strength-label">Strong security required</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary-stitch"
            disabled={loading || !fullName || !email || !password || !confirmPassword}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        {/* Divider */}
        <div className="divider-stitch">
          <span>Already have account?</span>
        </div>

        {/* Sign In Link */}
        <Link to="/login">
          <button type="button" className="btn-secondary-stitch">
            Sign In
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
