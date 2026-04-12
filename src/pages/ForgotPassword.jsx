import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import './Auth.css';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email) {
        throw new Error('Email address is required');
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
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
            <h2 className="auth-title-stitch">Check Your Email</h2>
            <p className="auth-subtitle-stitch">Password reset instructions sent</p>
          </div>

          {/* Success State */}
          <div className="success-container-stitch">
            <div className="success-icon">✓</div>
            <p className="success-message">
              We've sent password reset instructions to:
            </p>
            <p className="success-email">{email}</p>
            <p className="success-helper">
              Please check your email (and spam folder) for the reset link. The link will expire in 24 hours.
            </p>
          </div>

          {/* Divider */}
          <div className="divider-stitch">
            <span>Didn't receive email?</span>
          </div>

          {/* Try Again Button */}
          <button
            onClick={() => {
              setSent(false);
              setEmail('');
            }}
            className="btn-secondary-stitch mb-4"
          >
            Try Different Email
          </button>

          {/* Back to Login */}
          <Link to="/login">
            <button type="button" className="btn-secondary-stitch">
              Back to Sign In
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
          <h2 className="auth-title-stitch">Reset Password</h2>
          <p className="auth-subtitle-stitch">Enter your email to receive reset instructions</p>
        </div>

        {/* Error Messages */}
        {error && <div className="auth-error-stitch">{error}</div>}

        {/* Form */}
        <form onSubmit={handleRequestReset} className="auth-form-stitch">
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
              autoFocus
            />
            <p className="form-helper-stitch">
              We'll send you an email to reset your password
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary-stitch"
            disabled={loading || !email}
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        {/* Divider */}
        <div className="divider-stitch">
          <span>Go back</span>
        </div>

        {/* Back to Login */}
        <Link to="/login">
          <button type="button" className="btn-secondary-stitch">
            Back to Sign In
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
