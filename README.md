# Ant2api (Antigravity & GeminiCLI to Universal AI API Gateway)

<div align="center">

<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/GoogleCloud-Dark.svg" width="60" height="60" alt="Ant2api Logo" />

# 🚀 Ant2api
### Seamlessly bridge Google Antigravity & GeminiCLI to OpenAI / Codex / Gemini Universal APIs

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-API%20Compatible-412991.svg?style=flat-square&logo=openai)](https://platform.openai.com)
[![Codex FIM](https://img.shields.io/badge/Codex-FIM%20Autocomplete-00A871.svg?style=flat-square)](https://github.com/features/copilot)

[English Documentation](README.md) · [简体中文文档](README_ZH.md) · [Quick Start](#-quick-start) · [Client Setup](#-client-integration-guide) · [FAQ](#-faq--troubleshooting)

</div>

---

## 📖 Overview

**Ant2api** is a high-performance, lightweight, and zero-friction AI API gateway.

It transforms **Google Antigravity** (Google Cloud Code / Code Assist) and **GeminiCLI** sessions/credentials into standard **OpenAI (`/v1/chat/completions`)**, **Codex / ChatGPT Desktop (`/v1/responses`, `/v1/completions`)**, and **Gemini (`/v1beta/models`)** compatible endpoints. It features an intuitive modern Web Management Dashboard, dual-port separation, dynamic proxy lifecycle control, intelligent multi-account load balancing, and paginated audit logs.

---

## 🏗️ Architecture: Dual-Port Separation

```
┌─────────────────────────────────────────────────────────────┐
│ 🎛️ Admin Web Console & Management API                       │
│ 🌐 Web Dashboard:   http://localhost:8080 (Configurable)    │
│ 🔑 Admin Password:  ant2api_admin                           │
│ 📦 Includes: Web UI + /api/admin/* Management APIs          │
└──────────────────────────────┬──────────────────────────────┘
                               │
               Dynamic Lifecycle / Hot Reload
                               │
┌──────────────────────────────▼──────────────────────────────┐
│ 🚀 API Reverse Proxy Service (Proxy Port)                   │
│ 📡 Listen Port:     http://localhost:8045 (Dynamic Config)  │
│ 📦 Endpoints:                                               │
│    • OpenAI Endpoint:    /v1/chat/completions               │
│    • ChatGPT / Codex:    /v1/responses, /v1/completions     │
│    • WebSocket Stream:   ws://localhost:8045/v1/responses   │
│    • Gemini Endpoint:    /v1beta/models                     │
│    • Health Check:       /health                            │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

### 🌐 1. Multi-Protocol Universal API Transformation
- **OpenAI Compatible**:
  - `/v1/chat/completions`: Full support for Server-Sent Events (SSE) streaming, Tool Calls / Function Calling, system prompts, reasoning budgets, and multimodal vision.
  - `/v1/models`: Dynamic model discovery and router.
- **Codex & ChatGPT Desktop Client**:
  - `/v1/responses` & `/v1/completions`: Complete support for official Codex / ChatGPT clients with native WebSocket & SSE streaming.
  - **Autonomous Tool Calling**: Built-in IDE agent guidance compelling models to proactively execute `read_file`, `view_file`, `grep_search`, `list_dir`, and `apply_patch` without intermediate delays.
  - **Fill-in-the-Middle (FIM)**: Seamless prompt + suffix code insertion for VSCode Copilot, Continue.dev, Aider, and Cursor autocompletion.
- **Gemini Native**:
  - `/v1beta/models/*:generateContent` & `:streamGenerateContent`.

### 🖥️ 2. Modern Web Management Console
- **⚙️ Service Configuration**:
  - Real-time proxy status indicator (🟢 Running / ⚪ Stopped / 🟡 Restarting).
  - Dynamic service actions: `[Start Service]`, `[Stop Service]`, `[Restart Service]`.
  - Configurable listening port (default `8045`), request timeout (default `120s`), LAN access switch (`127.0.0.1` vs `0.0.0.0`), auth mode (`auto` / `strict` / `disabled`), Master API Key, Admin Password, and User-Agent override.
- **📊 Overview Dashboard**: Real-time QPS, token throughput, average latency, and endpoint copy shortcuts.
- **👥 Credential Pool**: Visual management with an integrated **Google OAuth One-Click Authorization Helper**.
- **🔑 API Key Management**: Issue custom client keys (`sk-ant2api-...`) with per-key token quotas and RPM rate limits.
- **🔀 Model Route Mapping**: Effortlessly alias models (e.g., routing `gpt-4o` to `gemini-3.7-flash` or `o1` to `gemini-3.7-thinking`).
- **📜 Request Audit Logs**: Server-side paginated table (10/20/50/100 per page), status code filters, keyword search with debounce, and auto-refresh.
- **🛡️ Advanced System Settings**: Outbound proxy configuration (Clash/V2Ray HTTP/SOCKS5), load balancing strategies (Round-Robin, Least-Errors, Random), and full JSON database backup/restore.

---

## 📡 API Endpoints Reference

| Protocol | Endpoint | Method | Description | Compatible Clients |
| :--- | :--- | :--- | :--- | :--- |
| **OpenAI** | `/v1/chat/completions` | `POST` | Chat completions (Stream SSE & Tools) | NextChat, ChatBox, Cherry Studio, Cursor, Cline |
| **Codex** | `/v1/responses` | `POST` | Codex agent responses & WebSocket stream | ChatGPT Desktop, Codex IDE extensions |
| **Codex** | `/v1/completions` | `POST` | Text & code completion / FIM insertion | Continue.dev, Copilot, Aider |
| **Gemini** | `/v1beta/models/*` | `POST` | Google native content generation | Google AI SDK, native clients |
| **Health** | `/health` | `GET` | Service health status check | Probes, monitoring tools |

---

## 🚀 Quick Start

### Method 1: Local Development (Recommended)

```bash
# 1. Install dependencies
npm install

# 2. Start development server (supports hot-reloading)
npm run dev
```

Visit the Web Management Console at [`http://localhost:8080`](http://localhost:8080). Default admin password: `ant2api_admin`.

---

### Method 2: Production Build & Run

```bash
# 1. Compile TypeScript & static web assets
npm run build

# 2. Start production server
npm start
```

---

### Method 3: Docker & Docker Compose

```bash
# 1. Start containers in background
docker compose up -d
```

---

## 🔌 Client Integration Guide

### 1. OpenAI Format (NextChat / ChatBox / Cherry Studio / Cursor)

- **Base URL / API Host**: `http://<YOUR_SERVER_IP>:8045/v1`
- **API Key**: `sk-ant2api-...` (Configured in Dashboard)
- **Supported Models**: `gpt-4o`, `gpt-4o-mini`, `gemini-3.7-flash`, `gemini-3.7-thinking`

```bash
curl http://localhost:8045/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ant2api-default-master-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Write a quicksort algorithm in TypeScript."}
    ],
    "stream": true
  }'
```

---

### 2. ChatGPT Desktop / Codex Client

- **API Endpoint**: `http://localhost:8045/v1/responses`
- **API Key**: Master API Key or generated Sub-Key.

---

## 📄 License

MIT License © 2026 Ant2api Team.
