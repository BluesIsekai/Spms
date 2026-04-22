import './Card.css';

export default function Card({ children, className = '', style = {} }) {
  return (
    <div className={`ui-card ${className}`} style={style}>
      {children}
    </div>
  );
}
