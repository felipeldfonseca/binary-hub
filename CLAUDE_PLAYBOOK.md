# CLAUDE CODE PLAYBOOK 🚀

*Your comprehensive guide to mastering Claude Code in the terminal*

## Table of Contents
1. [Quick Start](#quick-start)
2. [Essential Commands](#essential-commands)
3. [Keyboard Shortcuts](#keyboard-shortcuts)
4. [Slash Commands](#slash-commands)
5. [MCP Integration](#mcp-integration)
6. [Multi-Agent Workflows](#multi-agent-workflows)
7. [Advanced Techniques](#advanced-techniques)
8. [Pro Tips](#pro-tips)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Installation
```bash
npm install -g @anthropic-ai/claude-code
```

### First Run
```bash
claude
```

### Initialize Project
```bash
claude /init
```
This creates a CLAUDE.md file with project-specific guidance.

---

## Essential Commands

### Core Usage
```bash
claude                           # Start interactive session
claude "Build a login component"  # One-off command
claude --continue               # Resume last conversation
claude --resume                 # Pick conversation to resume
claude --help                  # Show help
```

### Input/Output Control
```bash
echo "Fix this bug" | claude     # Pipe input
claude --output json            # JSON output
claude --output streaming-json  # Streaming JSON
claude --no-stream             # Disable streaming
```

### Model Selection
```bash
claude --model sonnet          # Use Claude 3.5 Sonnet
claude --model haiku           # Use Claude 3 Haiku
claude --model opus            # Use Claude 3 Opus
```

---

## Keyboard Shortcuts

### Essential Navigation
- `Ctrl+C` - Cancel current operation
- `Ctrl+D` - Exit Claude Code
- `Ctrl+L` - Clear terminal screen
- `Up/Down arrows` - Navigate command history
- `Esc` + `Esc` - Edit previous message

### Multiline Input
- `\` + `Enter` - Continue on new line (universal)
- `Option+Enter` - macOS multiline
- `Shift+Enter` - Alternative multiline

### Vim Mode (when enabled)
**Navigation:**
- `h/j/k/l` - Move left/down/up/right
- `w/e/b` - Move word forward/end/back
- `0/$` - Move to line start/end
- `gg/G` - Move to document start/end

**Editing:**
- `i/a` - Insert before/after cursor
- `x` - Delete character
- `dd` - Delete line
- `D` - Delete to line end
- `cw` - Change word
- `.` - Repeat last change

---

## Slash Commands

### Built-in Commands
```bash
/clear              # Clear conversation history
/help               # Show help
/config             # View/modify configuration
/status             # Check account status
/login              # Switch accounts
/logout             # Sign out

# Project Management
/add-dir            # Add working directories
/init               # Initialize project guide
/review             # Request code review
/memory             # Edit CLAUDE.md

# Diagnostics
/bug                # Report bugs
/cost               # Show token usage
/doctor             # Check installation
/pr_comments        # View PR comments

# Advanced
/compact [focus]    # Compact conversation
/permissions        # Manage access
/vim                # Enter vim mode
/terminal-setup     # Configure keybindings
```

### Custom Slash Commands

Create at project level:
```bash
mkdir -p .claude/commands
echo "Find all TODO comments in the codebase" > .claude/commands/todos.md
```

Create at user level:
```bash
mkdir -p ~/.claude/commands
echo "Run tests and show coverage report" > ~/.claude/commands/test-coverage.md
```

With arguments:
```bash
# In .claude/commands/deploy.md
Deploy the application to $ARGUMENTS environment
```

Usage:
```bash
/todos
/test-coverage
/deploy staging
```

---

## MCP Integration

### Setup MCP Server
```bash
claude mcp add database-server stdio ./mcp-server.js
claude mcp add api-server sse https://api.example.com/mcp
claude mcp list
```

### Configuration File (.mcp.json)
```json
{
  "servers": {
    "database": {
      "type": "stdio",
      "command": "node",
      "args": ["./mcp-db-server.js"]
    },
    "github": {
      "type": "http",
      "url": "https://github-mcp.example.com"
    }
  }
}
```

### Using MCP Resources
```bash
# Reference resources directly
claude "Analyze @database:sqlite://users.db and suggest optimizations"

# Use MCP-provided slash commands
/mcp__github__create_pr
/mcp__database__query_users
```

### Authentication
```bash
/mcp auth github  # Authenticate with GitHub MCP server
```

---

## Multi-Agent Workflows

### Parallel Development Sessions
```bash
# Terminal 1: Frontend work
cd frontend && claude --session frontend

# Terminal 2: Backend work  
cd backend && claude --session backend

# Terminal 3: Database work
cd database && claude --session db
```

### Git Worktree Strategy
```bash
# Create separate worktrees for different features
git worktree add ../feature-auth feature/auth
git worktree add ../feature-payments feature/payments

# Work on each feature in parallel
cd ../feature-auth && claude --session auth
cd ../feature-payments && claude --session payments
```

### Specialized Agent Roles
```bash
# Create role-specific commands
echo "You are a security expert. Review code for vulnerabilities" > .claude/commands/security-review.md
echo "You are a performance expert. Optimize this code" > .claude/commands/performance-audit.md
echo "You are a testing expert. Generate comprehensive tests" > .claude/commands/test-gen.md
```

### Workflow Orchestration
```bash
# Chain commands for complex workflows
claude "Analyze codebase, then /security-review, then /performance-audit, then /test-gen"
```

---

## Advanced Techniques

### Extended Thinking Mode
Trigger deep analysis with keywords:
```bash
claude "Think about the architecture of this system"
claude "Think harder about potential edge cases"
claude "Think more about scalability concerns"
```

### Image Analysis
```bash
# Analyze screenshots
claude "Analyze this UI mockup" --image screenshot.png

# Drag and drop images directly
# Or use Ctrl+V to paste from clipboard
```

### Memory Management
```bash
# Quick memory reference
claude "#users table structure"

# Edit project memory
/memory

# Add important context
echo "## Database Schema" >> CLAUDE.md
echo "Users table has columns: id, email, created_at" >> CLAUDE.md
```

### Context Optimization
```bash
# Compact long conversations
/compact focus on authentication bugs

# Clear unnecessary history
/clear
```

---

## Pro Tips

### 1. Project Setup Best Practices
```bash
# Always initialize new projects
claude /init

# Set up custom commands early
mkdir -p .claude/commands
echo "Run the development server with hot reload" > .claude/commands/dev.md
echo "Deploy to staging and run smoke tests" > .claude/commands/deploy-staging.md
```

### 2. Effective Prompting
```bash
# Be specific about context
claude "Fix the authentication bug in src/auth.js line 45"

# Use file references
claude "Refactor the UserService class to use async/await"

# Combine multiple requests
claude "Add error handling to the API, update tests, and document the changes"
```

### 3. Code Review Workflow
```bash
# Set up git hooks
echo "claude /review" > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# Review specific files
claude "Review the security implications of auth.js"
```

### 4. Debugging Strategies
```bash
# Analyze logs
tail -f app.log | claude "Monitor for errors and suggest fixes"

# Debug specific issues
claude "The user registration is failing. Check the database connections and validation logic"
```

### 5. Documentation Generation
```bash
# Auto-generate docs
claude "Generate API documentation for all endpoints in routes/"

# Update README
claude "Update the README with new installation instructions and features"
```

---

## Troubleshooting

### Common Issues

**Claude Code won't start:**
```bash
claude /doctor          # Check installation
npm install -g @anthropic-ai/claude-code --force
```

**Authentication problems:**
```bash
claude /logout
claude /login
```

**MCP server issues:**
```bash
claude mcp list         # Check server status
claude mcp get server-name
```

**Performance issues:**
```bash
claude /cost           # Check token usage
/compact               # Reduce conversation size
/clear                 # Start fresh
```

### Configuration Reset
```bash
# Reset all settings
rm -rf ~/.claude
claude /login
```

### Debug Mode
```bash
# Enable verbose logging
export CLAUDE_DEBUG=true
claude "Debug this issue"
```

---

## Advanced Configuration

### Environment Variables
```bash
export CLAUDE_API_KEY=your-key
export CLAUDE_MODEL=sonnet
export CLAUDE_DEBUG=true
export CLAUDE_NO_STREAM=true
```

### Custom Hooks
```bash
# Pre-commit hook
echo '#!/bin/bash
claude "Review these changes for issues" $(git diff --cached --name-only)
' > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Integration with Other Tools
```bash
# With tmux
tmux new-session -d -s claude 'claude'

# With screen
screen -S claude claude

# With VS Code
code --command workbench.action.terminal.sendSequence --args "claude\n"
```

---

## Quick Reference Card

**Essential Commands:**
- `claude` - Start session
- `claude --continue` - Resume last
- `/init` - Initialize project
- `/clear` - Clear history
- `Ctrl+C` - Cancel operation
- `Ctrl+D` - Exit

**Power User Commands:**
- `/compact focus on X` - Optimize context
- `/memory` - Edit project memory
- `#keyword` - Quick memory reference  
- `/vim` - Enter vim mode
- `claude mcp add` - Add MCP server

**Pro Workflows:**
- Use `--session name` for parallel work
- Create custom slash commands
- Leverage MCP for external integrations
- Use extended thinking for complex problems
- Implement git hooks for automated reviews

---

*Happy coding with Claude! 🎯*