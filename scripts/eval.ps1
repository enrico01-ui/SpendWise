param(
    [string]$Label = "baseline",
    [ValidateSet("tesseract")][string]$Engine = "tesseract",
    [string]$Preset = "none",
    [ValidateSet("dev", "test")][string]$Split = "dev",
    [switch]$ConfirmTest
)

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$dockerExitCode = 0
Push-Location $repositoryRoot
try {
    $arguments = @(
        "compose", "exec", "-T", "ocr", "python", "-m", "eval.run",
        "--engine", $Engine,
        "--preprocess", "configs/$Preset.json",
        "--split", $Split,
        "--label", $Label
    )
    if ($ConfirmTest) {
        $arguments += "--confirm-test"
    }

    & docker @arguments
    $dockerExitCode = $LASTEXITCODE
}
finally {
    Pop-Location
}
exit $dockerExitCode
