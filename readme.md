# Branch International: Customer Support Intelligence Platform

> **A high-performance, real-time agent inbox designed to prioritize human attention where it matters most.**

![Status](https://img.shields.io/badge/Status-Production%20Ready-success)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20SQLite-blue)

---

## 📌 Executive Summary

This project is a **production-grade simulation of a fintech customer support intelligence system**. It goes far beyond a basic chat UI and focuses on **operational realities** faced by support teams:

* Message overload
* Urgency misclassification
* Fragmented customer context
* Slow agent response on critical issues

The system ingests raw customer messages, **structures them into conversations**, computes an **explainable urgency score**, and presents agents with a **real-time, prioritized inbox**.

The design emphasizes:

* Deterministic behavior
* Low latency
* Clear data ownership
* Explainable decision-making

---

## 🎯 Core Problem

Traditional FIFO (first-in-first-out) queues fail in fintech support because **not all messages are equal**.

### Real-world pain points

1. **Missed Urgency**
   A blocked account or rejected loan causes immediate financial stress. Treating it like a password reset is dangerous.

2. **Context Switching**
   Agents read scattered messages without a clear concept of *issues* or *resolution state*.

3. **Operational Inefficiency**
   Agents spend time deciding *what* to respond to instead of *responding*.

---

## 🧠 System Philosophy

This system is built on three core principles:

1. **Structure raw data early** (messages → conversations)
2. **Rank work by risk, not time**
3. **Push updates, don’t poll**

---

## 🏗 High-Level Architecture

The application is implemented as a **Real-Time Event-Driven Monolith**.

Why a monolith?

* Single deployment unit
* Easier reasoning
* Lower latency
* Fewer moving parts

### System Overview

```ascii
┌──────────────────────────────┐
│      Customer Channels       │
│  (App / SMS / CSV / API)     │
└──────────────┬───────────────┘
               │ Raw Messages
               ▼
┌──────────────────────────────────────────┐
│          BACKEND (Node.js)               │
│                                          │
│  ┌──────────────┐   ┌─────────────────┐ │
│  │ Ingestion     │   │ Urgency Engine  │ │
│  │ Pipeline      │   │ (Rules Engine)  │ │
│  └──────┬───────┘   └─────────┬───────┘ │
│         │ Conversation Logic            │
│         ▼                               │
│  ┌───────────────────────────────────┐ │
│  │ Conversation Manager               │ │
│  │ - 24h windowing                    │ │
│  │ - Status transitions               │ │
│  └──────────┬────────────────────────┘ │
│             │ Events                   │
│             ▼                          │
│  ┌───────────────────────────────────┐ │
│  │ SSE Event Stream                   │ │
│  │ (Server → Agent UI)                │ │
│  └───────────────────────────────────┘ │
└───────────────────┬────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────┐
│        Persistence Layer (SQLite)        │
│ Customers → Conversations → Messages     │
└──────────────────────────────────────────┘

                    ▲
                    │ Real-time updates
┌───────────────────┴────────────────────┐
│        Agent Dashboard (React)          │
│  Inbox | Chat | Customer Context        │
└────────────────────────────────────────┘
```

---

## 🧱 Backend Architecture (Deep Dive)

### Technology Choices

| Component | Choice             | Reason                            |
| --------- | ------------------ | --------------------------------- |
| Runtime   | Node.js            | Non-blocking I/O, SSE-friendly    |
| Framework | Express            | Minimal, predictable HTTP         |
| Database  | SQLite             | Zero-config, relational integrity |
| Real-time | Server-Sent Events | One-way push, low overhead        |

---

## 1️⃣ Data Model

The system uses a **relational schema**, even in SQLite, to mirror production-grade design.

```ascii
Customers
  └── Conversations
        └── Messages
```

### Entities

**Customer**

* id
* verification status
* metadata

**Conversation**

* id
* customerId
* status (OPEN | IN_PROGRESS | RESOLVED)
* urgencyScore
* createdAt / updatedAt

**Message**

* id
* conversationId
* sender (CUSTOMER | AGENT)
* content
* timestamp

---

## 2️⃣ Conversation Windowing (24-Hour Rule)

Raw messages are meaningless without structure.

### Rule

> Messages from the same customer belong to the same conversation **until a 24-hour silence gap occurs**.

### Why?

* Matches real support workflows
* Creates discrete “issues”
* Allows resolution tracking

```ascii
Time ───────────────────────────────▶

Msg ── Msg ── Msg ── (23h) ── Msg   → Same Conversation

Msg ── Msg ── (25h silence) ── Msg  → NEW Conversation
```

---

## 3️⃣ Urgency Engine (Explainable by Design)

Urgency is computed using **deterministic rules**, not black-box ML.

### Scoring Formula

```
Urgency Score = Keywords (30)
              + Sentiment (40)
              + Time Delay (20)
```

### Example

Message:

> "My loan was rejected and my account is blocked"

| Factor    | Score  |
| --------- | ------ |
| Keywords  | +30    |
| Sentiment | +40    |
| Delay     | 0      |
| **Total** | **70** |

### Explainability

Each conversation stores a **reason payload**:

> "Contains keywords: loan, blocked"

This builds **agent trust**.

---

## 4️⃣ Status Transitions

Conversations are **state machines**, not static records.

```ascii
OPEN ──▶ IN_PROGRESS ──▶ RESOLVED
  ▲                         │
  └──────── New Message ◀───┘
```

### Key Behavior

* New customer message auto-reopens resolved threads
* Agent replies move state to IN_PROGRESS

---

## 5️⃣ Real-Time Updates (SSE)

### Why SSE?

* Unidirectional (server → client)
* Lower overhead than WebSockets
* Auto-reconnect
* Firewall friendly

### Event Flow

```ascii
DB Write
   │
   ▼
Event Emitted
   │
   ▼
SSE Stream
   │
   ▼
React Store Update
   │
   ▼
UI Re-render
```

---

## 🎨 Frontend Architecture (Deep Dive)

### Technology Choices

| Component | Choice       | Reason               |
| --------- | ------------ | -------------------- |
| Framework | React        | Component-driven UI  |
| Bundler   | Vite         | Fast HMR             |
| Styling   | Tailwind CSS | Design consistency   |
| State     | Zustand      | Minimal global state |

---

## UI Layout System

The UI is a **three-pane professional inbox**, inspired by fintech tooling.

```ascii
┌────────────┬────────────────────┬─────────────────────┐
│ Inbox      │ Conversation       │ Customer Context    │
│ (Priority) │ (Chat Window)      │ (Risk + Profile)   │
└────────────┴────────────────────┴─────────────────────┘
```

### Panels

1. **Inbox**

   * Sorted by urgency DESC
   * Status badges
   * Filters (ALL / OPEN / RESOLVED)

2. **Conversation Window**

   * Chronological messages
   * Agent reply box
   * Resolve action

3. **Customer Context**

   * Verified status
   * Urgency breakdown
   * Historical context

---

## Mobile & Responsive Strategy

### Desktop

* 3-column layout
* Resizable panels

### Mobile

* Single column
* Inbox → Chat navigation
* Context via info drawer

```ascii
Mobile:
┌──────────────┐
│ Inbox        │
└──────────────┘
      ↓
┌──────────────┐
│ Conversation │
└──────────────┘
```

---

## Theme System (Dark / Light / System)

* System-aware default
* Manual override
* Persisted in localStorage

```ascii
OS Theme ──▶ App Theme Hook ──▶ Tailwind Classes
```

---

## 🔄 End-to-End Flow (Complete)

```ascii
Customer Message
      │
      ▼
Ingestion API
      │
      ▼
Conversation Resolver
      │
      ▼
Urgency Engine
      │
      ▼
DB Write
      │
      ▼
SSE Emit
      │
      ▼
React Store
      │
      ▼
Inbox Reordered
```

---

## 🚀 Setup Instructions

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

---

## ⚖ Trade-offs & Constraints

| Decision            | Trade-off               |
| ------------------- | ----------------------- |
| SQLite              | Limited concurrency     |
| Monolith            | Less horizontal scaling |
| Rules-based urgency | No ML adaptability      |

---

## 🔮 Future Scope

* AI reply copilot
* SLA breach detection
* Postgres migration
* Role-based access
* Full audit logs

---

## 🧠 Author’s Note

This project demonstrates **architectural thinking**, not just feature delivery.

Every decision was made to balance:

* Correctness
* Explainability
* Performance
* Simplicity

This is how real fintech systems are designed.

---
