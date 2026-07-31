# 🤖 WhatsApp AI Bot

Bot inteligente para WhatsApp com suporte a chamadas de voz, música e painel web.

## Funcionalidades

- **WhatsApp Bot**: Conexão via Baileys, comandos automáticos, IA conversacional
- **IA Integrada**: OpenAI GPT, memória por usuário, detecção de intenção
- **Chamadas de Voz**: Atendimento automático, STT (Whisper) → IA → TTS
- **Música**: Fila de reprodução, controle (play/pause/skip/volume)
- **Painel Web**: Dashboard em tempo real com Socket.IO
- **Segurança**: Autenticação JWT, rate limiting, proteção contra spam

## Requisitos

- Node.js 20+
- Conta na [OpenAI](https://platform.openai.com) (API Key)
- Conta na [Railway](https://railway.app) (para deploy)

## Instalação Local

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/whatsapp-ai-bot
cd whatsapp-ai-bot

# Instale dependências
npm install

# Configure o ambiente
cp .env.example .env
# Edite .env com suas chaves

# Execute
npm start
```

## Configuração (.env)

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `OPENAI_API_KEY` | Chave da API OpenAI | obrigatório |
| `JWT_SECRET` | Segredo para autenticação do dashboard | obrigatório |
| `ADMIN_PASSWORD` | Senha do dashboard | obrigatório |
| `PORT` | Porta do servidor | 3000 |
| `OPENAI_MODEL` | Modelo da IA | gpt-4o-mini |
| `TTS_VOICE` | Voz do TTS | alloy |

## Deploy na Railway

### 1. Preparar o projeto

```bash
# O projeto já contém:
# - Dockerfile
# - railway.json
# - .env.example

# Faça push para o GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/seu-usuario/whatsapp-ai-bot.git
git push -u origin main
```

### 2. Configurar no Railway

1. Acesse [railway.app](https://railway.app) e faça login
2. Clique em **New Project** → **Deploy from GitHub repo**
3. Selecione o repositório
4. Vá em **Variables** e adicione:
   - `OPENAI_API_KEY` = sua chave
   - `JWT_SECRET` =一串 aleatória
   - `ADMIN_PASSWORD` = sua senha
5. O deploy começa automaticamente

### 3. Conectar o WhatsApp

1. Abra o dashboard: `https://seu-projeto.up.railway.app`
2. Faça login com as credenciais do `.env`
3. Escaneie o QR Code com o WhatsApp
4. Pronto! O bot está online.

## Comandos do WhatsApp

```
🎵 Música:
!play <nome> - Tocar música
!pause       - Pausar
!resume      - Continuar
!stop        - Parar
!skip/!next  - Próxima
!queue       - Ver fila
!volume <n>  - Ajustar volume

🤖 IA:
Qualquer mensagem é respondida pela IA

📞 Chamadas:
Ligue para o número para falar com a IA

📊 Info:
!ping  - Testar conexão
!help  - Ajuda
!status- Status do bot
```

## Estrutura do Projeto

```
src/
├── index.js              # Ponto de entrada
├── config.js             # Configuração (.env)
├── logger.js             # Logs (winston)
├── whatsapp/
│   ├── client.js         # Conexão Baileys
│   ├── handler.js        # Gerenciador de mensagens
│   └── commands.js       # Sistema de comandos
├── ai/
│   └── openai.js         # Integração OpenAI
├── voice/
│   ├── callHandler.js    # Gerenciador de chamadas
│   ├── stt.js            # Speech-to-Text (Whisper)
│   └── tts.js            # Text-to-Speech (OpenAI)
├── music/
│   ├── player.js         # Reprodutor musical
│   ├── queue.js          # Fila de reprodução
│   └── sources.js        # Fontes de música
├── database/
│   ├── index.js          # Conexão SQLite
│   ├── migrations.js     # Schema do banco
│   └── models.js         # Modelos de dados
├── api/
│   ├── server.js         # Servidor Express
│   ├── routes.js         # Rotas REST
│   ├── socket.js         # WebSocket (Socket.IO)
│   └── middleware.js     # Rate limiting
└── dashboard/
    ├── index.html        # Dashboard HTML
    └── app.js            # Dashboard JS
```

## Licença

MIT
