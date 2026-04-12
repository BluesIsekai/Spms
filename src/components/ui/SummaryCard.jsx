import './SummaryCard.css';

export default function SummaryCard({ label, value, status = null, className = '' }) {
  return (
    <div className={`ui-summary-card ${className}`}>
      <span className="sc-label">{label}</span>
      <span className={`sc-value ${status}`}>{value}</span>
    </div>
  );
}
