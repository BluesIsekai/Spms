import './DataTable.css';

export default function DataTable({ headers, rows, onRowClick, className = '', emptyMessage = 'No data available' }) {
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
                      {header.render ? header.render(row[header.key], row) : row[header.key]}
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
    </div>
  );
}
