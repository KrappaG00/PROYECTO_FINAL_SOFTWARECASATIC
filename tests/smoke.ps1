# Prueba de humo de extremo a extremo. Uso (con la API en marcha):
#   powershell -File tests/smoke.ps1 -Base http://localhost:5080
param([string]$Base = "http://localhost:5080")
Add-Type -AssemblyName System.Drawing
$h = @{ "Content-Type" = "application/json" }
$fallos = 0
function Check($nombre, $ok, $detalle) {
    if ($ok) { Write-Host "[OK]    $nombre  $detalle" -ForegroundColor Green }
    else { Write-Host "[FALLO] $nombre  $detalle" -ForegroundColor Red; $script:fallos++ }
}
function NuevaImagen([int]$semilla) {
    $bmp = New-Object System.Drawing.Bitmap 200, 200
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $rnd = New-Object Random $semilla
    $g.Clear([System.Drawing.Color]::FromArgb($rnd.Next(60,200), $rnd.Next(60,200), $rnd.Next(60,200)))
    for ($i = 0; $i -lt 40; $i++) {
        $c = [System.Drawing.Color]::FromArgb($rnd.Next(256), $rnd.Next(256), $rnd.Next(256))
        $br = New-Object System.Drawing.SolidBrush $c
        $g.FillEllipse($br, $rnd.Next(0,160), $rnd.Next(0,160), $rnd.Next(10,80), $rnd.Next(10,80))
    }
    $ms = New-Object IO.MemoryStream
    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | ? { $_.MimeType -eq "image/jpeg" }
    $p = New-Object System.Drawing.Imaging.EncoderParameters 1
    $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 100L
    $bmp.Save($ms, $enc, $p)
    "data:image/jpeg;base64," + [Convert]::ToBase64String($ms.ToArray())
}
function Flujo($imgDoc, $imgVivo, $estatico, $nombre) {
    $c = Invoke-RestMethod "$Base/api/verification/create" -Method Post -Headers $h -Body (@{nombrePersona=$nombre;numeroDocumento="05123456-7";tipoDocumento="DUI";aceptaConsentimiento=$true} | ConvertTo-Json)
    Invoke-RestMethod "$Base/api/verification/upload-document" -Method Post -Headers $h -Body (@{codigoSolicitud=$c.codigoSolicitud;imagenDocumentoBase64=$imgDoc;tipoDocumento="DUI";numeroDocumento="05123456-7"} | ConvertTo-Json) | Out-Null
    $r = Invoke-RestMethod "$Base/api/liveness/challenges/$($c.codigoSolicitud)"
    $resp = @($r.retosAsignados | % { @{retoId=$_.id;codigoReto=$_.codigoReto;cumplido=$true;scoreCumplimiento=1.0} })
    $body = @{codigoSolicitud=$c.codigoSolicitud;rostroCapturadoBase64=$imgVivo;respuestasRetos=$resp;scoreLivenessFrontend=0.9;estaticoDetectado=$estatico;duracionSegundos=20} | ConvertTo-Json -Depth 5
    Invoke-RestMethod "$Base/api/verification/submit-attempt" -Method Post -Headers $h -Body $body
}

$a = NuevaImagen 1; $b = NuevaImagen 2

$n = (Invoke-RestMethod "$Base/api/liveness/challenges/$((Invoke-RestMethod "$Base/api/verification/create" -Method Post -Headers $h -Body (@{nombrePersona="x";numeroDocumento="1";aceptaConsentimiento=$true} | ConvertTo-Json)).codigoSolicitud)").retosAsignados.Count
Check "Retos aleatorios 2-3" ($n -ge 2 -and $n -le 3) "($n retos)"

$s = Flujo $a $a $false "Caso Positivo"
Check "Misma imagen => APROBADO" ($s.estado -eq "APROBADO") "estado=$($s.estado) sim=$($s.scoreSimilitudFacial)"

$s = Flujo $a $b $false "Caso Distinto"
Check "Imagen distinta => no aprobado" ($s.estado -ne "APROBADO") "estado=$($s.estado) sim=$($s.scoreSimilitudFacial)"

$s = Flujo $a $a $true "Caso Foto Estatica"
Check "Imagen estática => RECHAZADO por fraude" ($s.estado -eq "RECHAZADO" -and $s.esSospechaFraude) "estado=$($s.estado)"

try { Invoke-RestMethod "$Base/api/verification/create" -Method Post -Headers $h -Body (@{nombrePersona="x";numeroDocumento="1";aceptaConsentimiento=$false} | ConvertTo-Json) | Out-Null; Check "Sin consentimiento rechazado" $false "" }
catch { Check "Sin consentimiento rechazado" ($_.Exception.Response.StatusCode.value__ -eq 400) "" }

try { Invoke-RestMethod "$Base/api/admin/users" | Out-Null; Check "Admin sin token bloqueado" $false "" }
catch { Check "Admin sin token bloqueado" ($_.Exception.Response.StatusCode.value__ -eq 401) "" }

try { Invoke-RestMethod "$Base/api/auth/login" -Method Post -Headers $h -Body (@{email="admin@ugb.edu.sv";password="mala"} | ConvertTo-Json) | Out-Null; Check "Login inválido rechazado" $false "" }
catch { Check "Login inválido rechazado" ($_.Exception.Response.StatusCode.value__ -eq 401) "" }

$l = Invoke-RestMethod "$Base/api/auth/login" -Method Post -Headers $h -Body (@{email="admin@ugb.edu.sv";password="Admin@2026!"} | ConvertTo-Json)
Check "Login válido entrega JWT" ($l.exito -and $l.token) "rol=$($l.rol)"
$auth = @{ Authorization = "Bearer $($l.token)" }
$m = Invoke-RestMethod "$Base/api/reports/metrics" -Headers $auth
Check "Métricas con token" ($m.totalSolicitudes -ge 4) "total=$($m.totalSolicitudes) aprobadas=$($m.solicitudesAprobadas)"
$logs = Invoke-RestMethod "$Base/api/reports/audit-logs?limite=5" -Headers $auth
Check "Auditoría con hash encadenado" ($logs.Count -gt 0 -and $logs[0].hashIntegridad.Length -eq 64) "$($logs.Count) registros"
Check "Frontend servido en /" ((Invoke-WebRequest "$Base/" -UseBasicParsing).Content -match "Pruebas de Vida") ""

Write-Host "`nFallos: $fallos"
exit $fallos
