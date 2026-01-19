# xMy Chat — Development Phases

## System Overview (Phase 0)

xMy is an **anonymous, ephemeral chat system** with no message persistence. Rooms self-destruct after inactivity, and all state is **server-authoritative**. Users join with display names only; real authority comes from server-generated sessionIds.

---

## Phase 0 — Freeze scope (do this first)

☐ Explicitly document (in README or comments):
- Anonymous system
- Ephemeral rooms  
- No message persistence
- Server-authoritative state

**Why:** Prevents feature creep and wrong future decisions.

**Stop when:** You can describe your system in one paragraph without contradiction.

---

## Phase 1 — Ephemeral Identity (highest priority)

☐ Server generates a sessionId on connection
☐ Client never sends identity claims after join
☐ All authority checks use sessionId, not username
☐ username becomes display-only
☐ Room ownership bound to sessionId

**Why:** Fixes impersonation, broken ownership, fake mute/unmute.

**Stop when:** A client cannot impersonate another user even if they know the username.

---

## Phase 2 — Join handshake hardening

☐ Reject duplicate usernames per room
☐ Server confirms join success with authoritative payload
☐ Client UI only updates after server confirmation
☐ Server assigns role (owner / participant)

**Why:** Prevents UI desync and fake joins.

**Stop when:** Client cannot "assume" it joined a room.

---

## Phase 3 — Reconnect handling (grace-based)

☐ Detect socket close vs intentional leave
☐ Mark user as disconnected, not removed
☐ Start reconnect timer (15–30s)
☐ Reattach session if reconnect happens
☐ Finalize leave only after timer expires

**Why:** Mobile networks, Wi-Fi drops, tab backgrounding.

**Stop when:** Temporary disconnects no longer kill rooms or ownership.

---

## Phase 4 — Room lifecycle enforcement

☐ Room has explicit states:
- active
- draining (waiting for reconnects)
- destroyed

☐ Room destroyed only when:
- no connected users
- no pending reconnect timers

**Why:** Eliminates race conditions and phantom rooms.

**Stop when:** Room destruction is predictable and intentional.

---

## Phase 5 — Authority enforcement (server decides)

☐ Clients send intents, not actions
☐ Server validates:
- who is owner
- who is muted  
- who can delete
☐ System messages generated only by server

**Why:** Clients are untrusted by default.

**Stop when:** A malicious client cannot break room rules.

---

## Phase 6 — Rate limiting & safety rails

☐ Message rate limit per session
☐ Max users per room
☐ Max rooms per IP
☐ Max message size (already mostly done)

**Why:** Prevents abuse and accidental crashes.

**Stop when:** One client cannot degrade the whole server.

---

## Phase 7 — Observability (minimal, but real)

☐ Log:
- room create/destroy
- owner changes
- reconnect events
☐ Log reasons, not raw payloads

**Why:** You cannot debug what you cannot see.

**Stop when:** You can explain any weird behavior from logs.
