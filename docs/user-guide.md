# FlowRunner User Guide

## Overview

FlowRunner is a node-based workflow execution extension for Visual Studio Code. Design workflows visually, connect nodes, and execute them directly from the editor.

## Getting Started

1. Open VS Code and install the FlowRunner extension
2. Click the **FlowRunner** icon in the Activity Bar (left sidebar)
3. Click **Create Flow** in the Flow List panel
4. Design your workflow in the visual editor
5. Click **Execute** (▶) to run the flow

## Flow Editor

### Canvas

- **Pan**: Right-click drag or scroll wheel
- **Zoom**: Ctrl/Cmd + scroll wheel
- **Add Node**: Drag a node from the Node Palette (left panel)
- **Connect Nodes**: Drag from an output port to an input port
- **Disconnect**: Select an edge and press Delete
- **Each input port accepts only one connection** — connecting a new edge replaces the existing one

### Selection & Clipboard

| Shortcut | Action |
|----------|--------|
| Click | Select a single node |
| Shift + Click | Add/remove node from selection |
| Drag (on canvas) | Rectangle selection |
| Cmd/Ctrl + A | Select all nodes |
| Cmd/Ctrl + C | Copy selected nodes & edges |
| Cmd/Ctrl + V | Paste |
| Cmd/Ctrl + X | Cut |
| Cmd/Ctrl + D | Duplicate |
| Delete / Backspace | Delete selected nodes |
| Escape | Deselect all |
| Cmd/Ctrl + Z | Undo |
| Cmd/Ctrl + Shift + Z | Redo |

> Shortcuts are disabled when editing text fields (input, textarea, select).

### Toolbar

| Button | Action |
|--------|--------|
| ▶ Execute | Save & run the flow |
| 🐛 Debug | Save & start debug mode |
| ⇶ Auto Layout (LR) | Arrange nodes left-to-right. If 2+ nodes are selected, only selected nodes are arranged |
| ⇵ Auto Layout (TB) | Arrange nodes top-to-bottom. If 2+ nodes are selected, only selected nodes are arranged |
| ┃ Align X | Align selected nodes vertically (unify X coordinate) |
| ━ Align Y | Align selected nodes horizontally (unify Y coordinate) |

### Context Menu

Right-click on the canvas, a node, or an edge to access context menu options including Auto Layout, Delete, and more.

### Property Panel

Select a node to view and edit its properties in the right panel. Each node type has specific settings fields.

### Output Panel

After execution, select a node to view its output in the right panel (Output tab). Error details are also shown here.

---

## Node Types

### Basic

#### Trigger

Starting point of a flow. Required as the first node.

| Setting | Description |
|---------|-------------|
| Trigger Type | **Manual** (default), **File Change Watch**, **Schedule** |
| File Pattern | Glob pattern for file watching (e.g., `**/*.ts`) |
| Debounce (ms) | Delay for consecutive file changes (default: 500) |
| Interval (sec) | Schedule execution interval (default: 60, min: 5) |

#### Command

Execute a shell command.

| Setting | Description |
|---------|-------------|
| Command | Shell command to execute. Supports `{{input}}`, `{{vars.xxx}}` templates |
| Working Directory | Command execution directory |
| Shell | Shell to use (default, bash, zsh, sh, cmd, pwsh) |
| Environment Variables | Key-value pairs for environment variables |
| Timeout (sec) | Execution timeout (0 = no limit) |

Output ports: **stdout**, **stderr**

#### Log

Output a message to the FlowRunner output channel.

| Setting | Description |
|---------|-------------|
| Message | Log message. Supports `{{input}}`, `{{input.xxx}}`, `{{vars.xxx}}` templates |
| Level | info, warn, error |

### Control

#### Condition

Branch the flow based on an expression.

| Setting | Description |
|---------|-------------|
| Expression | jexl expression. `input` and `vars.xxx` are available |

Output ports: **True**, **False**

Example expressions:
- `input.length > 0`
- `input.status === "ok"`
- `vars.count > 10`

#### Loop

Repeat execution of downstream nodes.

| Setting | Description |
|---------|-------------|
| Loop Type | **Count** (N times), **Condition** (while), **List** (forEach) |
| Count | Number of iterations (body receives index: 0, 1, 2, ...) |
| Expression | jexl expression for condition/list mode. `input`, `index`, `vars.xxx` available |

Output ports: **body** (loop iteration), **done** (after loop)

#### Parallel

Execute multiple branches simultaneously.

Output ports: **branch1**, **branch2**, **branch3**, **done** (after all branches complete)

#### SubFlow

Execute another flow as a sub-flow.

| Setting | Description |
|---------|-------------|
| Flow | Select a flow to execute |
| Output Node | Select which terminal node's output to use (optional) |

