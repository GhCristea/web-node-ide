# Execution Backends: Web Worker → Docker → Lambda

**Status**: Architecture documented, Web Worker implemented, Docker stub ready.

## Architecture

The IDE supports **pluggable execution backends** via `ExecutorService` interface:

```typescript
export interface ExecutorService {
  execute(code: string, options?: ExecutionOptions): Promise<ExecutionResult>
  terminate(): void
}
```

This allows swapping execution strategies **without UI changes**:

```
UI Layer
   ↓
   registry.get('executor')  ← Interface-based, not tied to implementation
   ↓
   ┌─────────────────────────────────────┐
   │ Choose Backend:                     │
   ├─────────────────────────────────────┤
   │ • Web Worker (current)              │
   │ • Remote Server (HTTP POST)         │
   │ • Docker Container                  │
   │ • AWS Lambda                        │
   │ • Kubernetes Pod                    │
   └─────────────────────────────────────┘
```

---

## 1. Web Worker (Current)

**Location**: `src/core/workers/executor.worker.ts`  
**Service**: `src/core/services/executor.ts`

### Pros
- ✅ No infrastructure required
- ✅ Works offline
- ✅ Instant feedback
- ✅ Supports async/await

### Cons
- ❌ Runs in browser context (limited APIs)
- ❌ Limited memory (~500MB typical)
- ❌ No filesystem access
- ❌ Potential security risk if user code escapes sandbox

### Security Considerations

**Current Limitations:**
- User code runs with full JavaScript capabilities
- Can access DOM, storage, cookies (if not isolated)
- Cannot access file system (good)
- Cannot make arbitrary network calls (good)

**To Improve Web Worker Security:**

```typescript
// Sandbox approach using iframe
class IframeExecutorService implements ExecutorService {
  private iframe: HTMLIFrameElement

  async execute(code: string): Promise<ExecutionResult> {
    // Create isolated iframe with limited permissions
    const blob = new Blob([`
      self.onmessage = async (e) => {
        const result = await (new Function('return ' + e.data))()
        self.postMessage(result)
      }
    `], { type: 'application/javascript' })
    
    const url = URL.createObjectURL(blob)
    this.iframe = document.createElement('iframe')
    this.iframe.src = url
    // Sandbox restrictions: no-same-origin, no-scripts, etc.
    this.iframe.sandbox.add('allow-scripts')
    
    // Send code, wait for result
    // ...
  }
}
```

---

## 2. Remote Server Backend (HTTP)

**Location**: `src/core/services/remote-executor.ts`  
**Status**: Interface stub ready

### Use Case
When you want:
- Real Node.js APIs (fs, path, crypto)
- npm packages (installed on server)
- Long-running processes
- GPU acceleration
- Production security

### Implementation

**Frontend (already implemented):**
```typescript
const logger = registry.get('logger')
const executor = new RemoteExecutorService(
  logger,
  'https://executor-api.example.com'
)
registry.register('executor', executor)
```

**Backend (Express example):**
```typescript
import express from 'express'
import { spawn } from 'child_process'

const app = express()

app.post('/api/execute', async (req, res) => {
  const { code, timeout, env } = req.body

  try {
    // Validate code (e.g., no require('fs').rm('/'))
    validateCode(code)

    const result = await executeCode(code, timeout, env)
    res.json(result)
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

async function executeCode(code, timeout, env) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['-e', code], {
      env: { ...process.env, ...env },
      timeout,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => { stdout += data })
    proc.stderr.on('data', (data) => { stderr += data })

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code })
    })

    proc.on('error', (error) => {
      reject(error)
    })
  })
}

app.listen(3000)
```

### Security for Remote Execution

**Rate limiting:**
```typescript
const rateLimit = require('express-rate-limit')
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30 // 30 requests per minute
})
app.post('/api/execute', limiter, ...)
```

**Code validation (AST parsing):**
```typescript
import * as acorn from 'acorn'

function validateCode(code: string) {
  try {
    const ast = acorn.parse(code)
    // Reject fs, require, eval, etc.
    if (hasRiskyNodes(ast)) {
      throw new Error('Code contains restricted operations')
    }
  } catch (error) {
    throw new Error('Invalid code')
  }
}

function hasRiskyNodes(ast: any): boolean {
  // Check AST for: require(), fs operations, eval, etc.
  // This is a simplified check
  const code = JSON.stringify(ast)
  return /require|eval|exec|fs\.|import/i.test(code)
}
```

**Timeout & resource limits:**
```typescript
const proc = spawn('node', ['-e', code], {
  timeout: 5000, // 5 second timeout
  maxBuffer: 1024 * 1024, // 1MB output max
  stdio: ['pipe', 'pipe', 'pipe']
})
```

---

## 3. Docker Container Backend

**Status**: Ready for implementation  
**Example**: `src/core/services/remote-executor.ts` (contains Docker code example)

### Use Case
- Complete isolation per execution
- Guaranteed resource limits
- Multiple language support (Python, Go, Rust)
- Fail-safe: container dies, nothing escapes

