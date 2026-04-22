import './Badge.css';

export default function Badge({ children, variant = 'default', className = '', style = {} }) {
  return (
    <span className={`ui-badge ui-badge-${variant} ${className}`} style={style}>
      {children}
    </span>
  );
}
