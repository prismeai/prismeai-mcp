# AI Store

Enterprise marketplace for discovering, deploying, and sharing AI agents.

**Users:** All (consumers), Business (creators), Developers, IT admins

---

## Architecture Overview

AI Store is a frontend workspace that acts as a user-friendly interface for **AI Knowledge projects**. Each "agent" in AI Store is actually an AI Knowledge project under the hood.

### Core Relationship: Agent = AI Knowledge Project

When you create or interact with an agent in AI Store, you're working with an AI Knowledge project. The `Get assistant` automation reveals this:

```yaml
# ai-store/automations/Get assistant.yml
do:
  - Knowledge Client.Projects - Get one project:
      id: '{{id}}'
      query:
        withDatasources: true
        withTools: true
      output: output
```

This means:
- Agent configurations (prompt, model, datasources, tools) are stored in AI Knowledge
- Agent conversations use AI Knowledge's query endpoint
- RAG capabilities, tool calling, and model selection all come from AI Knowledge

---

## Imported Apps

AI Store relies on several imported apps for its functionality:

| App | Purpose |
|-----|---------|
| **Knowledge Client** | Interface to AI Knowledge projects API |
| **Conversations Service App** | Persistent conversation storage and retrieval |
| **Views** | Collection storing shared conversation views |
| **Dialog Box** | Chat UI component (messages, typing indicators) |
| **Charts Block** | Analytics visualizations |
| **Custom Code** | JavaScript utility functions |
| **Prismeai API** | Platform API for file sharing, etc. |
| **Collection User Files** | Tracks uploaded files per user |
| **Date** | Date formatting utilities |

---

## Pages Structure

### `/index` - Agent List
Main store page displaying all accessible agents.

- Uses `ProductHome` block for layout
- Calls `initAssistantsList` which fetches from `Knowledge Client.Projects - List all projects`
- Supports filtering by category and search
- Pagination via "load more assistants"

### `/agent?id={agentId}` - New Conversation
Opens agent page ready to start a new conversation.

- Initializes agent via `initAssistant`
- Creates empty conversation on first message

### `/agent?chatId={conversationId}` - Existing Conversation
Opens agent page with an existing conversation loaded.

- Calls `initChat` to load conversation from Conversations Service
- Retrieves agent info from conversation metadata

### `/agent/edit?id={agentId}` - Agent Settings
Configuration page for agent owners.

Editable fields:
- `name` - Agent display name (localized)
- `description` - Agent description (localized)
- `img` - Main agent image
- `avatar` - Image shown beside responses
- `prompt` - System instructions
- `starters` - Suggested conversation starters
- `welcome` - Initial message in new conversations
- `warning` - Warning displayed at conversation start
- `fallbackAnswer` - Response when AI fails to answer
- `unlisted` - Hide from store listing
- `hideExplore` - Disable "Back to AI Store" link
- `hideModels` - Disable model selection for users
- `hideSidebar` - Disable conversation sidebar

### `/analytics?id={agentId}` - Usage Analytics
Personal usage statistics for an agent.

Displays:
- Prompt tokens / Completion tokens / Total tokens
- Message count
- Cost ($)
- Processing duration (s)
- Global Warming Potential (g CO2)
- Energy consumption (kWh)
- Shared conversation views
- Charts: Messages per day, Tokens per day, Views per day

### `/view?id={viewId}` - Shared Conversation
Public page displaying a shared conversation.

- No authentication required (public label)
- Shows conversation title, date, messages
- CTA to start new chat with same agent

---

## Key Automations

### Agent Lifecycle

#### `create new assistant`
Creates a new agent by creating an AI Knowledge project:
```yaml
do:
  - Knowledge Client.Projects - Update or Create project:
      data: '{{payload}}'
      output: assistant
  - emit:
      event: Update page
      payload:
        redirect:
          url: /agent?id={{assistant.id}}
```

#### `update assistant`
Updates agent configuration in AI Knowledge:
```yaml
do:
  - Get assistant:
      id: '{{payload.id}}'
      output: project
  - conditions:
      '!{{project.canEdit}}':
        - break: {}
  - Knowledge Client.Projects - Update or Create project:
      id: '{{payload.id}}'
      data: '{{data}}'
```

### Conversation Flow

#### `start chat`
Creates a new conversation:
```yaml
do:
  - Get assistant:
      id: '{{assistantId}}'
      output: assistant
  - Conversations Service App.addConversation:
      conversation:
        participants:
          - type: user
            id: '{{user.id}}'
          - type: assistant
            id: '{{assistant.id}}'
        meta:
          aiknowledge:
            assistant:
              id: '{{assistant.id}}'
      output: conversation
```

