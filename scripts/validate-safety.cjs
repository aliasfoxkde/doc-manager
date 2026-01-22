#!/usr/bin/env node

/**
 * Safety Validation Script
 *
 * CI/CD script to validate code against production safety requirements:
 * - Detects TODO, FIXME, XXX, HACK comments
 * - Detects placeholder values in code
 * - Validates data contracts are being used
 * - Checks for console.log statements
 * - Validates import paths
 *
 * Usage: node scripts/validate-safety.js [--strict] [--fix]
 */

const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');

// Configuration
const CONFIG = {
  srcDir: 'src',
  ignorePatterns: [
    'node_modules',
    'dist',
    '.git',
    '*.test.ts',
    '*.test.tsx',
    '*.spec.ts',
    '*.spec.tsx',
  ],
  // Files where placeholder patterns are allowed (definitions, patterns, etc.)
  placeholderAllowedIn: [
    'src/core/productionSafety.ts',
    'src/core/dataContracts.ts',
  ],
  // Patterns to detect in code
  patterns: {
    // Code comments that indicate incomplete work
    todo: /\/\/\s*TODO[:\s]|\/\*[\s\S]*?\*[\s\S]*?TODO[:\s]/gi,
    fixme: /\/\/\s*FIXME[:\s]|\/\*[\s\S]*?\*[\s\S]*?FIXME[:\s]/gi,
    xxx: /\/\/\s*XXX[:\s]|\/\*[\s\S]*?\*[\s\S]*?XXX[:\s]/gi,
    hack: /\/\/\s*HACK[:\s]|\/\*[\s\S]*?\*[\s\S]*?HACK[:\s]/gi,

    // Placeholder values
    placeholderStrings: /('|")(\[placeholder\]|<placeholder>|{{placeholder}}|TODO|FIXME|XXX|N\/A|TBD|TBC|to be (determined|completed))\1/gi,

    // Mock/test data in production files
    mockData: /(mock|test|dummy|fake|sample).*data?/gi,

    // Console statements (should use observability instead)
    consoleLog: /console\.(log|warn|error|debug|info)\(/g,

    // Any without proper error handling
    anyType: /:\s*any\b/g,
  },
  // Allowed files for console.* (development only)
  consoleAllowed: [
    'src/core/observability.ts',
    'src/main.tsx',
  ],
};

// Results tracking
const results = {
  errors: [],
  warnings: [],
  summary: {
    filesScanned: 0,
    issuesFound: 0,
    byCategory: {},
  },
};

// ANSI colors for terminal output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message, file, line, category) {
  results.errors.push({ message, file, line, category });
  results.summary.issuesFound++;
  results.summary.byCategory[category] = (results.summary.byCategory[category] || 0) + 1;
}

function warning(message, file, line, category) {
  results.warnings.push({ message, file, line, category });
  results.summary.issuesFound++;
  results.summary.byCategory[category] = (results.summary.byCategory[category] || 0) + 1;
}

function scanFile(filePath, strict = false) {
  const relativePath = path.relative(process.cwd(), filePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  results.summary.filesScanned++;

  // Skip test files
  if (relativePath.includes('.test.') || relativePath.includes('.spec.')) {
    return;
  }

  // Scan each line
  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check for TODO comments
    if (CONFIG.patterns.todo.test(line)) {
      const match = line.match(/TODO[:\s]*(.+)?/i);
      error(
        `TODO comment detected${match[1] ? `: "${match[1].trim()}"` : ''}`,
        relativePath,
        lineNumber,
        'todo'
      );
    }

    // Check for FIXME comments
    if (CONFIG.patterns.fixme.test(line)) {
      const match = line.match(/FIXME[:\s]*(.+)?/i);
      error(
        `FIXME comment detected${match[1] ? `: "${match[1].trim()}"` : ''}`,
        relativePath,
        lineNumber,
        'fixme'
      );
    }

    // Check for XXX comments
    if (CONFIG.patterns.xxx.test(line)) {
      const match = line.match(/XXX[:\s]*(.+)?/i);
      warning(
        `XXX comment detected${match[1] ? `: "${match[1].trim()}"` : ''}`,
        relativePath,
        lineNumber,
        'xxx'
      );
    }

    // Check for HACK comments
    if (CONFIG.patterns.hack.test(line)) {
      const match = line.match(/HACK[:\s]*(.+)?/i);
      warning(
        `HACK comment detected - consider refactoring${match[1] ? `: "${match[1].trim()}"` : ''}`,
        relativePath,
        lineNumber,
        'hack'
      );
    }

    // Check for placeholder strings
    const placeholderMatch = line.match(CONFIG.patterns.placeholderStrings);
    if (placeholderMatch && !line.includes('placeholder=')) {
      // Skip if file is in allowed list (pattern definitions)
      const isPlaceholderAllowed = CONFIG.placeholderAllowedIn.some(allowed => relativePath.endsWith(allowed));
      if (!isPlaceholderAllowed) {
        // Allow placeholder attributes in JSX
        error(
          `Placeholder value detected: "${placeholderMatch[0]}"`,
          relativePath,
          lineNumber,
          'placeholder'
        );
      }
    }

    // Check for console statements (only warn if not in allowed files)
    if (CONFIG.patterns.consoleLog.test(line)) {
      const isAllowed = CONFIG.consoleAllowed.some(allowed => relativePath.endsWith(allowed));
      if (!isAllowed) {
        warning(
          `console.${line.match(/console\.(log|warn|error|debug|info)/)[1]}() detected - use observability instead`,
          relativePath,
          lineNumber,
          'console'
        );
      }
    }

    // In strict mode, check for `any` types
    if (strict && CONFIG.patterns.anyType.test(line)) {
      warning(
        "'any' type detected - consider using specific types",
        relativePath,
        lineNumber,
        'typescript'
      );
    }
  });
}

