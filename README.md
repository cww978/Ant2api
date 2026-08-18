# Ant2api (Antigravity & GeminiCLI to Universal AI API Gateway)

<div align="center">

<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/GoogleCloud-Dark.svg" width="60" height="60" alt="Ant2api Logo" />

# 🚀 Ant2api
### Seamlessly bridge Google Antigravity & GeminiCLI to OpenAI / Claude / Gemini Universal APIs

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-API%20Compatible-412991.svg?style=flat-square&logo=openai)](https://platform.openai.com)
[![Claude Compatible](https://img.shields.io/badge/Claude-Messages%20API-D97706.svg?style=flat-square&logo=anthropic)](https://anthropic.com)
[![Codex FIM](https://img.shields.io/badge/Codex-FIM%20Autocomplete-00A871.svg?style=flat-square)](https://github.com/features/copilot)

[English Documentation](README.md) · [简体中文文档](README_ZH.md) · [Quick Start](#-quick-start) · [Client Setup](#-client-integration-guide) · [FAQ](#-faq--troubleshooting)

</div>

---

## 📖 Overview

**Ant2api** is a high-performance, lightweight, and zero-friction AI API gateway.

It transforms **Google Antigravity** (Google Cloud Code / Code Assist) and **GeminiCLI** sessions/credentials into standard **OpenAI (`/v1/chat/completions`)**, **Claude (`/v1/messages`)**, **Codex/FIM (`/v1/completions`)**, and **Gemini (`/v1beta/models`)** compatible endpoints. It features an intuitive modern Web Management Dashboard, multi-account intelligent load balancing, live audit logs, and production-ready Linux deployment support.

---

## ✨ Key Features

### 🌐 1. Multi-Protocol Universal API Transformation
- **OpenAI Compatible**:
  - `/v1/chat/completions`: Full support for Server-Sent Events (SSE) streaming, Tool Calls / Function Calling, system prompts, and multimodal vision.
  - `/v1/models`: Dynamic model discovery and router.
  - `/v1/embeddings`: Vector embeddings generation.
  - `/v1/images/generations`: High-definition image generation via Imagen 3.
- **Claude Compatible**:
  - `/v1/messages`: Anthropic Messages protocol with complete SSE event stream (`message_start`, `content_block_delta`, `message_stop`).
  - **Extended Thinking**: Supports deep reasoning and thinking chains streaming output.
- **Codex Code Completion & FIM**:
  - `/v1/completions`, `/v1/engines/:engine/completions`, `/v1/responses`.
  - **Fill-in-the-Middle (FIM)**: Seamless prompt + suffix code insertion for VSCode Copilot, Continue.dev, Aider, and Cursor autocompletion.
- **Gemini Native**:
  - `/v1beta/models/*:generateContent` & `:streamGenerateContent`.

### 🔄 2. Multi-Account Pool & Smart Load Balancing
- **Multiple Credential Types**: Supports Google OAuth2 Refresh Tokens, Web Cookies, and official Gemini API Keys.
- **Load Balancing Algorithms**: Round-Robin and Least-Errors dispatching.
- **Automatic Failover & Cooldown**: Instant automatic cooldown and seamless failover to backup accounts upon `429 Too Many Requests` or quota exhaustion.
- **Automatic Lifecycle Management**: Built-in Google OAuth2 token refresher automatically renews access tokens before expiration.

### 🖥️ 3. Modern Web Management Dashboard
- **Monitoring & Metrics**: Live QPS, 24-hour request volume charts, token throughput, average latency, and success rates.
- **Credential Pool**: Visual management with an integrated **Google OAuth One-Click Authorization Helper**.
- **API Key Management**: Issue custom client keys (`sk-ant2api-...`) with per-key RPM rate limits and token usage quotas.
- **Model Alias Mapping**: Effortlessly alias models (e.g., routing `gpt-4o` to `gemini-2.5-pro` or `claude-3-7-sonnet` to `gemini-3.7-flash`).
- **Web Playground**: Directly test streaming chats in OpenAI, Claude, or Gemini format inside your browser.
- **Audit Logs**: Detailed request timeline, latency breakdown, token counting, and error debugging.

### 🐧 4. Production-Ready Linux Deployment
- Docker & Docker Compose out of the box.
- One-click Linux installer script (`deploy/install.sh`), Systemd service unit (`ant2api.service`), and Nginx SSE reverse-proxy template (`deploy/nginx.conf`).

---

## 📡 API Endpoints Reference

| Protocol | Endpoint | Method | Description | Compatible Clients |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `/v1/chat/completions` | `POST` | Chat completions (Stream SSE & Tools) | NextChat, ChatBox, Cherry Studio, Cursor |
| **OpenAI** | `/v1/completions` | `POST` | Text & code completion / FIM insertion | Continue.dev, Copilot, Aider |
| **OpenAI** | `/v1/models` | `GET` | List available models | Any OpenAI-compatible client |
| **OpenAI** | `/v1/embeddings` | `POST` | Text embedding vectors | LangChain, LlamaIndex, RAG apps |
| **OpenAI** | `/v1/images/generations` | `POST` | Imagen 3 image generation | NextChat, DALL-E compatible tools |
| **Claude** | `/v1/messages` | `POST` | Anthropic messages & Thinking | Claude Code CLI, Cline, LibreChat |
| **Gemini** | `/v1beta/models/*:generateContent` | `POST` | Google native content generation | Google AI SDK, native clients |
| **Gemini** | `/v1beta/models/*:streamGenerateContent` | `POST` | Google native streaming generation | Google AI SDK, native clients |
| **Admin** | `/admin/*` & `/` | `ALL` | Web Dashboard and API management | Browser UI (Default Port: `8080`) |

---

## 🚀 Quick Start

### Method 1: Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/Ant2api.git
cd Ant2api

# 2. (Optional) Configure environment variables
cp .env.example .env

# 3. Start the container
docker compose up -d
```
Visit `http://localhost:8080` in your browser. Log in with the default admin password: `ant2api_admin`.

---

### Method 2: Local Node.js / TypeScript

> Requires Node.js >= 18.0.0, npm / pnpm

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript & copy static web assets
npm run build

# 3. Start the service
npm start
```

For live development with auto-reload:
```bash
npm run dev
```

---

### Method 3: Linux Server One-Click Install (Ubuntu / Debian / CentOS)

```bash
# Grant execution permissions and run the installer
chmod +x deploy/install.sh
sudo ./deploy/install.sh
```
The installer automatically sets up Node.js, compiles the project, registers the `ant2api` Systemd service, and enables auto-start on boot.

```bash
# Useful service commands
sudo systemctl status ant2api   # Check service status
sudo systemctl restart ant2api  # Restart service
sudo journalctl -u ant2api -f   # View real-time logs
```

---

## 🔌 Client Integration Guide

### 1. OpenAI Format (NextChat / ChatBox / Cherry Studio)

- **Base URL / API Host**: `http://<YOUR_SERVER_IP>:8080/v1`
- **API Key**: `sk-ant2api-...` (Generated in Dashboard)
- **Supported Models**: `gpt-4o`, `gpt-4o-mini`, `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3.7-flash`

#### cURL Example:
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ant2api-your-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "system", "content": "You are an expert AI assistant."},
      {"role": "user", "content": "Write a quicksort algorithm in TypeScript."}
    ],
    "stream": true
  }'
```

---

### 2. Claude Format (Claude Code CLI / Cline / Roo-Code / LibreChat)

#### Claude Code CLI Terminal Setup:
```bash
export ANTHROPIC_BASE_URL="http://localhost:8080"
export ANTHROPIC_API_KEY="sk-ant2api-your-key"
claude
```

#### cURL Example (Anthropic Messages API):
```bash
curl http://localhost:8080/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk-ant2api-your-key" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-3-7-sonnet",
    "max_tokens": 2048,
    "messages": [
      {"role": "user", "content": "Explain the difference between Rust and Go for backend services."}
    ],
    "stream": true
  }'
```

---

### 3. VSCode Continue / Copilot (FIM Fill-In-The-Middle)

In Continue.dev `config.json`, configure Tab Autocomplete:

```json
{
  "tabAutocompleteModel": {
    "title": "Ant2api Code Completion",
    "provider": "openai",
    "model": "gemini-3.7-flash",
    "apiBase": "http://localhost:8080/v1",
    "apiKey": "sk-ant2api-your-key"
  }
}
```

#### FIM Completion cURL Example:
```bash
curl http://localhost:8080/v1/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ant2api-your-key" \
  -d '{
    "model": "gemini-3.7-flash",
    "prompt": "function calculateSum(a: number, b: number): number {\n",
    "suffix": "\n}",
    "max_tokens": 100,
    "temperature": 0.1,
    "stream": true
  }'
```

---

### 4. Cursor IDE Integration

1. Open Cursor Settings -> **Models**.
2. Enable **OpenAI API Key** and enter your `sk-ant2api-your-key`.
3. Click **Override OpenAI Base URL** and set `http://<YOUR_SERVER_IP>:8080/v1`.
4. Add models: `gemini-2.5-pro`, `gemini-3.7-flash`, `gpt-4o`.

---

## ⚙️ Environment Variables

Create a `.env` file in the project root to override default settings:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | HTTP port for the gateway service |
| `HOST` | `0.0.0.0` | Binding host address |
| `ADMIN_PASSWORD` | `ant2api_admin` | Password for the Web Admin Dashboard |
| `DATA_DIR` | `./data` | Directory for persistent storage (accounts, keys, logs) |
| `DEFAULT_MODEL` | `gemini-2.5-pro` | Default fallback model name |
| `HTTP_PROXY` | - | Outbound HTTP/HTTPS proxy for upstream Google requests (e.g. `http://127.0.0.1:7890`) |

---

## 📂 Project Structure

```
Ant2api/
├── package.json               # Dependencies and build scripts
├── tsconfig.json              # TypeScript compilation config
├── Dockerfile                 # Multi-stage production Dockerfile
├── docker-compose.yml         # Container orchestration
├── deploy/                    # Deployment suite
│   ├── install.sh             # Linux one-click setup script
│   ├── ant2api.service        # Systemd daemon definition
│   └── nginx.conf             # Nginx reverse-proxy & SSE buffer config
├── src/
│   ├── index.ts               # Application entry point
│   ├── config.ts              # Configuration & env management
│   ├── middleware/            # Auth, error handling, access logs
│   ├── routes/                # OpenAI, Claude, Gemini, Codex, Admin routes
│   ├── converters/            # Protocol translation (OpenAI / Claude / Codex / SSE / Tools)
│   ├── providers/             # Upstream drivers (Antigravity / Gemini CLI / Google OAuth)
│   ├── services/              # Account pool, Key quotas, Model routing, Persistence
│   └── web/                   # Web Admin Dashboard SPA (HTML / CSS / JS)
└── data/                      # Persistent storage (Accounts, Keys, Aliases, Logs)
```

---

## ❓ FAQ & Troubleshooting

### Q1: How to handle upstream `429 Too Many Requests` errors?
> **Answer**: Ant2api has built-in circuit-breaking and account cooldown. Adding 2 or more accounts in the **Account Pool** allows Ant2api to automatically cool down throttled accounts and fail over to healthy accounts instantaneously.

### Q2: Stream output is buffered or delayed when using Nginx?
> **Answer**: This is caused by Nginx response buffering. Add the following directives inside your Nginx `location /` block (as provided in `deploy/nginx.conf`):
> ```nginx
> proxy_buffering off;
> proxy_cache off;
> proxy_set_header Connection '';
> chunked_transfer_encoding on;
> ```

### Q3: Server cannot reach Google services directly?
> **Answer**: Set `HTTP_PROXY=http://your-proxy-ip:port` in your `.env` file to route all upstream Google requests through your proxy.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
