@echo off
REM ================================================
REM game-system-designer 技能安装脚本 (Windows)
REM ================================================

echo ==========================================
echo  游戏系统策划技能 - Windows 安装脚本
echo ==========================================

REM 1. 确定安装目录
set INSTALL_DIR=%USERPROFILE%\.qoderwork\skills\game-system-designer

echo [INFO] 安装目录: %INSTALL_DIR%

REM 2. 创建目录
if not exist "%INSTALL_DIR%\scripts" mkdir "%INSTALL_DIR%\scripts"

REM 3. 复制文件
copy /Y "%~dp0SKILL.md" "%INSTALL_DIR%\"
copy /Y "%~dp0data-format.md" "%INSTALL_DIR%\"
copy /Y "%~dp0scripts\analyze_ui.py" "%INSTALL_DIR%\scripts\"
copy /Y "%~dp0scripts\generate_wireframe.py" "%INSTALL_DIR%\scripts\"
copy /Y "%~dp0scripts\export_docx.js" "%INSTALL_DIR%\scripts\"
copy /Y "%~dp0scripts\export_xlsx.py" "%INSTALL_DIR%\scripts\"
copy /Y "%~dp0scripts\package.json" "%INSTALL_DIR%\scripts\"
copy /Y "%~dp0requirements.txt" "%INSTALL_DIR%\"

echo [OK] 技能文件已复制

REM 4. 安装 Python 依赖
echo [INFO] 安装 Python 依赖...
pip install requests Pillow openpyxl 2>nul || (
    echo [WARN] Python 依赖安装失败，请手动: pip install requests Pillow openpyxl
)

REM 5. 安装 Node 依赖
echo [INFO] 安装 Node 依赖...
cd /d "%INSTALL_DIR%\scripts"
npm install 2>nul || (
    echo [WARN] npm 依赖安装失败，请手动: npm install docx
)

echo.
echo ==========================================
echo  安装完成！
echo  技能路径: %INSTALL_DIR%
echo ==========================================
echo.
echo 注意: 视觉分析功能需配置 DashScope API Key
echo   set DASHSCOPE_API_KEY=sk-your-key-here
echo.

pause
