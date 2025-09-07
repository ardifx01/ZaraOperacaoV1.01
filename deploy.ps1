# ===========================================
# SCRIPT DE DEPLOY AUTOMATIZADO - SISTEMA ZARA (Windows)
# ===========================================

# Configurações
$ErrorActionPreference = "Stop"

# Cores para output
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Log($message) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-ColorOutput Blue "[$timestamp] $message"
}

function Log-Success($message) {
    Write-ColorOutput Green "[SUCCESS] $message"
}

function Log-Warning($message) {
    Write-ColorOutput Yellow "[WARNING] $message"
}

function Log-Error($message) {
    Write-ColorOutput Red "[ERROR] $message"
}

# Verificar se Docker está instalado
function Check-Docker {
    try {
        $dockerVersion = docker --version 2>$null
        $composeVersion = docker-compose --version 2>$null
        
        if (-not $dockerVersion) {
            Log-Error "Docker não está instalado. Por favor, instale o Docker Desktop primeiro."
            exit 1
        }
        
        if (-not $composeVersion) {
            Log-Error "Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
            exit 1
        }
        
        Log-Success "Docker e Docker Compose encontrados."
    }
    catch {
        Log-Error "Erro ao verificar Docker: $($_.Exception.Message)"
        exit 1
    }
}

# Verificar arquivos necessários
function Check-Files {
    $files = @("docker-compose.yml", "server\Dockerfile", "frontend\Dockerfile")
    
    foreach ($file in $files) {
        if (-not (Test-Path $file)) {
            Log-Error "Arquivo necessário não encontrado: $file"
            exit 1
        }
    }
    
    Log-Success "Todos os arquivos necessários encontrados."
}

# Configurar variáveis de ambiente
function Setup-Env {
    Log "Configurando variáveis de ambiente..."
    
    # Verificar se .env existe no servidor
    if (-not (Test-Path "server\.env")) {
        Log-Warning "Arquivo .env não encontrado no servidor. Copiando do exemplo..."
        Copy-Item "server\.env.example" "server\.env"
        Log-Warning "IMPORTANTE: Configure as variáveis em server\.env antes de continuar!"
        Read-Host "Pressione Enter após configurar o arquivo .env"
    }
    
    # Verificar se .env.production existe no frontend
    if (-not (Test-Path "frontend\.env.production")) {
        Log-Warning "Arquivo .env.production não encontrado no frontend."
        Log "Criando arquivo .env.production com configurações padrão..."
        
        $envContent = @"
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_APP_NAME=Sistema ZARA
VITE_APP_VERSION=1.0.1
NODE_ENV=production
VITE_BUILD_MODE=production
"@
        
        $envContent | Out-File -FilePath "frontend\.env.production" -Encoding UTF8
        Log-Success "Arquivo .env.production criado. Configure as URLs de produção se necessário."
    }
}

# Build das imagens Docker
function Build-Images {
    Log "Construindo imagens Docker..."
    
    try {
        # Parar containers existentes
        docker-compose down 2>$null
        
        # Build das imagens
        docker-compose build --no-cache
        
        Log-Success "Imagens Docker construídas com sucesso."
    }
    catch {
        Log-Error "Erro ao construir imagens: $($_.Exception.Message)"
        exit 1
    }
}

# Executar migrações do banco
function Run-Migrations {
    Log "Executando migrações do banco de dados..."
    
    try {
        # Verificar se é primeira execução
        if (-not (Test-Path "server\prisma\dev.db")) {
            Log "Primeira execução detectada. Gerando banco de dados..."
            Set-Location "server"
            npx prisma generate
            npx prisma db push
            try {
                npx prisma db seed
            }
            catch {
                Log-Warning "Seed não executado (normal se não configurado)"
            }
            Set-Location ".."
        }
        else {
            Log "Banco existente encontrado. Aplicando migrações..."
            Set-Location "server"
            npx prisma generate
            npx prisma db push
            Set-Location ".."
        }
        
        Log-Success "Migrações executadas com sucesso."
    }
    catch {
        Log-Error "Erro ao executar migrações: $($_.Exception.Message)"
        Set-Location ".."
        exit 1
    }
}