#### `on sendInput`
Handles user message submission:
1. Creates conversation if needed (new chat)
2. Validates and sanitizes input
3. Processes attachments (file sharing, URL generation)
4. Calls `addMessage` to persist user message
5. Calls `requestAIKnowledge` to get AI response

#### `requestAIKnowledge`
Core automation that queries AI Knowledge:
```yaml
do:
  - # Build history from conversation messages
  - Get assistant:
      id: '{{conversation.meta.aiknowledge.assistant.id}}'
      output: assistant
  - addMessage:
      message:
        conversationId: '{{conversation._id}}'
        meta:
          aiknowledge:
            role: assistant
      output: answer
  - Knowledge Client.query:
      text: '{{message.content}}'
      attachments: '{{message.attachments}}'
      projectId: '{{assistant.id}}'
      sse: true
      history:
        id: '{{conversation._id}}'
        messages: '{{history}}'
      output: response
  - repeat:
      'on': '{{response.body}}'
      do:
        - handleSSEMessage:
            sseEvent: '{{item}}'
            # Updates message with streamed content
```

#### `on conversation update`
Handles real-time conversation updates:
```yaml
when:
  events:
    - Conversations Service App.conversation update
do:
  - emit:
      event: Dialog Box.message
      payload:
        blocks: '{{message.meta.dialogBox.blocks}}'
      target:
        userTopic: conversation:{{message.conversationId}}
```

### Conversation Sharing

#### `UI_Interaction_update conversation view`
Creates or updates a shareable view:
```yaml
do:
  - Conversations Service App.getConversation:
      id: '{{payload.conversationId}}'
      output: conversation
  - Views.updateOne:
      query:
        conversation._id: '{{payload.conversationId}}'
      data:
        conversation: '{{conversation}}'
      options:
        upsert: true
```

---

## Custom Blocks

The workspace defines custom blocks in `index.yml`:

### `EditableRichText`
User message display with:
- Edit button to modify message
- Thread navigation (previous/next versions)
- Trace link for debugging (visible to editors)
- Attachment display (images, files)

### `AssistantMessage`
AI response display with:
- Markdown rendering
- Error state styling
- Sources button (shows RAG context)
- Actions: Copy, Like, Dislike (with feedback modal), Stats tooltip, Regenerate

### `Chat`
Main chat container with extensive CSS for:
- Message styling
- Code highlighting
- Attachment display
- Suggested questions
- Data tables

---

## Data Flow

### Message Storage Structure

Messages are stored in Conversations Service with this metadata:
```yaml
meta:
  aiknowledge:
    role: user|assistant|start
    tools: [...]  # Selected tools
    datasources: [...]  # Selected datasources
    model: "gpt-4"
  dialogBox:
    from:
      userId: "..."
      displayName: "You"
      avatar: "..."
    blocks:
      - block: RichText
        content: "..."
  activities:  # Tool execution history
    - type: toolCall
      title: { key: "executing_tool", params: { tool: "web_search" } }
      raw: { role: "assistant", tool_calls: [...] }
    - type: toolResult
      title: { key: "tool_result", params: { tool: "web_search" } }
      raw: { role: "tool", tool_call_id: "...", content: "..." }
```

### SSE Message Processing (`handleSSEMessage.yml`)

AI Store processes streaming responses from AI Knowledge through several payload types:

```
AI Knowledge (SSE Stream)
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              handleSSEMessage.yml                        │
│  ┌─────────────────────────────────────────────────────┐ │
│  │ payload.error      → Display toast, mark as error   │ │
│  │ payload.activity   → Add to meta.activities[]       │ │
│  │ payload.answer     → Update message content         │ │
│  │ payload.search     → Set sources for citations      │ │
│  │ payload.blocks     → Send via Dialog Box.SendBlock  │ │
│  │ payload.suggestions→ Store for UI display           │ │
│  │ payload.end        → Finalize message, persist      │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Key SSE Payload Types

| Payload Field | Handler | Effect |
|---------------|---------|--------|
| `error` | Toast + error state | Shows error message, stops processing |
| `activity` | `meta.activities[]` | Displays tool execution progress |
| `answer` | Message content | Updates streamed response text |
| `search.results` | `meta.aiknowledge.sources` | Populates citations panel |
| `suggestedQuestions` | `meta.suggestions` | Shows follow-up question buttons |
| `blocks` | `Dialog Box.SendBlock` | **Injects interactive UI blocks** |
| `end` | `updateMessage` | Persists final message to database |

#### Interactive Blocks via SSE

AI Knowledge can inject interactive blocks into the conversation via the `blocks` payload:

```yaml
# In handleSSEMessage.yml
- conditions:
    '{{payload.blocks}} and isArray({{payload.blocks}})':
      - repeat:
          'on': '{{payload.blocks}}'
          do:
            - set:
                name: item
                type: merge
                value:
                  from: '{{meta.dialogBox.from}}'
                  target:
                    userTopic: conversation:{{conversationId}}
            - Dialog Box.SendBlock: '{{item}}'