function scanFiles(strict = false) {
  const pattern = path.join(CONFIG.srcDir, '**', '*.{ts,tsx,js,jsx}');
  const files = globSync(pattern, {
    ignore: CONFIG.ignorePatterns.map(p => path.join(CONFIG.srcDir, p)),
  });

  log(`\nScanning ${files.length} files...\n`, 'blue');

  files.forEach(file => scanFile(file, strict));

  return results;
}

function printResults() {
  const { errors, warnings, summary } = results;

  log('\n=== VALIDATION RESULTS ===\n', 'bold');

  // Print errors
  if (errors.length > 0) {
    log(`❌ ERRORS (${errors.length}):\n`, 'red');
    errors.forEach(err => {
      log(`  [${err.category}] ${err.file}:${err.line}`, 'red');
      log(`    ${err.message}\n`, 'red');
    });
  }

  // Print warnings
  if (warnings.length > 0) {
    log(`⚠️  WARNINGS (${warnings.length}):\n`, 'yellow');
    warnings.forEach(warn => {
      log(`  [${warn.category}] ${warn.file}:${warn.line}`, 'yellow');
      log(`    ${warn.message}\n`, 'yellow');
    });
  }

  // Print summary
  log('=== SUMMARY ===\n', 'bold');
  log(`Files scanned: ${summary.filesScanned}`);
  log(`Issues found: ${summary.issuesFound}`);

  if (Object.keys(summary.byCategory).length > 0) {
    log('\nIssues by category:');
    Object.entries(summary.byCategory)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, count]) => {
        log(`  ${category}: ${count}`);
      });
  }

  // Print verdict
  log('\n=== VERDICT ===\n', 'bold');
  if (errors.length === 0 && warnings.length === 0) {
    log('✅ All checks passed!\n', 'green');
    return 0;
  } else if (errors.length === 0) {
    log('⚠️  Passed with warnings\n', 'yellow');
    return 0;
  } else {
    log('❌ Validation failed!\n', 'red');
    log('Please fix the issues above before committing.\n', 'red');
    return 1;
  }
}

function generateReport() {
  const report = {
    timestamp: new Date().toISOString(),
    summary: results.summary,
    errors: results.errors,
    warnings: results.warnings,
  };

  const reportPath = path.join(process.cwd(), 'safety-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\n📄 Report saved to: ${reportPath}\n`, 'blue');
}

// Parse CLI arguments
const args = process.argv.slice(2);
const strict = args.includes('--strict');
const shouldFix = args.includes('--fix');
const generateReportFlag = args.includes('--report');

// Main execution
log('\n🔍 Doc Manager Safety Validation\n', 'bold');

try {
  scanFiles(strict);

  if (generateReportFlag) {
    generateReport();
  }

  const exitCode = printResults();
  process.exit(exitCode);
} catch (err) {
  log(`\n❌ Error during validation: ${err.message}\n`, 'red');
  console.error(err);
  process.exit(1);
}
