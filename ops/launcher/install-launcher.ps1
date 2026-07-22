# Installs the always-on Admiralty Board launcher on this PC: a chromeless Edge
# app-window shortcut on the Desktop AND in the Startup folder (so it opens on
# login), pointed at the EVO Board over Tailscale.
#
# Stable target via MagicDNS: james-nucbox-evo-x2:8099 (-> 100.90.66.54). The
# EVO's tailscaled is enabled and evo-admin is restart-always, so the Board is
# there whenever the tailnet is up. Re-run any time to refresh the shortcuts.
param(
  [string]$Url = "http://james-nucbox-evo-x2:8099",
  [string]$Name = "The Admiralty Board"
)
$ErrorActionPreference = "Stop"

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
if (-not (Test-Path $edge)) { throw "Microsoft Edge not found — edit `$edge in this script." }

# a dedicated profile keeps the board its own window, independent of your normal Edge
$dataDir = Join-Path $env:LOCALAPPDATA "SteadsBoard"
$arguments = "--app=$Url --user-data-dir=`"$dataDir`" --window-size=1500,950 --no-first-run --no-default-browser-check"

$ws = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Startup'))) {
  $lnk = Join-Path $dir "$Name.lnk"
  $sc = $ws.CreateShortcut($lnk)
  $sc.TargetPath = $edge
  $sc.Arguments = $arguments
  $sc.IconLocation = "$edge,0"
  $sc.Description = "The Admiralty Board - the Steads ops dashboard (Tailscale)"
  $sc.Save()
  Write-Output "created: $lnk"
}
Write-Output "done - opens on login; double-click the Desktop shortcut to open now."
