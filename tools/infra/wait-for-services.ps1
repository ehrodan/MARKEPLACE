$ErrorActionPreference = 'Stop'

$expected = @('midas-local-postgres-1', 'midas-local-valkey-1', 'midas-local-nats-1', 'midas-local-minio-1', 'midas-local-mailpit-1')
$deadline = (Get-Date).AddMinutes(3)

do {
  $containers = podman ps --format json | ConvertFrom-Json
  $byName = @{}
  foreach ($container in $containers) {
    $name = if ($container.Names -is [array]) { $container.Names[0] } else { $container.Names }
    $byName[$name] = $container
  }

  $pending = @()
  foreach ($name in $expected) {
    if (-not $byName.ContainsKey($name)) {
      $pending += "$name (ausente)"
      continue
    }

    $state = podman inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $name
    if ($state -notin @('healthy', 'running')) {
      $pending += "$name ($state)"
    }
  }

  if ($pending.Count -eq 0) {
    Write-Output 'Infraestrutura MIDAS pronta: todos os serviços estão saudáveis.'
    exit 0
  }

  if ((Get-Date) -ge $deadline) {
    throw "Timeout aguardando: $($pending -join ', ')"
  }

  Start-Sleep -Seconds 2
} while ($true)

