/**
 * Export data as CSV file
 * @param {Array<Object>} data - Array of objects to export
 * @param {string} filename - Name of the file (without extension)
 * @param {Object} options - Column mapping { headerName: 'fieldName' }
 */
export function exportToCSV(data, filename, columnMapping = null) {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // If no column mapping provided, use keys from first object
  const headers = columnMapping 
    ? Object.keys(columnMapping)
    : Object.keys(data[0]);
  
  const fields = columnMapping
    ? Object.values(columnMapping)
    : Object.keys(data[0]);

  // Create CSV header row
  const csvRows = [headers.join(',')];

  // Create data rows
  for (const row of data) {
    const values = fields.map(field => {
      let value = getNestedValue(row, field);
      
      // Handle different types
      if (value === null || value === undefined) {
        return '';
      }
      if (Array.isArray(value)) {
        value = value.join('; ');
      }
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      if (value instanceof Date) {
        value = value.toISOString();
      }
      
      // Escape quotes and wrap in quotes if contains comma or quote
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  // Create and download file
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get nested object value using dot notation
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : null;
  }, obj);
}

/**
 * Export data as JSON file
 */
export function exportToJSON(data, filename) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    alert('No data to export');
    return;
  }

  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default { exportToCSV, exportToJSON };
