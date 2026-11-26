#!/usr/bin/env node

/**
 * WAN22 OS - Contract Module Test
 * 
 * Validates:
 * - JavaScript syntax
 * - JSON validity
 * - File structure
 * - Basic logic
 */

const fs = require('fs');
const path = require('path');

// ========================================
// Test Configuration
// ========================================

const TESTS = [
    { name: 'HTML file exists', fn: testHtmlExists },
    { name: 'CSS file exists', fn: testCssExists },
    { name: 'JavaScript file exists', fn: testJsExists },
    { name: 'State file exists', fn: testStateExists },
    { name: 'Server file exists', fn: testServerExists },
    { name: 'Package.json valid', fn: testPackageJson },
    { name: 'State.json valid JSON', fn: testStateJson },
    { name: 'JavaScript syntax', fn: testJsSyntax },
    { name: 'HTML structure', fn: testHtmlStructure },
    { name: 'CSS variables defined', fn: testCssVariables },
    { name: 'Costs module (app.js)', fn: testCostsModuleJs },
    { name: 'Costs module (state.json)', fn: testCostsModuleState }
];

// ========================================
// Test Functions
// ========================================

// Helper to find files
function findFile(filename) {
    const paths = [
        `./wan22-mvp/${filename}`,
        `./${filename}`,
        `${filename}`
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

function testHtmlExists() {
    const path = findFile('index.html');
    return path ? { pass: true } : { pass: false, error: 'index.html not found' };
}

function testCssExists() {
    const path = findFile('styles.css');
    return path ? { pass: true } : { pass: false, error: 'styles.css not found' };
}

function testJsExists() {
    const path = findFile('app.js');
    return path ? { pass: true } : { pass: false, error: 'app.js not found' };
}

function testStateExists() {
    const path = findFile('state.json');
    return path ? { pass: true } : { pass: false, error: 'state.json not found' };
}

function testServerExists() {
    const path = findFile('server.py');
    return path ? { pass: true } : { pass: false, error: 'server.py not found' };
}

function testPackageJson() {
    try {
        const pkgPath = findFile('package.json');
        if (!pkgPath) return { pass: false, error: 'package.json not found' };
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (!pkg.name || !pkg.scripts) {
            return { pass: false, error: 'Invalid package.json structure' };
        }
        return { pass: true, message: `v${pkg.version}` };
    } catch (e) {
        return { pass: false, error: `Invalid JSON: ${e.message}` };
    }
}

function testStateJson() {
    try {
        const statePath = findFile('state.json');
        if (!statePath) return { pass: false, error: 'state.json not found' };
        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
        
        if (!Array.isArray(state.contracts)) {
            return { pass: false, error: 'contracts must be an array' };
        }
        
        if (!Array.isArray(state.projects)) {
            return { pass: false, error: 'projects must be an array' };
        }
        
        // Validate contract structure
        for (const contract of state.contracts) {
            if (!contract.id || !contract.name || !(contract.clientName || contract.client)) {
                return { pass: false, error: 'Contract missing required fields' };
            }
        }
        
        return { 
            pass: true, 
            message: `${state.contracts.length} contracts, ${state.projects.length} projects` 
        };
    } catch (e) {
        return { pass: false, error: `Invalid JSON: ${e.message}` };
    }
}

function testJsSyntax() {
    try {
        const jsPath = findFile('app.js');
        if (!jsPath) return { pass: false, error: 'app.js not found' };
        const code = fs.readFileSync(jsPath, 'utf-8');
        
        // Basic syntax checks
        const checks = [
            { name: 'Constructor', regex: /class\s+\w+\s*{/ },
            { name: 'Init method', regex: /init|initialize|setup|DOMContentLoaded/ },
            { name: 'Render method', regex: /render/ },
            { name: 'Save method', regex: /save|persist/ },
            { name: 'Delete method', regex: /delete|remove/ },
            { name: 'Event listeners', regex: /addEventListener|attachEventListeners|addEventListeners/ }
        ];
        
        const missing = [];
        for (const check of checks) {
            if (!check.regex.test(code)) {
                missing.push(check.name);
            }
        }
        
        if (missing.length > 0) {
            return { pass: false, error: `Missing: ${missing.join(', ')}` };
        }
        
        return { pass: true, message: 'All required methods present' };
    } catch (e) {
        return { pass: false, error: e.message };
    }
}

function testHtmlStructure() {
    try {
        const htmlPath = findFile('index.html');
        if (!htmlPath) return { pass: false, error: 'index.html not found' };
        const html = fs.readFileSync(htmlPath, 'utf-8');
        
        const checks = [
            { name: 'DOCTYPE', regex: /<!DOCTYPE html>/ },
            { name: 'Navigation', regex: /nav|button/ },
            { name: 'Content area', regex: /id="app-content"|class="app-main"/ },
            { name: 'Dialogs container', regex: /id="dialogs"|class="modal"/ },
            { name: 'HTML structure', regex: /<body>.*<\/body>/s },
            { name: 'Meta tags', regex: /charset/ },
            { name: 'app.js script', regex: /<script[^>]*src="app\.js"/ }
        ];
        
        const missing = [];
        for (const check of checks) {
            if (!check.regex.test(html)) {
                missing.push(check.name);
            }
        }
        
        if (missing.length > 0) {
            return { pass: false, error: `Missing: ${missing.join(', ')}` };
        }
        
        return { pass: true, message: 'All required elements present' };
    } catch (e) {
        return { pass: false, error: e.message };
    }
}

function testCssVariables() {
    try {
        const cssPath = findFile('styles.css');
        if (!cssPath) return { pass: false, error: 'styles.css not found' };
        const css = fs.readFileSync(cssPath, 'utf-8');
        
        const checks = [
            { name: 'CSS variables root', regex: /:root\s*{/ },
            { name: 'Primary color', regex: /--primary|--color/ },
            { name: 'Border/radius', regex: /--border|--radius/ },
            { name: 'Colors', regex: /--(primary|secondary|success|danger|warning|color)/ },
            { name: 'Shadow', regex: /--shadow|box-shadow/ },
            { name: 'Text colors', regex: /color:\s*|--text|--dark|--light/ }
        ];
        
        const missing = [];
        for (const check of checks) {
            if (!check.regex.test(css)) {
                missing.push(check.name);
            }
        }
        
        if (missing.length > 0) {
            return { pass: false, error: `Missing: ${missing.join(', ')}` };
        }
        
        return { pass: true, message: 'Design system complete' };
    } catch (e) {
        return { pass: false, error: e.message };
    }
}

function testCostsModuleJs() {
    try {
        const jsPath = findFile('app.js');
        if (!jsPath) return { pass: false, error: 'app.js not found' };
        const code = fs.readFileSync(jsPath, 'utf-8');

        const checks = [
            { name: 'renderCostList', regex: /renderCostList\s*\(/ },
            { name: 'attachCostListeners', regex: /attachCostListeners\s*\(/ },
            { name: 'openCostDialog', regex: /openCostDialog\s*\(/ },
            { name: 'deleteCost', regex: /deleteCost\s*\(/ },
            { name: 'cost-form handler', regex: /cost-form/ },
            { name: 'nav view switching', regex: /attachNavListeners/ }
        ];

        const missing = [];
        for (const check of checks) {
            if (!check.regex.test(code)) missing.push(check.name);
        }

        if (missing.length > 0) {
            return { pass: false, error: `Missing: ${missing.join(', ')}` };
        }

        return { pass: true, message: 'Costs module wired (list, dialog, CRUD, nav)' };
    } catch (e) {
        return { pass: false, error: e.message };
    }
}

function testCostsModuleState() {
    try {
        const statePath = findFile('state.json');
        if (!statePath) return { pass: false, error: 'state.json not found' };
        const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

        if (!Array.isArray(state.costs)) {
            return { pass: false, error: 'costs must be an array' };
        }
        if (!Array.isArray(state.costTypes) || state.costTypes.length === 0) {
            return { pass: false, error: 'costTypes must be a non-empty array' };
        }
        for (const cost of state.costs) {
            if (!cost.id || !cost.name || typeof cost.amount !== 'number') {
                return { pass: false, error: 'Cost item missing required fields (id, name, amount)' };
            }
        }

        return {
            pass: true,
            message: `${state.costs.length} costs, ${state.costTypes.length} cost types`
        };
    } catch (e) {
        return { pass: false, error: `Invalid data: ${e.message}` };
    }
}

// ========================================
// Test Runner
// ========================================

function runTests() {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║  WAN22 OS - Contract Module MVP - Test Suite      ║');
    console.log('╚════════════════════════════════════════════════════╝\n');

    let passed = 0;
    let failed = 0;

    for (const test of TESTS) {
        try {
            const result = test.fn();
            
            if (result.pass) {
                console.log(`✓ ${test.name}`);
                if (result.message) {
                    console.log(`  └─ ${result.message}`);
                }
                passed++;
            } else {
                console.log(`✗ ${test.name}`);
                console.log(`  └─ ${result.error}`);
                failed++;
            }
        } catch (e) {
            console.log(`✗ ${test.name}`);
            console.log(`  └─ ${e.message}`);
            failed++;
        }
    }

    console.log(`\n${'-'.repeat(50)}`);
    console.log(`\nResults: ${passed} passed, ${failed} failed (${passed + failed} total)\n`);

    if (failed === 0) {
        console.log('✓ All tests passed! Ready to deploy.\n');
        process.exit(0);
    } else {
        console.log('✗ Some tests failed. Please fix the issues.\n');
        process.exit(1);
    }
}

// ========================================
// Run Tests
// ========================================

if (require.main === module) {
    runTests();
}

module.exports = { runTests };
