import './DataTable.css';

export default function DataTable({ headers, rows, onRowClick, className = '', emptyMessage = 'No data available' }) {
  const renderCell = (header, row) => (header.render ? header.render(row[header.key], row) : row[header.key]);

  return (
    <div className={`ui-data-table-container ${className}`}>
      <div className="data-table-wrapper">
        <table className="ui-data-table">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header.key} className={`text-${header.align || 'left'}`}>
                  {header.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows && rows.length > 0 ? (
              rows.map((row, idx) => (
                <tr key={idx} onClick={() => onRowClick?.(row)} className={onRowClick ? 'clickable' : ''}>
                  {headers.map((header) => (
                    <td key={header.key} className={`text-${header.align || 'left'}`}>
                      {renderCell(header, row)}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length} className="table-empty">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="ui-data-table-mobile">
        {rows && rows.length > 0 ? (
          rows.map((row, idx) => (
            <div
              key={idx}
              className={`ui-data-table-mobile-card${onRowClick ? ' clickable' : ''}`}
              onClick={() => onRowClick?.(row)}
            >
              {headers.map((header) => (
                <div key={header.key} className={`ui-data-table-mobile-row text-${header.align || 'left'}`}>
                  <span className="ui-data-table-mobile-label">{header.label}</span>
                  <span className="ui-data-table-mobile-value">{renderCell(header, row)}</span>
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="ui-data-table-mobile-empty">{emptyMessage}</div>
        )}
      </div>
    </div>
  );
}
