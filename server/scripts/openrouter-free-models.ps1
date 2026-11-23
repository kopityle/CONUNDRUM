<#!
.SYNOPSIS
  Lists OpenRouter free models and optionally runs a chat request with automatic fallback.

.NOTES
  PowerShell 7+ (pwsh). No API key is needed for listing models.

.EXAMPLE
  pwsh ./server/scripts/openrouter-free-models.ps1

.EXAMPLE
  pwsh ./server/scripts/openrouter-free-models.ps1 -ShowPool

.EXAMPLE
  $env:OPENROUTER_API_KEY = 'sk-or-...'
  pwsh ./server/scripts/openrouter-free-models.ps1 -Chat
#>
[CmdletBinding()]
param(
    [switch]$Chat,
    [switch]$ShowPool,
    [int]$Top = 20,
    [string[]]$Pool
)

$ErrorActionPreference = 'Stop'

$ModelsUri = 'https://openrouter.ai/api/v1/models'
$ChatUri   = 'https://openrouter.ai/api/v1/chat/completions'

# Curated order: router first, then fast flash models, then heavier reasoning models.
$PreferredPool = @(
    'openrouter/free',
    'inclusionai/ling-3.2-flash:free',
    'baidu/ernie-5.5-flash-preview:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
)

function Get-FreeModels {
    $response = Invoke-RestMethod -Uri $ModelsUri -Method Get

    $response.data | Where-Object {
        [string]$_.pricing.prompt -eq '0' -and
        [string]$_.pricing.completion -eq '0'
    }
}

function Get-FreeChatPool {
    $available = @(Get-FreeModels | Where-Object {
        $_.architecture.output_modalities -contains 'text' -and
        $_.architecture.output_modalities -notcontains 'audio' -and
        $_.architecture.output_modalities -notcontains 'video'
    } | ForEach-Object { $_.id })

    # Keep the curated priority, but drop IDs that are no longer free.
    $ordered = @($PreferredPool | Where-Object { $available -contains $_ })
    $rest = @($available | Where-Object { $ordered -notcontains $_ })

    return @($ordered) + @($rest)
}

function Get-HttpStatus {
    param($ErrorRecord)

    $resp = $ErrorRecord.Exception.Response
    if ($null -eq $resp) { return $null }

    try { return [int]$resp.StatusCode } catch { }
    try { return [int]$resp.StatusCode.value__ } catch { }

    return $null
}

function Get-HttpErrorBody {
    param($ErrorRecord)

    $resp = $ErrorRecord.Exception.Response
    if ($null -eq $resp) { return $ErrorRecord.Exception.Message }

    try {
        if (
            $resp.PSObject.Properties.Name -contains 'Content' -and
            $null -ne $resp.Content
        ) {
            return $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }

        $stream = $resp.GetResponseStream()
        if ($null -eq $stream) { return $ErrorRecord.Exception.Message }

        $reader = [System.IO.StreamReader]::new($stream)
        try {
            return $reader.ReadToEnd()
        }
        finally {
            $reader.Dispose()
        }
    }
    catch {
        return $ErrorRecord.Exception.Message
    }
}

function Invoke-OpenRouterChat {
    param(
        [string[]]$Models,
        [string]$SystemPrompt,
        [string]$UserPrompt
    )

    $payload = @{
        models      = @($Models)
        messages    = @(
            @{ role = 'system'; content = $SystemPrompt }
            @{ role = 'user';   content = $UserPrompt }
        )
        temperature = 0.7
        max_tokens  = 2000
    }

    $json  = $payload | ConvertTo-Json -Depth 15
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)

    $headers = @{
        Authorization = "Bearer $env:OPENROUTER_API_KEY"
    }

    for ($attempt = 1; $attempt -le 4; $attempt++) {
        try {
            $result = Invoke-RestMethod `
                -Uri $ChatUri `
                -Method Post `
                -Headers $headers `
                -ContentType 'application/json; charset=utf-8' `
                -Body $bytes `
                -ErrorAction Stop

            return [pscustomobject]@{
                UsedModel = $result.model
                Content   = $result.choices[0].message.content
            }
        }
        catch {
            $status = Get-HttpStatus $_

            if (
                $status -in @(429, 500, 502, 503, 504) -and
                $attempt -lt 4
            ) {
                $delay = [int][math]::Pow(2, $attempt)
                Write-Warning "OpenRouter [$status], retry in $delay sec..."
                Start-Sleep -Seconds $delay
                continue
            }

            $detail = Get-HttpErrorBody $_
            throw "OpenRouter error $(if ($status) { "[$status]" }): $detail"
        }
    }
}

$free = @(Get-FreeModels)

if ($ShowPool) {
    Write-Host "Fallback pool order:"
    Get-FreeChatPool | ForEach-Object { Write-Host "  - $_" }
    return
}

if (-not $Chat) {
    "Total models: $($free.Count) free (queried $((Invoke-RestMethod -Uri $ModelsUri -Method Get).data.Count) total)"

    $free |
        Sort-Object created -Descending |
        Select-Object -First $Top `
            @{ Name = 'Id';      Expression = { $_.id } },
            @{ Name = 'Context'; Expression = { $_.top_provider.context_length } },
            @{ Name = 'Output';  Expression = { $_.architecture.output_modalities -join ',' } } |
        Format-Table -AutoSize

    return
}

if ([string]::IsNullOrWhiteSpace($env:OPENROUTER_API_KEY)) {
    throw 'Set OPENROUTER_API_KEY first: $env:OPENROUTER_API_KEY = "sk-or-..."'
}

if (-not $Pool -or $Pool.Count -eq 0) {
    $Pool = Get-FreeChatPool
}

$systemPrompt = @'
You are a Russian-language crossword generator.
Return strictly valid JSON, without markdown fences and without explanations.
'@

$userPrompt = @'
Придумай 5 слов для кроссворда на тему "Космос" и определения к ним.

Формат ответа:
{"words":[{"word":"...","clue":"..."}]}
'@

Write-Host "Fallback pool:"
$Pool | ForEach-Object { Write-Host "  - $_" }

$answer = Invoke-OpenRouterChat `
    -Models $Pool `
    -SystemPrompt $systemPrompt `
    -UserPrompt $userPrompt

Write-Host "Used model: $($answer.UsedModel)"

try {
    $answer.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
}
catch {
    $answer.Content
}