# Iniciar aplicação
function Start-Application {
    Log "Iniciando aplicação..."
    
    try {
        # Iniciar com docker-compose
        docker-compose up -d
        
        # Aguardar containers iniciarem
        Log "Aguardando containers iniciarem..."
        Start-Sleep -Seconds 10
        
        # Verificar status dos containers
        $status = docker-compose ps
        if ($status -match "Up") {
            Log-Success "Aplicação iniciada com sucesso!"
            
            Write-Host ""
            Write-Host "=========================================" -ForegroundColor Green
            Write-Host "🚀 DEPLOY CONCLUÍDO COM SUCESSO!" -ForegroundColor Green
            Write-Host "=========================================" -ForegroundColor Green
            Write-Host "Frontend: http://localhost:80" -ForegroundColor Cyan
            Write-Host "Backend API: http://localhost:5000" -ForegroundColor Cyan
            Write-Host "Prisma Studio: Execute 'npm run prisma:studio' no diretório server" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Para parar a aplicação: docker-compose down" -ForegroundColor Yellow
            Write-Host "Para ver logs: docker-compose logs -f" -ForegroundColor Yellow
            Write-Host "=========================================" -ForegroundColor Green
        }
        else {
            Log-Error "Falha ao iniciar alguns containers. Verifique os logs:"
            docker-compose logs
            exit 1
        }
    }
    catch {
        Log-Error "Erro ao iniciar aplicação: $($_.Exception.Message)"
        exit 1
    }
}

# Função de limpeza
function Cleanup {
    Log "Limpando recursos não utilizados..."
    docker system prune -f
    Log-Success "Limpeza concluída."
}

# Menu principal
function Show-Menu {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Blue
    Write-Host "🚀 DEPLOY AUTOMATIZADO - SISTEMA ZARA" -ForegroundColor Blue
    Write-Host "=========================================" -ForegroundColor Blue
    Write-Host "1. Deploy completo (recomendado)" -ForegroundColor White
    Write-Host "2. Apenas build das imagens" -ForegroundColor White
    Write-Host "3. Apenas iniciar aplicação" -ForegroundColor White
    Write-Host "4. Parar aplicação" -ForegroundColor White
    Write-Host "5. Ver logs da aplicação" -ForegroundColor White
    Write-Host "6. Limpeza do sistema" -ForegroundColor White
    Write-Host "7. Sair" -ForegroundColor White
    Write-Host "=========================================" -ForegroundColor Blue
    $choice = Read-Host "Escolha uma opção (1-7)"
    return $choice
}

# Função principal
function Main {
    param(
        [string]$Action
    )
    
    switch ($Action) {
        "full" {
            Log "Iniciando deploy completo..."
            Check-Docker
            Check-Files
            Setup-Env
            Run-Migrations
            Build-Images
            Start-Application
        }
        "build" {
            Log "Construindo imagens..."
            Check-Docker
            Check-Files
            Build-Images
        }
        "start" {
            Log "Iniciando aplicação..."
            Check-Docker
            Start-Application
        }
        "stop" {
            Log "Parando aplicação..."
            docker-compose down
            Log-Success "Aplicação parada."
        }
        "logs" {
            Log "Exibindo logs da aplicação..."
            docker-compose logs -f
        }
        "clean" {
            Cleanup
        }
        default {
            $choice = Show-Menu
            switch ($choice) {
                "1" { Main "full" }
                "2" { Main "build" }
                "3" { Main "start" }
                "4" { Main "stop" }
                "5" { Main "logs" }
                "6" { Main "clean" }
                "7" { 
                    Log "Saindo..."
                    exit 0
                }
                default {
                    Log-Error "Opção inválida!"
                    Main
                }
            }
        }
    }
}

# Executar função principal
if ($args.Count -gt 0) {
    Main $args[0]
} else {
    Main
}