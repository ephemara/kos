param(
    [ValidateSet("Status", "Prepare", "Advance")]
    [string]$Mode = "Status",
    [ValidateSet("completed", "blocked", "failed")]
    [string]$Status = "completed",
    [string]$Summary = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-JsonFile {
    param([string]$Path)
    return Get-Content -Raw -Path $Path | ConvertFrom-Json
}

function Write-JsonFile {
    param(
        [string]$Path,
        [object]$Data
    )

    $json = $Data | ConvertTo-Json -Depth 100
    Set-Content -Path $Path -Value ($json + "`n")
}

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Render-Template {
    param(
        [string]$TemplatePath,
        [hashtable]$Tokens
    )

    $content = Get-Content -Raw -Path $TemplatePath
    foreach ($key in $Tokens.Keys) {
        $content = $content.Replace("{{${key}}}", [string]$Tokens[$key])
    }
    return $content
}

$root = Split-Path -Parent $PSScriptRoot
$configDir = Join-Path $root "config"
$templatesDir = Join-Path $root "templates"

$pipeline = Read-JsonFile -Path (Join-Path $configDir "pipeline.manifest.json")
$agents = Read-JsonFile -Path (Join-Path $configDir "agents.manifest.json")
$targets = Read-JsonFile -Path (Join-Path $configDir "targets.manifest.json")
$verification = Read-JsonFile -Path (Join-Path $configDir "verification.manifest.json")
$statePath = $pipeline.output.stateFile
$state = Read-JsonFile -Path $statePath

$turn = [int]$state.currentTurn
$cycleLength = [int]$state.cycleLength
$slot = (($turn - 1) % $cycleLength) + 1
$phase = $pipeline.cycle | Where-Object { $_.slot -eq $slot } | Select-Object -First 1
$agent = $agents.agents | Where-Object { $_.id -eq $phase.agentId } | Select-Object -First 1
$focusAreas = $targets.focusAreas | Where-Object { $state.activeFocusAreaIds -contains $_.id }
$runId = "{0}-turn-{1:D3}-{2}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $turn, $phase.phaseId
$runDir = Join-Path $pipeline.output.runsDir $runId

switch ($Mode) {
    "Status" {
        [pscustomobject]@{
            pipeline = $pipeline.pipelineId
            turn = $turn
            slot = $slot
            phase = $phase.phaseId
            agent = $agent.title
            lastStatus = $state.lastStatus
            lastCompletedRunId = $state.lastCompletedRunId
        } | ConvertTo-Json -Depth 10
        break
    }

    "Prepare" {
        Ensure-Directory -Path $runDir
        Ensure-Directory -Path $pipeline.output.notesDir
        Ensure-Directory -Path $pipeline.output.changelogDir

        $focusAreaLines = ($focusAreas | ForEach-Object {
            "- {0}: {1}" -f $_.label, (($_.successSignals -join "; "))
        }) -join "`n"

        $rootLines = ($pipeline.primaryProductRoots | ForEach-Object { "- $_" }) -join "`n"
        $carryForwardLines = ($state.carryForward | ForEach-Object { "- $_" }) -join "`n"
        $deliverableLines = ($agent.deliverables | ForEach-Object { "- $_" }) -join "`n"

        $validationRule = if ($phase.phaseId -eq "validation") {
            ($verification.validationTurnCommands | ForEach-Object {
                "- {0} (`{1}` in `{2}`): {3}" -f $_.id, $_.command, $_.cwd, $_.purpose
            }) -join "`n"
        } else {
            "Run the narrowest useful verification for touched surfaces and record exact command results."
        }

        $documentationRule = if ($phase.phaseId -eq "documentation") {
            ($verification.documentationTurnExpectations | ForEach-Object { "- $_" }) -join "`n"
        } else {
            "If architecture or folder ownership meaningfully changed, leave the next documentation turn with clear source material."
        }

        $tokens = @{
            RUN_ID = $runId
            TURN = $turn
            SLOT = $slot
            PHASE_ID = $phase.phaseId
            PHASE_GOAL = $phase.goal
            AGENT_ID = $agent.id
            AGENT_TITLE = $agent.title
            DATE = (Get-Date -Format "yyyy-MM-dd")
            WORKSPACE_ROOTS = $rootLines
            FOCUS_AREAS = $focusAreaLines
            CARRY_FORWARD = $carryForwardLines
            DELIVERABLES = $deliverableLines
            VALIDATION_RULE = $validationRule
            DOCUMENTATION_RULE = $documentationRule
        }

        $workOrder = Render-Template -TemplatePath (Join-Path $templatesDir "work-order.md") -Tokens $tokens
        $prompt = Render-Template -TemplatePath (Join-Path $templatesDir "frontier-prompt.md") -Tokens $tokens
        $handoff = Render-Template -TemplatePath (Join-Path $templatesDir "handoff.md") -Tokens $tokens
        $notes = Render-Template -TemplatePath (Join-Path $templatesDir "notes-entry.md") -Tokens $tokens
        $changelog = Render-Template -TemplatePath (Join-Path $templatesDir "changelog-entry.md") -Tokens $tokens

        Set-Content -Path (Join-Path $runDir "work-order.md") -Value $workOrder
        Set-Content -Path (Join-Path $runDir "frontier-prompt.md") -Value $prompt
        Set-Content -Path (Join-Path $runDir "handoff.md") -Value $handoff
        Set-Content -Path (Join-Path $runDir "notes-entry.md") -Value $notes
        Set-Content -Path (Join-Path $runDir "changelog-entry.md") -Value $changelog

        $state.lastPreparedRunId = $runId
        $state.lastAgentId = $agent.id
        $state.lastPhaseId = $phase.phaseId
        $state.lastStatus = "prepared"
        Write-JsonFile -Path $statePath -Data $state

        [pscustomobject]@{
            mode = "Prepare"
            runId = $runId
            turn = $turn
            phase = $phase.phaseId
            agent = $agent.title
            runDir = $runDir
        } | ConvertTo-Json -Depth 10
        break
    }

    "Advance" {
        $state.lastCompletedRunId = $state.lastPreparedRunId
        $state.lastStatus = $Status
        $state.currentTurn = $turn + 1

        if (-not [string]::IsNullOrWhiteSpace($Summary)) {
            $recent = @($state.recentChanges)
            $state.recentChanges = @($Summary) + $recent | Select-Object -First 12
        }

        Write-JsonFile -Path $statePath -Data $state

        [pscustomobject]@{
            mode = "Advance"
            completedRunId = $state.lastCompletedRunId
            nextTurn = $state.currentTurn
            status = $Status
        } | ConvertTo-Json -Depth 10
        break
    }
}
