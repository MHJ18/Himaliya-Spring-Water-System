'use strict';

// Do this as the first thing so that any code reading it knows the right env.
process.env.BABEL_ENV = 'production';
process.env.NODE_ENV = 'production';

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on('unhandledRejection', err => {
  throw err;
});

// Ensure environment variables are read.
require('../config/env');


const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const webpack = require('webpack');
const bfj = require('bfj');
const config = require('../config/webpack.config.prod');
const paths = require('../config/paths');
const checkRequiredFiles = require('react-dev-utils/checkRequiredFiles');
const formatWebpackMessages = require('react-dev-utils/formatWebpackMessages');
const printHostingInstructions = require('react-dev-utils/printHostingInstructions');
const FileSizeReporter = require('react-dev-utils/FileSizeReporter');
const printBuildError = require('react-dev-utils/printBuildError');

const measureFileSizesBeforeBuild =
  FileSizeReporter.measureFileSizesBeforeBuild;
const printFileSizesAfterBuild = FileSizeReporter.printFileSizesAfterBuild;
const useYarn = fs.existsSync(paths.yarnLockFile);

// These sizes are pretty large. We'll warn for bundles exceeding them.
const WARN_AFTER_BUNDLE_GZIP_SIZE = 512 * 1024;
const WARN_AFTER_CHUNK_GZIP_SIZE = 1024 * 1024;

const isInteractive = process.stdout.isTTY;

// Warn and crash if required files are missing
if (!checkRequiredFiles([paths.appHtml, paths.appIndexJs])) {
  process.exit(1);
}

// Process CLI arguments
const argv = process.argv.slice(2);
const writeStatsJson = argv.indexOf('--stats') !== -1;

// We require that you explictly set browsers and do not fall back to
// browserslist defaults.
const { checkBrowsers } = require('react-dev-utils/browsersHelper');
checkBrowsers(paths.appPath, isInteractive)
  .then(() => {
    // First, read the current file sizes in build directory.
    // This lets us display how much they changed later.
    return measureFileSizesBeforeBuild(paths.appBuild);
  })
  .then(previousFileSizes => {
    // Remove all content but keep the directory so that
    // if you're in it, you don't end up in Trash
    fs.emptyDirSync(paths.appBuild);
    // Merge with the public folder
    copyPublicFolder();
    // Start the webpack build
    return build(previousFileSizes);
  })
  .then(
    ({ stats, previousFileSizes, warnings }) => {
      if (warnings.length) {
        console.log(chalk.yellow('Compiled with warnings.\n'));
        console.log(warnings.join('\n\n'));
        console.log(
          '\nSearch for the ' +
            chalk.underline(chalk.yellow('keywords')) +
            ' to learn more about each warning.'
        );
        console.log(
          'To ignore, add ' +
            chalk.cyan('// eslint-disable-next-line') +
            ' to the line before.\n'
        );
      } else {
        console.log(chalk.green('Compiled successfully.\n'));
      }

      writeProductionSeoFiles();

      console.log('File sizes after gzip:\n');
      printFileSizesAfterBuild(
        stats,
        previousFileSizes,
        paths.appBuild,
        WARN_AFTER_BUNDLE_GZIP_SIZE,
        WARN_AFTER_CHUNK_GZIP_SIZE
      );
      console.log();

      const appPackage = require(paths.appPackageJson);
      const publicUrl = paths.publicUrl;
      const publicPath = config.output.publicPath;
      const buildFolder = path.relative(process.cwd(), paths.appBuild);
      printHostingInstructions(
        appPackage,
        publicUrl,
        publicPath,
        buildFolder,
        useYarn
      );
    },
    err => {
      console.log(chalk.red('Failed to compile.\n'));
      printBuildError(err);
      process.exit(1);
    }
  )
  .catch(err => {
    if (err && err.message) {
      console.log(err.message);
    }
    process.exit(1);
  });

// Create the production build and print the deployment instructions.
function build(previousFileSizes) {
  console.log('Creating an optimized production build...');

  let compiler = webpack(config);
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      let messages;
      if (err) {
        if (!err.message) {
          return reject(err);
        }
        messages = formatWebpackMessages({
          errors: [err.message],
          warnings: [],
        });
      } else {
        messages = formatWebpackMessages(
          stats.toJson({ all: false, warnings: true, errors: true })
        );
      }
      if (messages.errors.length) {
        // Only keep the first error. Others are often indicative
        // of the same problem, but confuse the reader with noise.
        if (messages.errors.length > 1) {
          messages.errors.length = 1;
        }
        return reject(new Error(messages.errors.join('\n\n')));
      }
      if (
        process.env.CI &&
        (typeof process.env.CI !== 'string' ||
          process.env.CI.toLowerCase() !== 'false') &&
        messages.warnings.length
      ) {
        console.log(
          chalk.yellow(
            '\nTreating warnings as errors because process.env.CI = true.\n' +
              'Most CI servers set it automatically.\n'
          )
        );
        return reject(new Error(messages.warnings.join('\n\n')));
      }

      const resolveArgs = {
        stats,
        previousFileSizes,
        warnings: messages.warnings,
      };
      if (writeStatsJson) {
        return bfj
          .write(paths.appBuild + '/bundle-stats.json', stats.toJson())
          .then(() => resolve(resolveArgs))
          .catch(error => reject(new Error(error)));
      }

      return resolve(resolveArgs);
    });
  });
}

