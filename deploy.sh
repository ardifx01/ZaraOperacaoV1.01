#!/bin/bash

# ===========================================
# SCRIPT DE DEPLOY AUTOMATIZADO - SISTEMA ZARA
# ===========================================

set -e  # Parar execução em caso de erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker não está instalado. Por favor, instale o Docker primeiro."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
        exit 1
    fi
    
    log_success "Docker e Docker Compose encontrados."
}

# Verificar arquivos necessários
check_files() {
    local files=("docker-compose.yml" "server/Dockerfile" "frontend/Dockerfile" "server/.env")
    
    for file in "${files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Arquivo necessário não encontrado: $file"
            exit 1
        fi
    done
    
    log_success "Todos os arquivos necessários encontrados."
}

# Configurar variáveis de ambiente
setup_env() {
    log "Configurando variáveis de ambiente..."
    
    # Verificar se .env existe no servidor
    if [[ ! -f "server/.env" ]]; then
        log_warning "Arquivo .env não encontrado no servidor. Copiando do exemplo..."
        cp server/.env.example server/.env
        log_warning "IMPORTANTE: Configure as variáveis em server/.env antes de continuar!"
        read -p "Pressione Enter após configurar o arquivo .env..."
    fi
    
    # Verificar se .env.production existe no frontend
    if [[ ! -f "frontend/.env.production" ]]; then
        log_warning "Arquivo .env.production não encontrado no frontend."
        log "Criando arquivo .env.production com configurações padrão..."
        
        cat > frontend/.env.production << EOF
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_APP_NAME=Sistema ZARA
VITE_APP_VERSION=1.0.1
NODE_ENV=production
VITE_BUILD_MODE=production
EOF
        
        log_success "Arquivo .env.production criado. Configure as URLs de produção se necessário."
    fi
}

# Build das imagens Docker
build_images() {
    log "Construindo imagens Docker..."
    
    # Parar containers existentes
    docker-compose down 2>/dev/null || true
    
    # Build das imagens
    docker-compose build --no-cache
    
    log_success "Imagens Docker construídas com sucesso."
}

# Executar migrações do banco
run_migrations() {
    log "Executando migrações do banco de dados..."
    
    # Verificar se é primeira execução
    if [[ ! -f "server/prisma/dev.db" ]]; then
        log "Primeira execução detectada. Gerando banco de dados..."
        cd server
        npx prisma generate
        npx prisma db push
        npx prisma db seed 2>/dev/null || log_warning "Seed não executado (normal se não configurado)"
        cd ..
    else
        log "Banco existente encontrado. Aplicando migrações..."
        cd server
        npx prisma generate
        npx prisma db push
        cd ..
    fi
    
    log_success "Migrações executadas com sucesso."
}

# Iniciar aplicação
start_application() {
    log "Iniciando aplicação..."
    
    # Iniciar com docker-compose
    docker-compose up -d
    
    # Aguardar containers iniciarem
    log "Aguardando containers iniciarem..."
    sleep 10
    
    # Verificar status dos containers
    if docker-compose ps | grep -q "Up"; then
        log_success "Aplicação iniciada com sucesso!"
        
        echo ""
        echo "==========================================="
        echo "🚀 DEPLOY CONCLUÍDO COM SUCESSO!"
        echo "==========================================="
        echo "Frontend: http://localhost:80"
        echo "Backend API: http://localhost:5000"
        echo "Prisma Studio: Execute 'npm run prisma:studio' no diretório server"
        echo ""
        echo "Para parar a aplicação: docker-compose down"
        echo "Para ver logs: docker-compose logs -f"
        echo "==========================================="
    else
        log_error "Falha ao iniciar alguns containers. Verifique os logs:"
        docker-compose logs
        exit 1
    fi
}

# Função de limpeza
cleanup() {
    log "Limpando recursos não utilizados..."
    docker system prune -f
    log_success "Limpeza concluída."
}

# Menu principal
show_menu() {
    echo ""
    echo "==========================================="
    echo "🚀 DEPLOY AUTOMATIZADO - SISTEMA ZARA"
    echo "==========================================="
    echo "1. Deploy completo (recomendado)"
    echo "2. Apenas build das imagens"
    echo "3. Apenas iniciar aplicação"
    echo "4. Parar aplicação"
    echo "5. Ver logs da aplicação"
    echo "6. Limpeza do sistema"
    echo "7. Sair"
    echo "==========================================="
    read -p "Escolha uma opção (1-7): " choice
}

# Função principal
main() {
    case $1 in
        "full")
            log "Iniciando deploy completo..."
            check_docker
            check_files
            setup_env
            run_migrations
            build_images
            start_application
            ;;
        "build")
            log "Construindo imagens..."
            check_docker
            check_files
            build_images
            ;;
        "start")
            log "Iniciando aplicação..."
            check_docker
            start_application
            ;;
        "stop")
            log "Parando aplicação..."
            docker-compose down
            log_success "Aplicação parada."
            ;;
        "logs")
            log "Exibindo logs da aplicação..."
            docker-compose logs -f
            ;;
        "clean")
            cleanup
            ;;
        *)
            show_menu
            case $choice in
                1)
                    main "full"
                    ;;
                2)
                    main "build"
                    ;;
                3)
                    main "start"
                    ;;
                4)
                    main "stop"
                    ;;
                5)
                    main "logs"
                    ;;
                6)
                    main "clean"
                    ;;
                7)
                    log "Saindo..."
                    exit 0
                    ;;
                *)
                    log_error "Opção inválida!"
                    main
                    ;;
            esac
            ;;
    esac
}

# Executar função principal
main "$@"