### Implementation

```typescript
app.post('/api/execute', async (req, res) => {
  const { code, timeout, env } = req.body

  try {
    // Create isolated container
    const container = await docker.createContainer({
      Image: 'node:18-alpine',
      Cmd: ['node', '-e', code],
      Env: Object.entries(env).map(([k, v]) => `${k}=${v}`),
      HostConfig: {
        // Resource limits
        Memory: 512 * 1024 * 1024, // 512MB
        MemorySwap: 512 * 1024 * 1024, // No swap
        CpuShares: 1024, // CPU weight
        NetworkMode: 'none', // No network access
        AutoRemove: true // Clean up after exit
      }
    })

    await container.start()

    // Wait for completion with timeout
    const result = await container.wait({ condition: 'next-exit' })

    // Get logs
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      follow: false
    })

    // Parse stdout/stderr
    const output = logs.toString('utf8')

    res.json({
      stdout: output,
      stderr: '',
      exitCode: result.StatusCode
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

### Security
- **Network isolated**: `NetworkMode: 'none'`
- **Memory capped**: 512MB limit
- **CPU throttled**: CpuShares weight
- **Auto-removed**: No orphaned containers
- **Read-only filesystem** (optional):
  ```typescript
  HostConfig: {
    ReadonlyRootfs: true,
    Tmpfs: { '/tmp': 'size=100m' }
  }
  ```

---

## 4. AWS Lambda Backend

**Status**: Future (architectural pattern ready)

### Use Case
- Serverless billing
- Autoscaling
- No infrastructure management

### Rough Implementation

```typescript
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

class LambdaExecutorService implements ExecutorService {
  private lambda = new LambdaClient()

  async execute(code: string, options?: ExecutionOptions) {
    const response = await this.lambda.send(
      new InvokeCommand({
        FunctionName: 'code-executor',
        InvocationType: 'RequestResponse',
        Payload: JSON.stringify({ code, timeout: options?.timeout })
      })
    )

    const payload = JSON.parse(
      new TextDecoder().decode(response.Payload)
    )

    return {
      stdout: payload.stdout,
      stderr: payload.stderr,
      exitCode: payload.exitCode
    }
  }
}
```

---

## Migration Path

### Phase 1: Web Worker (Current) ✅
```bash
npm install
npm run dev
# Works offline, instant feedback
```

### Phase 2: Add Remote Executor
```bash
# Backend setup
cd backend
npm install express express-rate-limit
node server.js

# Frontend: Swap executor
const executor = new RemoteExecutorService(logger, 'http://localhost:3000')
registry.register('executor', executor)
```

### Phase 3: Docker (Production)
```bash
# Build Docker image
docker build -t code-executor .
docker run -d -p 3000:3000 code-executor

# No frontend changes needed!
```

### Phase 4: Lambda (Scale)
```bash
# Deploy Lambda function
sam build && sam deploy

# Frontend: Point to Lambda endpoint
const executor = new RemoteExecutorService(
  logger,
  'https://lambda-executor.example.com'
)
registry.register('executor', executor)
```

---

## Testing Backends

```bash
# Test Web Worker
npm run test

# Test with remote server (start server first)
DOCKER_API_URL=http://localhost:3000 npm run test

# Test with Docker backend
USE_DOCKER=true npm run test
```

---

## Switching Backends (Runtime)

```typescript
// In src/main.ts
const executorType = process.env.EXECUTOR_BACKEND || 'web-worker'

let executor: ExecutorService

switch (executorType) {
  case 'remote':
    executor = new RemoteExecutorService(
      logger,
      process.env.EXECUTOR_API_URL || 'http://localhost:3000'
    )
    break

  case 'docker':
    executor = new DockerExecutorService(logger)
    break

  case 'lambda':
    executor = new LambdaExecutorService(logger)
    break

  default:
    executor = new ExecutorService(logger)
}

registry.register('executor', executor)
```

---

## Comparison Table

| Feature | Web Worker | Remote | Docker | Lambda |
|---------|-----------|--------|--------|--------|
| **Setup** | Zero | Easy | Medium | Hard |
| **Isolation** | Low | Medium | High | Very High |
| **Cost** | Free | $$ | $$$ | $$$$ (but scale) |
| **Security** | Low | Medium | High | High |
| **APIs** | Limited | Full Node.js | Full OS | AWS only |
| **Offline** | ✅ | ❌ | ❌ | ❌ |
| **Latency** | <50ms | 100-500ms | 500ms-2s | 1-5s |
| **Scaling** | Browser limit | Manual | Auto | Auto |

---

## Recommended Path for Production

1. **Start**: Web Worker (development)
2. **Grow**: Remote HTTP backend (Node.js server)
3. **Scale**: Docker containers (with orchestration)
4. **Enterprise**: Kubernetes + monitoring

**Why?** Each tier adds security/isolation but increases complexity. Start simple, add infrastructure as needed.