function copyPublicFolder() {
  fs.copySync(paths.appPublic, paths.appBuild, {
    dereference: true,
    filter: file => file !== paths.appHtml,
  });
}

function normalizeSiteUrl(value) {
  if (!value || !value.trim()) return null;

  let siteUrl;
  try {
    siteUrl = new URL(value.trim());
  } catch (error) {
    throw new Error(`SITE_URL must be an absolute URL. Received: ${value}`);
  }

  if (siteUrl.protocol !== 'https:' && siteUrl.protocol !== 'http:') {
    throw new Error(`SITE_URL must use http or https. Received: ${value}`);
  }

  siteUrl.username = '';
  siteUrl.password = '';
  siteUrl.search = '';
  siteUrl.hash = '';
  siteUrl.pathname = `${siteUrl.pathname.replace(/\/+$/, '')}/`;
  return siteUrl.toString();
}

function escapeMarkup(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function withHttps(value) {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function writeProductionSeoFiles() {
  // Hosted builds expose their canonical production URL. SITE_URL keeps the
  // same workflow portable to other hosts and to local release builds.
  const netlifyUrl = String(process.env.NETLIFY).toLowerCase() === 'true'
    ? process.env.URL
    : null;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL;
  const vercelUrl = withHttps(vercelHost);
  const configuredUrl = process.env.SITE_URL || netlifyUrl || vercelUrl;
  const siteUrl = normalizeSiteUrl(configuredUrl);

  if (!siteUrl) {
    console.log(chalk.yellow(
      'SEO: no production site URL is available; canonical metadata and sitemap.xml were skipped.\n'
    ));
    return;
  }

  const description = 'Order 19L spring water refills for homes and offices in Sialkot Cantt. Track deliveries, bottles, invoices, and balances with Himaliya Spring Water.';
  const shareImageUrl = new URL('icon-512.png', siteUrl).toString();
  const safeSiteUrl = escapeMarkup(siteUrl);
  const safeShareImageUrl = escapeMarkup(shareImageUrl);
  const safeDescription = escapeMarkup(description);
  const seoMarkup = [
    `    <link rel="canonical" href="${safeSiteUrl}">`,
    `    <meta property="og:url" content="${safeSiteUrl}">`,
    `    <meta property="og:image" content="${safeShareImageUrl}">`,
    '    <meta property="og:image:type" content="image/png">',
    '    <meta property="og:image:width" content="512">',
    '    <meta property="og:image:height" content="512">',
    '    <meta property="og:image:alt" content="Himaliya Spring Water droplet logo">',
    `    <meta name="twitter:image" content="${safeShareImageUrl}">`,
    '    <meta name="twitter:image:alt" content="Himaliya Spring Water droplet logo">',
  ].join('\n');
  const structuredMarkup = [
    `    <div data-seo-structured-data itemscope itemtype="https://schema.org/WebSite" itemid="${safeSiteUrl}#website">`,
    `      <link itemprop="url" href="${safeSiteUrl}">`,
    '      <meta itemprop="name" content="Himaliya Spring Water">',
    `      <meta itemprop="description" content="${safeDescription}">`,
    '      <meta itemprop="inLanguage" content="en-PK">',
    `      <div itemprop="publisher" itemscope itemtype="https://schema.org/LocalBusiness" itemid="${safeSiteUrl}#business">`,
    '        <meta itemprop="name" content="Himaliya Spring Water">',
    `        <link itemprop="url" href="${safeSiteUrl}">`,
    `        <meta itemprop="description" content="${safeDescription}">`,
    `        <link itemprop="image" href="${safeShareImageUrl}">`,
    `        <link itemprop="logo" href="${safeShareImageUrl}">`,
    '        <div itemprop="address" itemscope itemtype="https://schema.org/PostalAddress">',
    '          <meta itemprop="addressLocality" content="Sialkot Cantt">',
    '          <meta itemprop="addressCountry" content="PK">',
    '        </div>',
    '        <div itemprop="areaServed" itemscope itemtype="https://schema.org/Place">',
    '          <meta itemprop="name" content="Sialkot Cantt">',
    '        </div>',
    '      </div>',
    '    </div>',
  ].join('\n');
  const indexPath = path.join(paths.appBuild, 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  if (!/<\/head>/i.test(indexHtml) || !/<\/body>/i.test(indexHtml)) {
    throw new Error('SEO metadata could not be written because build/index.html is missing a closing head or body tag.');
  }

  fs.writeFileSync(
    indexPath,
    indexHtml
      .replace(/<\/head>/i, `${seoMarkup}\n  </head>`)
      .replace(/<\/body>/i, `${structuredMarkup}\n  </body>`),
    'utf8'
  );

  const sitemapUrl = `${siteUrl}sitemap.xml`;
  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    `    <loc>${safeSiteUrl}</loc>`,
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(paths.appBuild, 'sitemap.xml'), sitemap, 'utf8');

  const robotsPath = path.join(paths.appBuild, 'robots.txt');
  const robots = fs.existsSync(robotsPath)
    ? fs.readFileSync(robotsPath, 'utf8').trimEnd()
    : 'User-agent: *\nAllow: /';
  fs.writeFileSync(robotsPath, `${robots}\nSitemap: ${sitemapUrl}\n`, 'utf8');
  console.log(chalk.green(`SEO: wrote canonical metadata and sitemap.xml for ${siteUrl}\n`));
}
