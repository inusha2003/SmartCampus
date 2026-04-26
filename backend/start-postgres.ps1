$ErrorActionPreference = "Stop"

# Ensure Maven is available for this shell session.
if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
  $mavenBin = $null
  if ($env:MAVEN_HOME -and (Test-Path (Join-Path $env:MAVEN_HOME "bin\mvn.cmd"))) {
    $mavenBin = (Join-Path $env:MAVEN_HOME "bin")
  }
  if (-not $mavenBin) {
    $defaultMavenHome = "C:\apache-maven\apache-maven-3.9.15"
    if (Test-Path "$defaultMavenHome\bin\mvn.cmd") {
      $env:MAVEN_HOME = $defaultMavenHome
      $mavenBin = "$defaultMavenHome\bin"
    }
  }
  if ($mavenBin) {
    $env:Path = "$mavenBin;$env:Path"
  } else {
    throw "Maven not found. Add Maven to PATH, set MAVEN_HOME to your Maven install (with bin\mvn.cmd under it), or update start-postgres.ps1 with your Maven path."
  }
}

# Load project env variables from a dotenv-style file into the current session.
$envFile = @('.\.env.postgres.local', '.\.env.postgres') | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $envFile) {
  throw "No env file found. Create .env.postgres.local or .env.postgres in backend/."
}

Write-Host "Loading env from: $envFile"
Get-Content $envFile | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) {
    return
  }
  $parts = $line -split '=', 2
  if ($parts.Count -ne 2) {
    return
  }
  $name = $parts[0].Trim()
  $value = $parts[1].Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  Set-Item -Path "Env:$name" -Value $value
}

if (-not $env:SPRING_PROFILES_ACTIVE) {
  $env:SPRING_PROFILES_ACTIVE = "postgres,dev"
}

if (-not $env:SERVER_PORT) {
  # Must match frontend/.env.development VITE_DEV_PROXY_TARGET (Vite defaults to http://localhost:8080).
  $env:SERVER_PORT = "8080"
}

Write-Host "Using profile: $env:SPRING_PROFILES_ACTIVE"
Write-Host "Using port: $env:SERVER_PORT"
Write-Host "Database URL: $env:DATABASE_URL"
Write-Host "Frontend dev: set VITE_DEV_PROXY_TARGET=http://localhost:$($env:SERVER_PORT) in frontend/.env.development (or change SERVER_PORT here)."

# Stop anything already listening on the API port.
Get-NetTCPConnection -LocalPort ([int]$env:SERVER_PORT) -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }

# Start backend with explicit profile + port in a PowerShell-safe format.
mvn spring-boot:run `
  "-Dspring-boot.run.profiles=$env:SPRING_PROFILES_ACTIVE" `
  "-Dspring-boot.run.arguments=--server.port=$env:SERVER_PORT"
