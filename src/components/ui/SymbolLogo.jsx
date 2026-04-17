import { getCompanyLogo } from '../../utils/logos';

export default function SymbolLogo({ symbol, size = 24, className = "" }) {
  if (!symbol) return null;
  const cleanSymbol = symbol.replace(/=F|\.NS|\.BO|-USD/g, '');
  const url = getCompanyLogo(symbol) || `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanSymbol)}&background=232836&color=fff&size=64`;

  return (
    <div 
      className={`symbol-logo-wrapper ${className}`} 
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '50%', 
        overflow: 'hidden', 
        background: '#fff', 
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <img 
        src={url} 
        alt={symbol} 
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onError={(e) => { 
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanSymbol)}&background=232836&color=fff&size=64`; 
        }}
      />
    </div>
  );
}
