@echo off
echo =========================================
echo Setting up AuraSync LM Environment
echo =========================================

echo [1/4] Checking for Ollama...
curl -s http://127.0.0.1:11434 >nul
if %errorlevel% neq 0 (
    echo Ollama is not running or not installed.
    echo Downloading Ollama installer (Windows)...
    curl -L "https://ollama.com/download/OllamaSetup.exe" -o "%TEMP%\OllamaSetup.exe"
    echo Installing Ollama silently (this might take a moment)...
    start /wait "" "%TEMP%\OllamaSetup.exe" /SILENT
    echo Ollama installation finished!
) else (
    echo Ollama is already installed and running.
)

echo [2/4] Downloading AI Model (Llama 3)...
echo (This is required for the chatbot and may take a while to download)
ollama pull llama3

echo [3/4] Installing Backend Dependencies...
cd backend
pip install -r requirements.txt
cd ..

echo [4/4] Installing Frontend Dependencies...
cd frontend
npm install
cd ..

echo =========================================
echo Setup Complete! 
echo You can now start the application.
echo =========================================
pause
