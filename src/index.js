#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const chalk = require('chalk');
const { Scraper } = require('./scraper');

const program = new Command();

program
  .name('webscraper')
  .description('Versatile web scraper for extracting business contacts')
  .version('1.0.0');

// ─── Command: scrape a list of URLs ─────────────────────────────────────────
program
  .command('urls <url...>')
  .description('Scrape one or more URLs directly')
  .option('-b, --browser', 'Use headless browser (for JS-heavy sites)', false)
  .option('-f, --format <format>', 'Output format: csv | json | both', 'both')
  .option('-o, --output <dir>', 'Output directory', './results')
  .option('-c, --concurrency <n>', 'Max parallel requests', '3')
  .option('-n, --name <name>', 'Base filename for exports', 'scrape')
  .action(async (urls, opts) => {
    const scraper = new Scraper({
      useBrowser: opts.browser,
      outputDir: opts.output,
      concurrency: parseInt(opts.concurrency),
    });

    await scraper.scrapeUrls(urls);
    await scraper.export(opts.format, opts.name);

    if (opts.browser) await require('./sources/browser').closeBrowser();
    printSummary(scraper.results);
  });

// ─── Command: search + scrape ────────────────────────────────────────────────
program
  .command('search <query> <location>')
  .description('Search for businesses and scrape their contact info')
  .option('-b, --browser', 'Use headless browser', false)
  .option('-f, --format <format>', 'Output format: csv | json | both', 'both')
  .option('-o, --output <dir>', 'Output directory', './results')
  .option('-c, --concurrency <n>', 'Max parallel requests', '3')
  .option('-l, --limit <n>', 'Max search results to scrape', '10')
  .option('-e, --engine <engine>', 'Search engine: google | duckduckgo', 'duckduckgo')
  .option('-n, --name <name>', 'Base filename for exports', 'search')
  .action(async (query, location, opts) => {
    const scraper = new Scraper({
      useBrowser: opts.browser,
      outputDir: opts.output,
      concurrency: parseInt(opts.concurrency),
      searchEngine: opts.engine,
    });

    await scraper.searchAndScrape(query, location, parseInt(opts.limit));
    await scraper.export(opts.format, opts.name);

    if (opts.browser) await require('./sources/browser').closeBrowser();
    printSummary(scraper.results);
  });

// ─── Command: scrape from a file of URLs ────────────────────────────────────
program
  .command('file <filepath>')
  .description('Read URLs from a text file (one per line) and scrape them')
  .option('-b, --browser', 'Use headless browser', false)
  .option('-f, --format <format>', 'Output format: csv | json | both', 'both')
  .option('-o, --output <dir>', 'Output directory', './results')
  .option('-c, --concurrency <n>', 'Max parallel requests', '3')
  .option('-n, --name <name>', 'Base filename for exports', 'batch')
  .action(async (filepath, opts) => {
    const fs = require('fs');
    if (!fs.existsSync(filepath)) {
      console.error(chalk.red(`File not found: ${filepath}`));
      process.exit(1);
    }
    const urls = fs.readFileSync(filepath, 'utf-8')
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('http'));

    if (urls.length === 0) {
      console.error(chalk.red('No valid URLs found in file.'));
      process.exit(1);
    }

    const scraper = new Scraper({
      useBrowser: opts.browser,
      outputDir: opts.output,
      concurrency: parseInt(opts.concurrency),
    });

    await scraper.scrapeUrls(urls);
    await scraper.export(opts.format, opts.name);

    if (opts.browser) await require('./sources/browser').closeBrowser();
    printSummary(scraper.results);
  });

function printSummary(results) {
  const ok = results.filter(r => !r.error);
  const withPhone = ok.filter(r => r.phones && r.phones.length > 0);
  const withEmail = ok.filter(r => r.emails && r.emails.length > 0);

  console.log(chalk.bold('\n─── Summary ─────────────────────────────'));
  console.log(`  Total scraped : ${results.length}`);
  console.log(`  With phone    : ${withPhone.length}`);
  console.log(`  With email    : ${withEmail.length}`);
  console.log(`  Errors        : ${results.filter(r => r.error).length}`);
  console.log(chalk.bold('─────────────────────────────────────────\n'));
}

program.parse(process.argv);
