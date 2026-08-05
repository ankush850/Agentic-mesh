/**
 * Deliberately Broken JavaScript File (Section 3 & Section 4)
 * Contains syntax errors to verify that Tree-sitter error recovery
 * flags ERROR nodes without crashing the UI or interrupting other files.
 */

function calculateMetrics(a, b) {
  return a + b;
}

// SYNTAX ERROR: Malformed function declaration with missing identifier and improper brace
function ( {
  const invalid = ;
}

// Valid symbol after the syntax error to test parser recovery
class RecoveryTestClass {
  constructor() {
    this.recovered = true;
  }
}

