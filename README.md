# Real-Time Collaborative Note App

A simplified real-time collaborative document editor built with **Node.js**, **Express**, **Socket.IO**, **PostgreSQL**, and **Next.js**.

## 🧱 Architecture Diagram

![Architecture Diagram](docs/flowchart.png)

**Data Flow:**
1.  **Client** connects to **Backend** via `Socket.IO`.
2.  **Client** fetches initial document state via REST API (`GET /api/documents/:id`).
3.  **User** types -> Client emits `edit-document` event with `{ content, version }`.
4.  **Server** checks version against DB.
    *   **Match:** Update DB, increment version, broadcast `document-updated`.
    *   **Conflict:** Reject update, send current server state to client.
5.  **Client** receives `document-updated` -> Updates UI.

## 🔄 Detailed Data Flow

![Sequence Diagram](docs/sequence-diagram.png)

### 1. Connection & Initialization
*   **Action:** User navigates to a document page (e.g., `/docs/[uuid]`).
*   **Flow:**
    1.  The Frontend fetches the *initial state* of the document via a standard HTTP GET request. This ensures the user sees the content immediately, even before the socket connects.
    2.  Simultaneously, the `Socket.IO` client establishes a WebSocket connection to the backend.
    3.  The client emits a `join-document` event to subscribe to updates for that specific document ID.

### 2. Real-Time Editing (Optimistic UI)
*   **Action:** User types a character.
*   **Flow:**
    1.  **Local Update:** The React state updates immediately, showing the character to the user (zero latency).
    2.  **Debounce:** The app waits for a brief pause in typing (e.g., 500ms) to avoid flooding the server.
    3.  **Emit:** The client sends an `edit-document` event containing:
        *   `documentId`: The target document.
        *   `content`: The full new text content.
        *   `version`: The version number the client *believed* was current when they started typing.

### 3. Conflict Resolution (Server-Side)
*   **Strategy:** Versioned Last-Write-Wins (LWW).
*   **Logic:**
    1.  The Server receives the update request.
    2.  It queries the Database for the *current* version of the document.
    3.  **Comparison:**
        *   **IF `client_version == server_version`:** The client is up-to-date. The server accepts the change, increments the version number, and saves to the DB.
        *   **IF `client_version < server_version`:** The client is outdated (someone else edited in the meantime). The server **REJECTS** the update.

### 4. Synchronization & Broadcast
*   **Success Case:** The server broadcasts a `document-updated` event to *all* clients in the room (including the sender) with the *new* content and *new* version.
*   **Conflict Case:** The server sends a `document-updated` event specifically to the rejecting client with the *current server state*. The client's UI is forced to update to this server state, effectively overwriting their local conflicting changes. This ensures eventual consistency where all users see the same text.

### 5. Advanced Features Flow

#### A. Safe Delete Strategy
*   **Problem:** User A deletes a document while User B is actively typing in it. User B loses work and gets an error.
*   **Solution:** Server-side Active User Check.
*   **Flow:**
    1.  User A clicks "Delete".
    2.  Server checks `io.sockets.adapter.rooms.get(docId).size`.
    3.  **IF size > 1:** Server returns `409 Conflict`. Frontend shows alert: "Cannot delete while others are editing."
    4.  **IF size <= 1:** Server proceeds with deletion.

#### B. Typing Indicators
*   **Goal:** Show "Someone is typing..." without persisting data.
*   **Flow:**
    1.  User A types -> Client emits `typing` event.
    2.  Server broadcasts `user-typing` to the room (excluding sender).
    3.  User B's Client receives event -> Sets `isTyping = true`.
    4.  User B's Client starts a 2-second timeout to set `isTyping = false` (auto-clear).

## ✨ Features
*   **Real-time Collaboration:** Multiple users can edit the same document simultaneously.
*   **Document Switching:** Create multiple documents and switch between them instantly.
*   **Typing Indicators:** See when other users are typing in real-time.
*   **Active User Count:** View how many users are currently in the document.
*   **Safe Delete:** Prevents deleting a document if other users are currently active in it.
*   **Conflict Resolution:** Versioned Last-Write-Wins (LWW) strategy to ensure data consistency.

## ⚙️ Technical Decisions & Reasoning

### 1. Tech Stack
*   **Backend:** `Node.js` + `Express`. Chosen for its event-driven nature, which is ideal for real-time apps.
*   **Real-time:** `Socket.IO`.
    *   *Why?* It handles reconnection, room management (perfect for separate documents), and fallbacks automatically. Native WebSockets would require reinventing these wheels.
