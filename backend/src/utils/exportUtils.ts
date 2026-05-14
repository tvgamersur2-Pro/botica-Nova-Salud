/**
 * Export Utilities
 *
 * Provides CSV and PDF (HTML-based) export functionality for reports.
 * Requirements: FR-4.6, Property 12
 */

// ----------------------------------------------------------------
// CSV Export
// ----------------------------------------------------------------

/**
 * Generates a CSV string from an array of data objects and a header mapping.
 * Properly escapes special characters (commas, quotes, newlines).
 * Requirements: FR-4.6, Property 12
 *
 * @param data    - Array of objects to export
 * @param headers - Array of { key, label } pairs defining columns
 */
export function generateCSV(
  data: Record<string, unknown>[],
  headers: Array<{ key: string; label: string }>,
): string {
  const escape = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value);
    // Wrap in quotes if contains comma, quote, or newline
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map((h) => escape(h.label)).join(',');

  const dataRows = data.map((row) =>
    headers.map((h) => escape(row[h.key])).join(','),
  );

  return [headerRow, ...dataRows].join('\r\n');
}

// ----------------------------------------------------------------
// PDF Export (HTML-based)
// ----------------------------------------------------------------

export interface PDFReportData {
  title: string;
  subtitle?: string;
  generatedAt: Date;
  sections: PDFSection[];
}

export interface PDFSection {
  heading: string;
  content: string | TableData;
}

export interface TableData {
  type: 'table';
  headers: string[];
  rows: string[][];
}

/**
 * Generates an HTML string that can be rendered as a PDF report.
 * Uses print-friendly CSS for proper formatting.
 * Requirements: FR-4.6, Property 12
 *
 * @param reportData - Structured report data
 * @param type       - Report type label (e.g. 'sales', 'inventory')
 */
export function generatePDFReport(reportData: PDFReportData, type: string): string {
  const formatDate = (d: Date) =>
    d.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderSection = (section: PDFSection): string => {
    if (typeof section.content === 'string') {
      return `
        <div class="section">
          <h2>${escapeHtml(section.heading)}</h2>
          <p>${escapeHtml(section.content)}</p>
        </div>`;
    }

    const table = section.content as TableData;
    const headerCells = table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
    const bodyRows = table.rows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`,
      )
      .join('');

    return `
      <div class="section">
        <h2>${escapeHtml(section.heading)}</h2>
        <table>
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>`;
  };

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(reportData.title)} - Nova Salud</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #333; padding: 20px; }
    header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
    header h1 { font-size: 20px; }
    header p { color: #666; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f5f5f5; font-weight: bold; }
    tr:nth-child(even) { background: #fafafa; }
    footer { border-top: 1px solid #ccc; padding-top: 8px; margin-top: 20px; color: #999; font-size: 10px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Nova Salud – ${escapeHtml(reportData.title)}</h1>
    ${reportData.subtitle ? `<p>${escapeHtml(reportData.subtitle)}</p>` : ''}
    <p>Tipo: ${escapeHtml(type)} | Generado: ${formatDate(reportData.generatedAt)}</p>
  </header>
  ${reportData.sections.map(renderSection).join('\n')}
  <footer>
    <p>Nova Salud – Sistema de Gestión de Inventario y Ventas de Botica</p>
    <p>Generado el ${formatDate(reportData.generatedAt)}</p>
  </footer>
</body>
</html>`;
}

// ----------------------------------------------------------------
// HTML escape helper
// ----------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