```

**Supported block types:**
- `RichText` - Formatted text/HTML
- `Action` - Buttons with event triggers
- `Form` - Input forms with validation
- `DataTable` - Tabular data display
- Any custom block defined in the workspace

#### Activities Display

Tool activities are accumulated and stored for display:

```yaml
# Activity accumulation
- conditions:
    '{{payload.activity}}':
      - conditions:
          isArray({{payload.activity}}):
            - set:
                name: meta.activities
                type: merge
                value: '{{payload.activity}}'
          default:
            - set:
                name: meta.activities
                type: push
                value: '{{payload.activity}}'
```

The `AssistantMessage` custom block renders these activities as collapsible sections showing tool calls and results.

---

### Real-time Updates

AI Store uses WebSocket topics for real-time updates:
- `conversation:{id}` - Per-conversation updates
- `assistant:{id}` - Per-agent updates

Created via:
```yaml
- createUserTopic:
    topic: conversation:{{conversationId}}
    userIds:
      - '{{user.id}}'
- joinUserTopic:
    topic: assistant:{{assistantId}}
    userIds:
      - '{{user.id}}'
```

---

## Security (RBAC)

From `security.yml`:

| Role | Capabilities |
|------|--------------|
| **public** | Read pages with `public` label (view shared conversations) |
| **user** | Read all pages, upload files |
| **editor** | Update workspaces/pages/apps, manage files, read/create events |
| **workspace** | Full API access via API key |

Key rules:
- Anyone can upload files and create events
- Users can only read events from their own session
- Editors cannot read apikey-related events

---

## Agent Properties Reference

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | AI Knowledge project ID |
| `name` | localized | Agent display name |
| `description` | localized | Agent description |
| `img` | url | Main agent image |
| `avatar` | url | Response avatar (falls back to img) |
| `prompt` | string | System instructions (from ai.prompt) |
| `model` | string | Default model (from ai.model) |
| `starters` | string[] | Suggested questions |
| `welcome` | localized | Initial message |
| `warning` | html | Warning message |
| `fallbackAnswer` | localized | Fallback when AI fails |
| `unlisted` | boolean | Hide from store |
| `hideExplore` | boolean | Hide "Back to Store" |
| `hideModels` | boolean | Disable model picker |
| `hideSidebar` | boolean | Hide conversation list |
| `disablePublicSharing` | boolean | Disable share feature |
| `disableCallAgents` | boolean | Disable @mentions |
| `canEdit` | boolean | User has edit permission |
| `tools` | array | Available tools |

---

## Best Practices

### For Agent Creators

1. **Clear Purpose** - Define specific agent function in the prompt
2. **Detailed Instructions** - Comprehensive prompt with examples
3. **Connect Knowledge** - Link relevant AI Knowledge datasources
4. **Right Model** - Match model to task complexity
5. **Test Thoroughly** - Try various user scenarios
6. **Set Guardrails** - Configure fallback answer and warnings

### For Administrators

1. **Use Categories** - Organize agents by function/domain
2. **Review Visibility** - Control who can access which agents
3. **Monitor Analytics** - Track usage and costs
4. **Version Control** - Use AI Knowledge versioning for agent changes

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Agent not found | Check AI Knowledge project exists and is accessible |
| Knowledge base not used | Verify datasources connected in AI Knowledge |
| Tools not invoked | Check tool configuration in AI Knowledge project |
| Quality issues | Adjust prompt, model, or temperature in AI Knowledge |
| Conversation not loading | Check Conversations Service App configuration |
| Sharing not working | Verify `disablePublicSharing` is not set |
| Analytics empty | Ensure date range includes activity period |

---

## Integration Points

### With AI Knowledge
- Projects = Agents
- Query endpoint = Chat responses
- Datasources = RAG context
- Tools = Agent capabilities

### With SecureChat
- Agents accessible as specialized chats
- Same conversation model

### With Builder
- Create advanced agents with custom automations
- Extend agent capabilities via webhooks

### With Governance
- Access control via workspace security rules
- User roles determine edit permissions

### With Insights
- Analytics data from AI Knowledge events
- Token usage, costs, carbon footprint
