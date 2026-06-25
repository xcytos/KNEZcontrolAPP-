# Test PostgreSQL Connection for knez-control-app
# Tests Supabase connection and document loading

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PostgreSQL Connection Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$PG_HOST = "db.sspsljqdhesqezrmspcj.supabase.co"
$PG_PORT = 5432
$PG_DB = "postgres"
$PG_USER = "postgres"
$PG_PASSWORD = "TAQWIN!@#777"

Write-Host "Connection Details:" -ForegroundColor Yellow
Write-Host "  Host: $PG_HOST" -ForegroundColor Gray
Write-Host "  Port: $PG_PORT" -ForegroundColor Gray
Write-Host "  Database: $PG_DB" -ForegroundColor Gray
Write-Host "  User: $PG_USER" -ForegroundColor Gray
Write-Host ""

# Test 1: Check if psql is installed
Write-Host "[Test 1] Checking psql installation..." -ForegroundColor Yellow
try {
    $psqlVersion = psql --version 2>&1
    Write-Host "  ✓ psql found: $psqlVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ psql not found. Install PostgreSQL client tools:" -ForegroundColor Red
    Write-Host "    https://www.postgresql.org/download/windows/" -ForegroundColor Gray
    exit 1
}
Write-Host ""

# Test 2: Test connection
Write-Host "[Test 2] Testing connection..." -ForegroundColor Yellow
$env:PGPASSWORD = $PG_PASSWORD
try {
    $result = psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB -t -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Connection successful" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Connection failed" -ForegroundColor Red
        Write-Host "  Error: $result" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ✗ Connection error: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Check tables
Write-Host "[Test 3] Checking tables..." -ForegroundColor Yellow
$tables = psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Tables found:" -ForegroundColor Green
    $tables | ForEach-Object { Write-Host "    - $($_.Trim())" -ForegroundColor Gray }
} else {
    Write-Host "  ✗ Failed to list tables" -ForegroundColor Red
    Write-Host "  Error: $tables" -ForegroundColor Red
}
Write-Host ""

# Test 4: Count documents
Write-Host "[Test 4] Counting documents..." -ForegroundColor Yellow
$docCount = psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB -t -c "SELECT COUNT(*) FROM documents" 2>&1
if ($LASTEXITCODE -eq 0) {
    $count = $docCount.Trim()
    Write-Host "  ✓ Total documents: $count" -ForegroundColor Green
} else {
    Write-Host "  ✗ Failed to count documents" -ForegroundColor Red
    Write-Host "  Error: $docCount" -ForegroundColor Red
}
Write-Host ""

# Test 5: Documents by session
Write-Host "[Test 5] Documents by session..." -ForegroundColor Yellow
$sessionDocs = psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB -t -c "SELECT session_id, COUNT(*) FROM documents GROUP BY session_id ORDER BY COUNT(*) DESC LIMIT 5" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Top sessions:" -ForegroundColor Green
    $sessionDocs | ForEach-Object { 
        $line = $_.Trim()
        if ($line) {
            Write-Host "    $line" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ✗ Failed to query sessions" -ForegroundColor Red
}
Write-Host ""

# Test 6: CA009 documents
Write-Host "[Test 6] CA009 session documents..." -ForegroundColor Yellow
$ca009Docs = psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB -t -c "SELECT title FROM documents WHERE session_id = '196bb472-848f-43df-aadb-ec39b81cc410'" 2>&1
if ($LASTEXITCODE -eq 0) {
    $count = ($ca009Docs | Where-Object { $_.Trim() }).Count
    Write-Host "  ✓ CA009 documents: $count" -ForegroundColor Green
    $ca009Docs | ForEach-Object {
        $title = $_.Trim()
        if ($title) {
            Write-Host "    - $title" -ForegroundColor Gray
        }
    }
} else {
    Write-Host "  ✗ Failed to query CA009 documents" -ForegroundColor Red
}
Write-Host ""

# Test 7: Check tags column (TEXT[] handling)
Write-Host "[Test 7] Testing tags column..." -ForegroundColor Yellow
$tagsTest = psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $PG_DB -t -c "SELECT data_type FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'tags'" 2>&1
if ($LASTEXITCODE -eq 0) {
    $dataType = $tagsTest.Trim()
    Write-Host "  ✓ Tags column type: $dataType" -ForegroundColor Green
    if ($dataType -eq "ARRAY") {
        Write-Host "    ✓ Correct: TEXT[] array type" -ForegroundColor Green
    } else {
        Write-Host "    ⚠ Unexpected type (expected ARRAY)" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ✗ Failed to check tags column" -ForegroundColor Red
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$env:PGPASSWORD = $null