#### TryCatch

Error handling wrapper.

Output ports: **try** (normal execution), **catch** (on error), **done** (always)

### Data

#### HTTP Request

Make HTTP requests.

| Setting | Description |
|---------|-------------|
| URL | Request URL. Supports `{{input}}`, `{{vars.xxx}}` templates |
| Method | GET, POST, PUT, DELETE, PATCH |
| Headers | Key-value pairs |
| Body | Request body. Supports templates |
| Auth | none, bearer |
| Token | Bearer token |
| Timeout (sec) | Request timeout (default: 30) |

Output ports: **body** (response), **status** (status code)

#### File

File system operations.

| Setting | Description |
|---------|-------------|
| Operation | read, write, append, delete, exists, listDir |
| Path | File path. Supports `{{input}}`, `{{vars.xxx}}` templates |
| Encoding | utf-8, ascii, base64 |

#### Transform

Data transformation operations.

| Setting | Description |
|---------|-------------|
| Transform Type | jsonParse, jsonStringify, textReplace, textSplit, textJoin, regex, template, jsExpression, **setVar**, **getVar** |
| Expression | Template or jexl expression |
| Variable Name | For setVar/getVar: shared variable name |
| Default Value | For getVar: fallback value |

### AI

#### AI Prompt

Send prompts to AI language models available in VS Code.

| Setting | Description |
|---------|-------------|
| Prompt | Prompt text. Supports `{{input}}`, `{{input.xxx}}`, `{{vars.xxx}}` templates |
| Model | Select from available language models |

Output ports: **response** (AI response text), **token usage** (usage statistics)

### Other

#### Comment

Non-executable annotation node for documentation purposes.

---

## Template Syntax

Many nodes support template strings for dynamic values:

| Template | Description | Example |
|----------|-------------|---------|
| `{{input}}` | Previous node's output (full value) | `echo {{input}}` |
| `{{input.xxx}}` | Property of the previous node's output | `{{input.name}}` |
| `{{vars.xxx}}` | Shared variable (set via Transform setVar) | `{{vars.apiKey}}` |

## Expression Syntax (jexl)

Condition, Loop (condition mode), and Transform (jsExpression) nodes use **jexl** expressions:

```
input.length > 0
input.status === "ok"
vars.count > 10
input|upper
input|length > 5
```

Available transforms: `length`, `upper`, `lower`, `trim`, `keys`, `values`, `string`, `number`

---

## Shared Variables

Use **Transform** nodes with `setVar`/`getVar` to share data between nodes:

1. Add a **Transform** node, set type to **setVar**
2. Set **Variable Name** (e.g., `myData`)
3. The input value is stored as a shared variable
4. Later nodes can access it via `{{vars.myData}}` in templates or `vars.myData` in expressions
5. Use **getVar** to retrieve the variable value as node output

---

## Triggers

### Manual
Default mode. Flow runs when you click Execute.

### File Change Watch
Flow runs automatically when files matching the glob pattern change.

1. Set **Trigger Type** to "File Change Watch"
2. Set **File Pattern** (e.g., `**/*.ts`)
3. Right-click the flow in the Flow List → **Activate Trigger**
4. The flow executes when matching files change
5. Right-click → **Deactivate Trigger** to stop

### Schedule
Flow runs at regular intervals.

1. Set **Trigger Type** to "Schedule"
2. Set **Interval** in seconds
3. Activate via right-click context menu

---

## Debug Mode

1. Click 🐛 **Debug** in the toolbar
2. The flow executes step by step
3. Use **Step** to advance to the next node
4. Intermediate results are shown during execution
5. Click **Stop** to end the debug session

---

## Flow Management

### Commands (Command Palette)

| Command | Description |
|---------|-------------|
| FlowRunner: Create Flow | Create a new empty flow |
| FlowRunner: Create Flow from Template | Create a flow from a saved template |
| FlowRunner: Save Flow as Template | Save the current flow as a reusable template |
| FlowRunner: Export Flow | Export flow to a JSON file |
| FlowRunner: Import Flow | Import flow from a JSON file |
| FlowRunner: Execute Flow | Execute the current flow |
| FlowRunner: Debug Flow | Start debug mode |

### Copilot Chat Integration

Use `@flowrunner` in Copilot Chat:

- `@flowrunner /run <flow-name>` — Execute a flow by name
- `@flowrunner /list` — List available flows
- `@flowrunner /create <description>` — Create a flow from a natural language description

---

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `flowrunner.autoSave` | Auto-save flow definitions | `true` |
| `flowrunner.historyMaxCount` | Max execution history per flow | `50` |

---

## Execution History

Past execution results are stored and accessible from the Flow List panel. Each record includes:
- Execution timestamp
- Status (success/error)
- Duration
- Per-node results and outputs
