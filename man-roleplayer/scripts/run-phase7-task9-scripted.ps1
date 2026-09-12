param([string]$Profile = 'man-roles-phase7-task9-scripted')
$ErrorActionPreference = 'Stop'
$pluginDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectRoot = (Resolve-Path (Join-Path $pluginDir '..')).Path
$harnessRoot = (Resolve-Path (Join-Path $projectRoot '..\deepseek-harness')).Path
$runId = Get-Date -Format 'yyyyMMdd-HHmmssfff'
$dshHome = Join-Path $projectRoot ".validation\phase7-task9-scripted-$runId"
$Profile = "man-roles-phase7-task9-scripted-$runId"
New-Item -ItemType Directory -Path $dshHome -Force | Out-Null
$env:DSH_HOME = $dshHome
Push-Location $pluginDir
try { npm run build } finally { Pop-Location }
$installed = Join-Path $dshHome "profiles\$Profile\node_modules\man-roles-roleplayer"
Push-Location $harnessRoot
try {
  if (-not (Test-Path -LiteralPath $installed)) {
    node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') plugin --profile $Profile add "file:$pluginDir" --config.package-import-method=copy "--config.store-dir=$(Join-Path $dshHome 'pnpm-store')"
  }
  $env:MAN_ROLES_RP_E2E = 'phase7-task9-scripted'
  $env:MAN_ROLES_TASK9_OUTPUT = (Join-Path $dshHome 'report')
  node --import tsx/esm (Join-Path $harnessRoot 'apps/cli/src/bin.ts') --profile $Profile 'ok'
  if ($LASTEXITCODE -ne 0) { throw "scripted Task9 failed: exit=$LASTEXITCODE" }
} finally { Pop-Location }
$report = Join-Path $dshHome 'report\report.json'
if (-not (Test-Path -LiteralPath $report)) { throw "scripted Task9 report missing: $report" }
Push-Location $pluginDir
try {
  node --input-type=module -e "import fs from 'node:fs'; import { validatePhase7Task9Report } from './lib/phase7-task9-report.js'; const p=process.argv[1]; const r=JSON.parse(fs.readFileSync(p,'utf8')); const failures=validatePhase7Task9Report(r, r.scenarios.map(s=>s.personaId), r.provider, r.model); if(failures.length){ console.error(JSON.stringify({validator:failures})); process.exit(1) } console.log('validator: []')" $report
  if ($LASTEXITCODE -ne 0) { throw "scripted Task9 validator failed: exit=$LASTEXITCODE" }
} finally { Pop-Location }
Write-Host "report: $report"
