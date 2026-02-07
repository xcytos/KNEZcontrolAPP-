# verify-delivery.ps1
# Verifies KNEZ delivery behavior (Success or Graceful Failure)

$KnezUrl = "http://127.0.0.1:8000"
$Prompt = @{
    model = "local"
    messages = @(
        @{ role = "user"; content = "Test prompt for verification" }
    )
    stream = $true
}
$JsonPayload = $Prompt | ConvertTo-Json -Depth 5

Write-Host "Sending test request to KNEZ..." -ForegroundColor Cyan

try {
    # We use Invoke-WebRequest to handle the stream or error
    $Response = Invoke-WebRequest -UseBasicParsing -Proxy $null -Uri "$KnezUrl/v1/chat/completions" -Method Post -Body $JsonPayload -ContentType "application/json" -ErrorAction Stop
    
    # If we get here, we got a 200 OK (likely streaming started)
    Write-Host "Response received. Status: $($Response.StatusCode)" -ForegroundColor Green
    Write-Host "Content (first 100 chars): $($Response.Content.Substring(0, [Math]::Min($Response.Content.Length, 100)))"
    
    # In a real streaming scenario with Invoke-WebRequest, it might buffer.
    # But for verification, getting a 200 OK means the backend accepted it.
    
    exit 0
} catch {
    $Ex = $_.Exception
    if ($Ex.Response) {
        $StatusCode = $Ex.Response.StatusCode
        Write-Host "Request failed with status: $StatusCode" -ForegroundColor Yellow
        
        # Check if it's a handled backend failure (e.g., 500/503 due to Ollama down)
        if ($StatusCode -eq 500 -or $StatusCode -eq 503) {
            Write-Host "This is an ACCEPTABLE failure if Ollama is unreachable." -ForegroundColor Green
            Write-Host "Verified: KNEZ did not hang, but reported error."
            exit 0
        } else {
            Write-Error "Unexpected failure status: $StatusCode"
            exit 1
        }
    } else {
        Write-Error "Connection failed: $($Ex.Message)"
        exit 1
    }
}