*   **Database:** `PostgreSQL` (via `Prisma`).
    *   *Why?* Robust, relational data integrity. Prisma provides type-safe DB access.
*   **Frontend:** `Next.js` (App Router).
    *   *Why?* Industry standard for React apps. Provides easy routing (`/docs/[id]`) and optimized build process.
*   **Styling:** `Tailwind CSS`. Rapid UI development.

### 2. Conflict Resolution Strategy: Versioned Last-Write-Wins (LWW)
I implemented a **Server-Authoritative Versioning** strategy rather than a full CRDT (like Yjs) to demonstrate understanding of the problem.

*   **The Rule:**
    *   The Server is the "Source of Truth".
    *   Every document has a `version` integer.
    *   A client must submit an update based on the *current* server version.
    *   `if (client_base_version == server_current_version) { ACCEPT } else { REJECT }`
*   **Trade-offs:**
    *   *Pros:* Extremely simple to reason about. Guarantees strong consistency (no divergent states).
    *   *Cons:* "Last writer wins" in a race condition. If User A and User B submit at the same time, one will be rejected and their work overwritten by the other's update.
    *   *Mitigation:* The client UI updates instantly on rejection to minimize "lost work" perception.

### 3. Alternatives Considered
*   **CRDTs (Yjs/Automerge):**
    *   *Why not?* While they are the industry standard for production apps (Google Docs style), they abstract away the core concurrency challenges. I wanted to demonstrate my ability to implement synchronization logic from scratch.
*   **Operational Transformation (OT):**
    *   *Why not?* Extremely complex to implement correctly without existing libraries. LWW provides a good balance of complexity vs. functionality for this assignment.

### 4. Edge Cases & Reliability
*   **Network Disconnection:** Socket.IO handles automatic reconnection. The client listens for `connect` events to re-sync the document state.
*   **Race Conditions:** Handled by the version check. If two requests arrive simultaneously, the database transaction ensures only one succeeds (Optimistic Locking).
*   **Server Crash:** Since state is persisted in PostgreSQL, no data is lost. However, active user counts (in-memory) would reset. In production, we would use Redis for ephemeral state.

### 5. Scalability & Limitations
*   **Scalability:** Currently, the socket server is stateful (rooms). To scale to multiple server instances, we would need a **Redis Adapter** for Socket.IO to broadcast events across clusters.
*   **Database:** PostgreSQL is solid, but for extreme write loads (millions of keystrokes), we might buffer updates in Redis before persisting to SQL.

## 🧩 Folder Structure

```text
/backend
  /src
    /controllers  # HTTP Request Handlers (Create/Get/Delete Doc)
    /routes       # API Route Definitions
    /services     # Business Logic & DB Access
    /socket       # Socket.IO Event Handlers (The Core Logic)
    index.ts      # Entry Point
  prisma/         # DB Schema
  Dockerfile

/frontend
  /src
    /app          # Next.js App Router Pages
    /components   # React Components (Editor)
    /lib          # Utilities (API, Socket instance)
  Dockerfile

docker-compose.yml # Orchestration
```

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/documents` | List all available documents |
| `POST` | `/api/documents` | Create a new document |
| `GET` | `/api/documents/:id` | Get a specific document |
| `DELETE` | `/api/documents/:id` | Delete a document (Safe Delete enabled) |

## 💬 How to Run

### Prerequisites
*   Docker & Docker Compose

### Steps
1.  **Clone the repository**
2.  **Run with Docker Compose:**
    ```bash
    docker-compose up --build
    ```
3.  **Access the App:**
    *   Frontend: [http://localhost:3000](http://localhost:3000)
    *   Backend API: [http://localhost:4000](http://localhost:4000)

### Manual Setup (Without Docker)
**Backend:**
```bash
cd backend
npm install
npx prisma generate
# Ensure DATABASE_URL is set in .env to a local Postgres
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## 💡 Improvement Ideas
1.  **CRDTs (Yjs/Automerge):** Replace the simple LWW strategy with Yjs for true character-level merging without overwriting.
2.  **Cursor Presence:** Show where other users are typing (send `{ cursor: index }` events).
3.  **History/Undo:** Implement an undo stack that is aware of remote changes.
4.  **Authentication:** Add user accounts to track *who* made the edits.
