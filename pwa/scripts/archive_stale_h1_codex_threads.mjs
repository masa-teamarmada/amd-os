#!/usr/bin/env node

import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import { createInterface } from 'node:readline'
import path from 'node:path'

const DEFAULT_SESSIONS_ROOT = '/Users/masa/.codex/sessions'
const DEFAULT_APP_SERVER_BIN = '/Applications/ChatGPT.app/Contents/Resources/codex'
const AUTOMATION_CWD = '/Users/masa/projects/AMD/amd-os-automation-sessions'
const TARGET_AUTOMATION_IDS = new Set([
  'amd-os-l6-meeting-flow',
  'amd-os-h-1-meeting-reviewer',
])

function parseArgs(argv) {
  const options = {
    sessionsRoot: DEFAULT_SESSIONS_ROOT,
    appServerBin: DEFAULT_APP_SERVER_BIN,
    maxAgeMinutes: 35,
    threadId: null,
    dryRun: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (arg === '--sessions-root') {
      options.sessionsRoot = argv[++index]
      continue
    }
    if (arg === '--app-server-bin') {
      options.appServerBin = argv[++index]
      continue
    }
    if (arg === '--max-age-minutes') {
      options.maxAgeMinutes = Number(argv[++index])
      continue
    }
    if (arg === '--thread-id') {
      options.threadId = argv[++index]
      continue
    }
    throw new Error(`unknown argument: ${arg}`)
  }

  if (!Number.isFinite(options.maxAgeMinutes) || options.maxAgeMinutes < 1) {
    throw new Error('--max-age-minutes must be a positive number')
  }
  if (options.threadId && !/^[0-9a-f-]{36}$/i.test(options.threadId)) {
    throw new Error('--thread-id must be a Codex thread UUID')
  }

  return options
}

function recentDateDirectories(root, now = new Date()) {
  const directories = []
  for (let offset = 0; offset <= 1; offset += 1) {
    const date = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000)
    const year = String(date.getFullYear())
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    directories.push(path.join(root, year, month, day))
  }
  return [...new Set(directories)]
}

async function listSessionFiles(root) {
  const files = []
  for (const directory of recentDateDirectories(root)) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }
    for (const entry of entries) {
      if (entry.isFile() && /^rollout-.*\.jsonl$/.test(entry.name)) {
        files.push(path.join(directory, entry.name))
      }
    }
  }
  return files
}

function inputText(message) {
  if (message?.type !== 'message' || message.role !== 'user') return ''
  return (message.content ?? [])
    .filter((item) => item?.type === 'input_text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
}

async function readAutomationSession(file) {
  const stream = createReadStream(file, { encoding: 'utf8' })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  let metadata = null
  let automationId = null
  let lineCount = 0

  try {
    for await (const line of lines) {
      lineCount += 1
      if (lineCount > 40) break

      let record
      try {
        record = JSON.parse(line)
      } catch {
        continue
      }

      if (record?.type === 'session_meta') {
        metadata = {
          id: record.payload?.id,
          timestamp: record.payload?.timestamp,
          cwd: record.payload?.cwd,
        }
      }

      if (record?.type === 'response_item') {
        const text = inputText(record.payload)
        for (const candidate of TARGET_AUTOMATION_IDS) {
          if (text.includes(`Automation ID: ${candidate}`)) {
            automationId = candidate
            break
          }
        }
      }

      if (metadata && automationId) break
    }
  } finally {
    lines.close()
    stream.destroy()
  }

  if (
    !metadata?.id ||
    !metadata?.timestamp ||
    metadata.cwd !== AUTOMATION_CWD ||
    !automationId
  ) {
    return null
  }

  return { ...metadata, automationId, file }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForSocket(socketPath, child, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`temporary app-server exited with code ${child.exitCode}`)
    }
    try {
      await stat(socketPath)
      return
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
    await wait(50)
  }
  throw new Error('temporary app-server socket timed out')
}

function websocketTextFrame(text) {
  const payload = Buffer.from(text)
  const mask = crypto.randomBytes(4)
  let header

  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length])
  } else if (payload.length <= 65_535) {
    header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 0x80 | 126
    header.writeUInt16BE(payload.length, 2)
  } else {
    throw new Error('watchdog request frame is too large')
  }

  const masked = Buffer.alloc(payload.length)
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4]
  }
  return Buffer.concat([header, mask, masked])
}

function readFrame(buffer) {
  if (buffer.length < 2) return null
  const opcode = buffer[0] & 0x0f
  const isMasked = Boolean(buffer[1] & 0x80)
  let payloadLength = buffer[1] & 0x7f
  let offset = 2

  if (payloadLength === 126) {
    if (buffer.length < 4) return null
    payloadLength = buffer.readUInt16BE(2)
    offset = 4
  } else if (payloadLength === 127) {
    if (buffer.length < 10) return null
    const longLength = buffer.readBigUInt64BE(2)
    if (longLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('watchdog response frame is too large')
    }
    payloadLength = Number(longLength)
    offset = 10
  }

  let mask = null
  if (isMasked) {
    if (buffer.length < offset + 4) return null
    mask = buffer.subarray(offset, offset + 4)
    offset += 4
  }
  if (buffer.length < offset + payloadLength) return null

  let payload = buffer.subarray(offset, offset + payloadLength)
  if (mask) {
    payload = Buffer.from(payload.map((value, index) => value ^ mask[index % 4]))
  }
  return {
    opcode,
    payload,
    rest: buffer.subarray(offset + payloadLength),
  }
}

