import { useState, useEffect } from 'react';
import { fetchSettings, updateSettings } from '../services/settingsService';
import { resetPortfolio } from '../services/portfolioService';
import { useAuth } from '../hooks/useAuth.jsx';
import PageHeader from '../components/ui/PageHeader';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import './Pages.css';

export default function Settings() {
  const { user } = useAuth();
  const userId = user?.id;
  const [settings, setSettings] = useState({
    theme: 'dark',
    currency: 'INR',
    refresh_interval: 10000,
    default_balance: 100000,
    notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchSettings(userId)
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...settings,
        refresh_interval: Number(settings.refresh_interval),
        default_balance: Number(settings.default_balance),
      };
      await updateSettings(userId, payload);
      alert('Settings saved successfully!');
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const balance = Number(settings.default_balance || 100000);
    if (!window.confirm(`WARNING: This will wipe all holdings and transactions, and reset your wallet to ₹${balance.toLocaleString('en-IN')}. Are you sure?`)) {
      return;
    }
    setResetting(true);
    try {
      await resetPortfolio(userId, balance);
      alert('Portfolio successfully reset!');
      window.location.reload(); // Reload to clear all states immediately
    } catch (err) {
      alert('Failed to reset portfolio: ' + err.message);
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <div className="page-loading">Loading settings...</div>;

  return (
    <div className="page-container page-settings">
      <PageHeader title="Settings" description="Manage your application preferences and account reset actions." />

      <div className="settings-content">
        <Card className="settings-form">
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label htmlFor="theme">Theme</label>
              <select name="theme" id="theme" value={settings.theme} onChange={handleChange}>
                <option value="dark">Dark Theme (Default)</option>
                <option value="light">Light Theme</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="currency">Base Currency</label>
              <select name="currency" id="currency" value={settings.currency} onChange={handleChange}>
                <option value="INR">Indian Rupee (₹)</option>
                <option value="USD">US Dollar ($)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="refresh_interval">Auto-Refresh Interval (ms)</label>
              <input
                type="number"
                id="refresh_interval"
                name="refresh_interval"
                value={settings.refresh_interval}
                onChange={handleChange}
                min="5000"
                step="1000"
              />
            </div>

            <div className="form-group">
              <label htmlFor="default_balance">Default Paper Wallet Balance (₹)</label>
              <input
                type="number"
                id="default_balance"
                name="default_balance"
                value={settings.default_balance}
                onChange={handleChange}
                min="10000"
                step="1000"
              />
            </div>

            <div className="form-group-checkbox">
              <input
                type="checkbox"
                id="notifications"
                name="notifications"
                checked={settings.notifications}
                onChange={handleChange}
              />
              <label htmlFor="notifications">Enable Trading Notifications</label>
            </div>

            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </form>
        </Card>

        <Card className="danger-zone">
          <h2>Danger Zone</h2>
          <p>Resetting your portfolio will erase all active holdings, purge your transaction history, and reset your paper wallet back to the initial default balance. Watchlist items are retained.</p>
          <Button variant="danger" size="md" onClick={handleReset} disabled={resetting}>
            {resetting ? 'Resetting...' : 'Reset Portfolio'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
