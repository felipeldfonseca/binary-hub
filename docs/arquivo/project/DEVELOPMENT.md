# 🚀 Guia de Desenvolvimento - Binary Hub

## Pré-requisitos

- Node.js versão 18 ou superior
- Firebase CLI instalado globalmente
- Git configurado

## Configuração Inicial

### 1. Instalar Firebase CLI (se não estiver instalado)
```bash
npm install -g firebase-tools
```

### 2. Fazer login no Firebase
```bash
firebase login
```

### 3. Configurar o projeto
```bash
# Na raiz do projeto
npm install

# Instalar dependências do frontend
cd app
npm install
npm audit fix --force
cd ..

# Instalar dependências das functions
cd functions
npm install
npm audit fix --force
cd ..
```

## Executar o Projeto

### Opção 1: Executar tudo automaticamente
```bash
# Na raiz do projeto
npm run dev
```

### Opção 2: Executar separadamente

#### Terminal 1 - Firebase Emulators
```bash
# Na raiz do projeto
npm run dev:emulator
```

#### Terminal 2 - Frontend Next.js
```bash
# Na raiz do projeto
npm run dev:frontend
```

## URLs dos Serviços

- **Frontend**: http://localhost:3000
- **Firebase UI**: http://localhost:4444
- **Firestore**: http://localhost:8888
- **Auth**: http://localhost:9088
- **Functions**: http://localhost:5002
- **Storage**: http://localhost:9188

## Resolução de Problemas

### Porta 5000 ocupada
O Firebase Hosting agora usa a porta 3001 em vez de 5000 para evitar conflitos.

### Vulnerabilidades no npm
Execute `npm audit fix --force` em cada diretório (app/ e functions/).

### Node.js version mismatch
Use Node.js 18 ou superior. Se estiver usando nvm:
```bash
nvm use 18
```

### Emulators não iniciam
Certifique-se de que as portas não estão sendo usadas por outros processos:
```bash
# Verificar processos nas portas
lsof -i :3000
lsof -i :4000
lsof -i :5001
lsof -i :8080
lsof -i :9099
```

## Comandos Úteis

```bash
# Fazer build do frontend
npm run build

# Executar linting
npm run lint

# Executar testes
npm test

# Deploy das functions
npm run deploy:functions

# Deploy completo
npm run deploy

# Setup inicial automatizado
npm run setup
```

## Estrutura de Desenvolvimento

```
Binary Hub/
├── app/                    # Frontend Next.js
├── functions/             # Firebase Functions
├── firestore.rules        # Regras do Firestore
├── firebase.json          # Configuração do Firebase
├── package.json          # Scripts do projeto
└── scripts/              # Scripts de automação
```

## Próximos Passos

1. ✅ Configurar ambiente de desenvolvimento
2. ⏳ Testar API endpoints
3. ⏳ Implementar páginas frontend
4. ⏳ Testes e validação
5. ⏳ Deploy em produção 