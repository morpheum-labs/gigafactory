# API Alignment Review

## Overview
This document reviews the alignment between frontend API calls and server-side routes.

## ✅ All Endpoints Match

### 1. Agent Management

| Frontend Call | Method | Server Route | Status |
|--------------|--------|--------------|--------|
| `startAgent(config)` | POST | `/api/agents` | ✅ Match |
| `stopAgent(agentId)` | DELETE | `/api/agents/:id` | ✅ Match |
| `stopAllAgents()` | DELETE | `/api/agents/all` | ✅ Match |
| `listAgents()` | GET | `/api/agents` | ✅ Match |

### 2. CLI Availability

| Frontend Call | Method | Server Route | Status |
|--------------|--------|--------------|--------|
| `checkCliAvailable(cli)` | GET | `/api/cli/check/:cli` | ✅ Match |
| `checkAllClisAvailable()` | GET | `/api/cli/check` | ✅ Match |

### 3. Skills

| Frontend Call | Method | Server Route | Status |
|--------------|--------|--------------|--------|
| `listSkills()` | GET | `/api/skills` | ✅ Match |
| `getSkill(skillName)` | GET | `/api/skills/:name` | ✅ Match |

### 4. Configuration

| Frontend Call | Method | Server Route | Status |
|--------------|--------|--------------|--------|
| `getConfig()` | GET | `/api/config` | ✅ Match |
| `setConfig(config)` | POST | `/api/config` | ✅ Match |

### 5. WebSocket

| Frontend Call | Method | Server Route | Status |
|--------------|--------|--------------|--------|
| `listenToEvents(callback)` | WS | `/ws` | ✅ Match |

## Type Alignment

### AgentConfig

**Rust (with serde rename_all = "camelCase"):**
```rust
pub struct AgentConfig {
    pub workspace_id: WorkspaceId,        // → workspaceId in JSON
    pub prompt: String,
    pub cli: Option<CliType>,
    pub mode: Option<String>,
    pub allowed_tools: Option<Vec<String>>, // → allowedTools in JSON
    pub working_directory: Option<String>,  // → workingDirectory in JSON
    pub system_prompt: Option<String>,      // → systemPrompt in JSON
    pub model: Option<String>,
}
```

**TypeScript:**
```typescript
export interface AgentConfig {
  workspaceId: string;
  prompt: string;
  cli?: CliType;
  mode?: string;
  allowedTools?: string[];
  workingDirectory?: string;
  systemPrompt?: string;
  model?: string;
}
```

✅ **Status:** Aligned (Rust uses snake_case internally, camelCase in JSON via serde)

### AppConfig

**Rust:**
```rust
pub struct AppConfig {
    pub skills_path: String,              // → skills_path in JSON
    pub workspace_directory: Option<String>, // → workspace_directory in JSON
}
```

**TypeScript:**
```typescript
// In api.ts return type
{ skills_path: string; workspace_directory?: string | null }
```

✅ **Status:** Aligned (both use snake_case)

### SkillInfo & SkillDetail

**Rust:**
```rust
pub struct SkillInfo {
    pub name: String,
    pub description: String,
}

pub struct SkillDetail {
    pub info: SkillInfo,
    pub markdown: String,
    pub path: String,
}
```

**TypeScript:**
```typescript
export interface SkillInfo {
  name: string;
  description: string;
}

export interface SkillDetail {
  info: SkillInfo;
  markdown: string;
  path: string;
}
```

✅ **Status:** Aligned

### AgentId

**Rust:**
```rust
pub type AgentId = String;
```

**TypeScript:**
```typescript
export type AgentId = string;
```

✅ **Status:** Aligned

## Response Status Codes

### Server Error Handling

| Endpoint | Success | Error Cases |
|----------|---------|-------------|
| `startAgent` | 200 | 503 (CLI not available), 409 (Already running), 500 |
| `stopAgent` | 204 | 404 (Not found), 500 |
| `stopAllAgents` | 204 | N/A |
| `listAgents` | 200 | N/A |
| `checkCliAvailable` | 200 | N/A |
| `checkAllClisAvailable` | 200 | N/A |
| `listSkills` | 200 | 500 (Config/IO errors) |
| `getSkill` | 200 | 404 (Not found), 500 |
| `getConfig` | 200 | 500 (Config load error) |
| `setConfig` | 200 | 500 (Config save error) |

✅ **Status:** Frontend handles errors appropriately

## Potential Issues

### 1. ✅ Fixed: Config API Type Mismatch
- **Issue:** TypeScript types only included `skills_path`, missing `workspace_directory`
- **Status:** Fixed - Updated `api.ts` to include both fields

### 2. ✅ Verified: AgentConfig Field Naming
- **Issue:** Rust uses snake_case, TypeScript uses camelCase
- **Status:** Correct - Rust uses `#[serde(rename_all = "camelCase")]` to convert

## Summary

✅ **All APIs are properly aligned between frontend and backend.**

- All endpoints match
- All types are compatible (with proper serde conversions)
- Error handling is consistent
- WebSocket endpoint is correctly configured

No changes needed to the server-side code.
