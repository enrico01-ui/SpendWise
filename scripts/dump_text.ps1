param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Filename,
    [string]$Preset = "none",
    [ValidateSet("tesseract")][string]$Engine = "tesseract",
    [switch]$Json
)

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$dockerExitCode = 0
Push-Location $repositoryRoot
try {
    $arguments = @(
        "compose", "exec", "-T", "ocr", "python", "-m", "eval.dump_text",
        $Filename,
        "--preset", $Preset,
        "--engine", $Engine
    )
    if ($Json) {
        $arguments += "--json"
    }

    & docker @arguments
    $dockerExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $dockerExitCode
