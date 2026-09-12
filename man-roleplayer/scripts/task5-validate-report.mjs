import { readFileSync } from 'node:fs'
import { validateTask5Report } from '../lib/task5-report.js'
const expected = process.argv.slice(3)
const result = validateTask5Report(JSON.parse(readFileSync(process.argv[2], 'utf8')), expected.length ? expected : undefined)
console.log(JSON.stringify(result)); if (!result.passed) process.exitCode = 1
