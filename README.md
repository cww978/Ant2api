# Ant2api

<div align="center">

<img src="https://raw.githubusercontent.com/tandpfun/skill-icons/main/icons/GoogleCloud-Dark.svg" width="56" height="56" alt="Ant2api Logo" />

### Google Antigravity ↔ OpenAI / Codex / Gemini API Gateway

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933.svg?style=flat-square&logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)
[![OpenAI Compatible](https://img.shields.io/badge/OpenAI-Compatible-412991.svg?style=flat-square&logo=openai)](https://platform.openai.com)

[English](README.md) · [简体中文](README_ZH.md) · [Quick Start](#-quick-start) · [Clients](#-client-integration) · [API Endpoints](#-api-endpoints)

</div>

---

## 📖 Overview

**Ant2api** is a high-performance AI API gateway that transforms **Google Antigravity** (Google Cloud Code / Code Assist) credentials into standard **OpenAI**, **Codex / ChatGPT Desktop**, and **Gemini** compatible endpoints.

- 👥 **Multi-Account Pool**: OAuth one-click login, load balancing, real Google email display & real-time Gemini quota countdowns.
- 🔄 **Universal Protocols**: Full support for `/v1/chat/completions`, `/v1/responses`, `/v1/completions`, and `/v1beta/models`.
- 🛠️ **Codex Agent & FIM**: Native tool calling, fill-in-the-middle code completion, and streaming.
- 🎛️ **Dual-Port Isolation**: Web Console (`:8080`) & Reverse Proxy (`:8045`) run independently.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│ 🎛️ Admin Web Console (Port 8080)                       │
│ 🌐 Dashboard: http://localhost:8080                    │
│ 🔑 Default Password: ant2api_admin                     │
└──────────────────────────┬─────────────────────────────┘
                           │ Dynamic Control / Hot Reload
┌──────────────────────────▼─────────────────────────────┐
│ 🚀 API Reverse Proxy (Port 8045)                       │
│ • OpenAI:   /v1/chat/completions, /v1/models           │
│ • Codex:    /v1/responses, /v1/completions             │
│ • Gemini:   /v1beta/models                             │
│ • Health:   /health                                    │
└────────────────────────────────────────────────────────┘
```

---

## ✨ Features

- **Multi-Protocol Gateways**:
  - **OpenAI**: Stream SSE, Tool / Function Calling, reasoning budgets, multimodal images.
  - **Codex & ChatGPT**: Official `/v1/responses` agent protocol with autonomous tool loops (`read_file`, `apply_patch`, `grep_search`).
  - **FIM Autocomplete**: Seamless prompt + suffix code insertion for VSCode, Cursor, Continue.dev, and Aider.
- **Account Pool & Quota Monitoring**:
  - Visual OAuth account authorization.
  - Real Google account emails, subscription tier detection (PRO / FREE), and live Gemini quota countdown timers.
- **Web Management Dashboard**:
  - Service lifecycle control (Start / Stop / Restart).
  - Multi-key management (`sk-ant2api-...`), model aliases, outbound proxy (HTTP/SOCKS5), and paginated audit logs.

---

## 📡 API Endpoints

| Protocol | Endpoint (`:8045`) | Method | Description |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `/v1/chat/completions` | `POST` | Chat completions (Stream & Tools) |
| **Codex** | `/v1/responses` | `POST` | Codex agent responses & WebSocket stream |
| **Codex** | `/v1/completions` | `POST` | Code completion / FIM insertion |
| **Gemini** | `/v1beta/models/*` | `POST` | Google native SDK completions |
| **Health** | `/health` | `GET` | Service health status |

---

## 🚀 Quick Start

### 1. Local Run

```bash
# Install dependencies
npm install

# Start development (Web Console: http://localhost:8080)
npm run dev
```

### 2. Production Build

```bash
npm run build
npm start
```

### 3. Docker

```bash
docker compose up -d
```

---

## 🔌 Client Integration

### OpenAI Format (Cursor / NextChat / Cherry Studio)

- **Base URL**: `http://localhost:8045/v1`
- **API Key**: `sk-ant2api-default-master-key` (or your custom key)
- **Model**: `gpt-4o`, `gemini-3.7-flash`, `gemini-3.7-thinking`

```bash
curl http://localhost:8045/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-ant2api-default-master-key" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

---

## 📄 License

[MIT](LICENSE) © 2026 Ant2api Team
