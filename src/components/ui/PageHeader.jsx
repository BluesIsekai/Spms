import './PageHeader.css';

export default function PageHeader({ title, description, children, className = '' }) {
  return (
    <div className={`ui-page-header ${className}`}>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-header-actions">{children}</div>}
    </div>
  );
}
