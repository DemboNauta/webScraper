const fs = require('fs');

async function exportJson(results, outputPath) {
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  return outputPath;
}

module.exports = { exportJson };
