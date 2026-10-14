# say.ps1 -- record every word in words.txt with a Windows voice, one WAV each,
# ready for build.py. Run from anywhere:
#   powershell -ExecutionPolicy Bypass -File tools/voice/say.ps1 -Out <dir> [-Voice "Microsoft David Desktop"] [-Rate -1]
param(
  [Parameter(Mandatory=$true)][string]$Out,
  [string]$Voice = "Microsoft David Desktop",
  [int]$Rate = -1
)
Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force $Out | Out-Null
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice($Voice)
$s.Rate = $Rate
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$words = Join-Path $PSScriptRoot "words.txt"
$n = 0
foreach ($line in Get-Content -Encoding UTF8 $words) {
  if ($line -match '^\s*(#|$)') { continue }
  $parts = $line.Split('|', 3)
  $key = $parts[0].Trim(); $text = $parts[1].Trim()
  $s.Rate = if ($parts.Length -gt 2) { [int]$parts[2].Trim() } else { $Rate }
  $s.SetOutputToWaveFile((Join-Path $Out ($key + ".wav")), $fmt)
  if ($text.StartsWith("ipa:", [StringComparison]::Ordinal)) {   # ordinal: the stress mark trips a culture-aware compare
    $ipa = $text.Substring(4)
    $s.SpeakSsml('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><phoneme alphabet="ipa" ph="' + $ipa + '">' + $key + '</phoneme></speak>')
  } else {
    $s.Speak($text)
  }
  $n++
}
$s.SetOutputToNull()
Write-Output "recorded $n words with $Voice into $Out"
