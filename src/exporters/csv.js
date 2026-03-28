const { createObjectCsvWriter } = require('csv-writer');
const path = require('path');
const fs = require('fs');

/**
 * Export an array of result objects to CSV.
 * @param {Array} results
 * @param {string} outputPath
 */
async function exportCsv(results, outputPath) {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'title', title: 'Name' },
      { id: 'url', title: 'Website' },
      { id: 'phones', title: 'Phones' },
      { id: 'emails', title: 'Emails' },
      { id: 'address', title: 'Address' },
      { id: 'instagram', title: 'Instagram' },
      { id: 'facebook', title: 'Facebook' },
      { id: 'tripadvisor', title: 'TripAdvisor' },
      { id: 'description', title: 'Description' },
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

  // Prepend UTF-8 BOM so Excel on Windows opens the file with correct encoding
  const content = fs.readFileSync(outputPath);
  if (content[0] !== 0xEF) {
    fs.writeFileSync(outputPath, Buffer.concat([Buffer.from('\uFEFF', 'utf8'), content]));
  }

  return outputPath;
}

module.exports = { exportCsv };