function archiveThroughSocket(socketPath, sessionIds, timeoutMs = 12_000) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    const key = crypto.randomBytes(16).toString('base64')
    const requestIds = new Map(sessionIds.map((sessionId, index) => [index + 2, sessionId]))
    const archived = []
    const errors = []
    let buffer = Buffer.alloc(0)
    let handshakeComplete = false

    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('thread/archive RPC timed out'))
    }, timeoutMs)

    function finish() {
      if (archived.length + errors.length !== sessionIds.length) return
      clearTimeout(timeout)
      socket.end()
      resolve({ archived, errors })
    }

    function handleMessage(text) {
      let message
      try {
        message = JSON.parse(text.trim())
      } catch {
        return
      }
      if (!requestIds.has(message.id)) return
      const sessionId = requestIds.get(message.id)
      requestIds.delete(message.id)
      if (message.error) {
        errors.push({ sessionId, error: message.error.message ?? 'thread/archive failed' })
      } else {
        archived.push(sessionId)
      }
      finish()
    }

    function parseFrames() {
      while (true) {
        const frame = readFrame(buffer)
        if (!frame) return
        buffer = frame.rest
        if (frame.opcode === 0x01) handleMessage(frame.payload.toString('utf8'))
      }
    }

    socket.on('connect', () => {
      socket.write([
        'GET / HTTP/1.1',
        'Host: localhost',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n'))
    })

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data])
      if (!handshakeComplete) {
        const headerEnd = buffer.indexOf('\r\n\r\n')
        if (headerEnd < 0) return
        const statusLine = buffer.subarray(0, headerEnd).toString('utf8').split('\r\n')[0]
        if (!statusLine.includes(' 101 ')) {
          clearTimeout(timeout)
          socket.destroy()
          reject(new Error(`websocket upgrade failed: ${statusLine}`))
          return
        }
        buffer = buffer.subarray(headerEnd + 4)
        handshakeComplete = true

        const requests = [
          {
            id: 1,
            method: 'initialize',
            params: {
              clientInfo: { name: 'h1-thread-watchdog', version: '1' },
              capabilities: { experimentalApi: true },
            },
          },
          ...[...requestIds].map(([id, sessionId]) => ({
            id,
            method: 'thread/archive',
            params: { threadId: sessionId },
          })),
        ]
        for (const request of requests) {
          socket.write(websocketTextFrame(`${JSON.stringify(request)}\n`))
        }
      }
      parseFrames()
    })

    socket.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

async function archiveSessions(appServerBin, sessionIds) {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'codex-h1-watchdog-'))
  const socketPath = path.join(tempDirectory, 'app.sock')
  let stderr = ''
  const child = spawn(appServerBin, ['app-server', '--listen', `unix://${socketPath}`], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    if (stderr.length < 4_000) stderr += chunk
  })

  try {
    await waitForSocket(socketPath, child)
    return await archiveThroughSocket(socketPath, sessionIds)
  } catch (error) {
    const suffix = stderr.trim() ? `; app-server: ${stderr.trim().slice(-1_000)}` : ''
    throw new Error(`${error.message}${suffix}`)
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM')
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      wait(2_000),
    ])
    await rm(tempDirectory, { recursive: true, force: true })
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const now = new Date()
  const files = await listSessionFiles(options.sessionsRoot)
  const matched = []
  const archived = []
  const errors = []

  for (const file of files) {
    let session
    try {
      session = await readAutomationSession(file)
    } catch (error) {
      errors.push({ file: path.basename(file), error: error.message })
      continue
    }
    if (!session) continue

    const startedAt = new Date(session.timestamp)
    const ageMinutes = (now.getTime() - startedAt.getTime()) / 60_000
    if (options.threadId && session.id !== options.threadId) continue
    if (
      !options.threadId &&
      (!Number.isFinite(ageMinutes) || ageMinutes < options.maxAgeMinutes)
    ) continue

    matched.push({
      sessionId: session.id,
      automationId: session.automationId,
      ageMinutes: Math.floor(ageMinutes),
    })

  }

  if (!options.dryRun && matched.length > 0) {
    try {
      const result = await archiveSessions(
        options.appServerBin,
        matched.map((item) => item.sessionId),
      )
      archived.push(...result.archived)
      errors.push(...result.errors)
    } catch (error) {
      errors.push({ error: error.message })
    }
  }

  const result = {
    checkedAt: now.toISOString(),
    maxAgeMinutes: options.maxAgeMinutes,
    requestedThreadId: options.threadId,
    dryRun: options.dryRun,
    scannedFiles: files.length,
    matched,
    archived,
    errors,
  }
  process.stdout.write(`${JSON.stringify(result)}\n`)

  if (errors.length > 0) process.exitCode = 1
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ error: error.message })}\n`)
  process.exitCode = 1
})
