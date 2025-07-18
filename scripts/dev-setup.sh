#!/bin/bash

# Script para configurar e iniciar o ambiente de desenvolvimento
# Binary Hub - Setup de Desenvolvimento

echo "🚀 Configurando ambiente de desenvolvimento do Binary Hub..."

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ] && [ ! -f "firebase.json" ]; then
    echo "❌ Execute este script a partir da raiz do projeto"
    exit 1
fi

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para instalar dependências com tratamento de erros
install_dependencies() {
    local dir=$1
    local name=$2
    
    echo -e "${YELLOW}📦 Instalando dependências do $name...${NC}"
    
    if [ -d "$dir" ]; then
        cd "$dir"
        
        # Corrigir vulnerabilidades automaticamente
        npm audit fix --force 2>/dev/null || true
        
        # Instalar dependências
        npm install
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Dependências do $name instaladas com sucesso${NC}"
        else
            echo -e "${RED}❌ Erro ao instalar dependências do $name${NC}"
            exit 1
        fi
        
        cd ..
    else
        echo -e "${RED}❌ Diretório $dir não encontrado${NC}"
        exit 1
    fi
}

# Navegar para o diretório do projeto
PROJECT_ROOT=$(pwd)

# Instalar dependências do frontend
install_dependencies "app" "frontend"

# Instalar dependências das functions
install_dependencies "functions" "Firebase Functions"

# Verificar se Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo -e "${RED}❌ Firebase CLI não encontrado. Instalando...${NC}"
    npm install -g firebase-tools
fi

echo -e "${GREEN}✅ Setup concluído com sucesso!${NC}"
echo ""
echo "🔧 Comandos disponíveis:"
echo "  • Para iniciar emuladores: npm run dev:emulator"
echo "  • Para iniciar frontend: npm run dev:frontend"
echo "  • Para iniciar tudo: npm run dev"
echo ""
echo "📍 URLs dos serviços:"
echo "  • Frontend: http://localhost:3000"
echo "  • Firebase UI: http://localhost:4000"
echo "  • Firestore: http://localhost:8080"
echo "  • Auth: http://localhost:9099"
echo "" 