const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');

/**
 * Export an array of result objects to CSV.
 * @param {Array} results
 * @param {string} outputPath
 */
async function exportCsv(results, outputPath) {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'title', title: 'Nombre' },
      { id: 'url', title: 'Web' },
      { id: 'phones', title: 'Teléfonos' },
      { id: 'emails', title: 'Emails' },
      { id: 'address', title: 'Dirección' },
      { id: 'instagram', title: 'Instagram' },
      { id: 'facebook', title: 'Facebook' },
      { id: 'tripadvisor', title: 'TripAdvisor' },
      { id: 'description', title: 'Descripción' },
    ],
  });

  const rows = results.map(r => ({
    title: r.title || '',
    url: r.url || '',
    phones: (r.phones || []).join(' | '),
    emails: (r.emails || []).join(' | '),
    address: r.address || '',
    instagram: (r.socials || {}).instagram || '',
    facebook: (r.socials || {}).facebook || '',
    tripadvisor: (r.socials || {}).tripadvisor || '',
    description: r.description || '',
  }));

  await csvWriter.writeRecords(rows);
  return outputPath;
}

module.exports = { exportCsv };
