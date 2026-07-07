Write-Host "========================================"
Write-Host " LearnPath AI - 智能学习路径规划"
Write-Host "========================================"
Write-Host ""
Write-Host "正在启动服务器..."
$process = Start-Process -FilePath "C:\Users\陆以恒\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" -ArgumentList "D:\ai_creation2\learnpath-ai\server.py 8080" -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 3
if (!$process.HasExited) {
    Write-Host "服务器已启动！PID: $($process.Id)"
    Write-Host "请在浏览器中打开: http://localhost:8080"
    Write-Host ""
    Write-Host "按 Ctrl+C 关闭服务器"
    $process.WaitForExit()
} else {
    Write-Host "服务器启动失败"
}
