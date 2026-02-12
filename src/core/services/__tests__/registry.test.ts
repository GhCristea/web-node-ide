/**
 * Integration tests for ServiceRegistry.
 * Verifies that services are correctly instantiated and registered.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ServiceRegistry } from '../registry'
import { LoggerService } from '../logger'
import { ExecutorService } from '../executor'
import { FileSystemService } from '../filesystem'
import { NotificationService } from '../notification'

describe('ServiceRegistry', () => {
  let registry: ServiceRegistry

  beforeEach(() => {
    registry = new ServiceRegistry()
  })

  it('should register and retrieve a service', () => {
    const logger = new LoggerService()
    registry.register('logger', logger)

    const retrieved = registry.get('logger')
    expect(retrieved).toBe(logger)
  })

  it('should throw when retrieving unregistered service', () => {
    expect(() => registry.get('nonexistent')).toThrow(
      'Service "nonexistent" not registered'
    )
  })

  it('should register multiple services', () => {
    const logger = new LoggerService()
    const executor = new ExecutorService(logger)
    const notification = new NotificationService()

    registry.register('logger', logger)
    registry.register('executor', executor)
    registry.register('notification', notification)

    expect(registry.get('logger')).toBe(logger)
    expect(registry.get('executor')).toBe(executor)
    expect(registry.get('notification')).toBe(notification)
  })

  it('should allow service replacement', () => {
    const logger1 = new LoggerService()
    const logger2 = new LoggerService()

    registry.register('logger', logger1)
    expect(registry.get('logger')).toBe(logger1)

    registry.register('logger', logger2)
    expect(registry.get('logger')).toBe(logger2)
  })

  it('should initialize all services', async () => {
    const logger = new LoggerService()
    registry.register('logger', logger)

    // After initialization, FileSystemService should have IndexedDB ready
    const fs = new FileSystemService()
    await fs.initialize()
    registry.register('filesystem', fs)

    const retrieved = registry.get('filesystem')
    expect(retrieved).toBe(fs)
  })

  it('should support dependency injection pattern', () => {
    // Setup: Logger -> Executor -> Consumer
    const logger = new LoggerService()
    const executor = new ExecutorService(logger)

    registry.register('logger', logger)
    registry.register('executor', executor)

    // Consumer retrieves executor from registry, executor has logger
    const ex = registry.get('executor') as ExecutorService
    expect(ex).toBe(executor)
  })
})

describe('Full Service Stack Integration', () => {
  let registry: ServiceRegistry
  let logger: LoggerService
  let executor: ExecutorService
  let filesystem: FileSystemService
  let notification: NotificationService

  beforeEach(async () => {
    registry = new ServiceRegistry()

    // Initialize services in dependency order
    logger = new LoggerService()
    executor = new ExecutorService(logger)
    filesystem = new FileSystemService()
    notification = new NotificationService()

    // Register in registry
    registry.register('logger', logger)
    registry.register('executor', executor)
    registry.register('filesystem', filesystem)
    registry.register('notification', notification)

    // Initialize filesystem
    await filesystem.initialize()
  })

  it('should have all services wired correctly', () => {
    // Verify each service is registered
    expect(registry.get('logger')).toBeInstanceOf(LoggerService)
    expect(registry.get('executor')).toBeInstanceOf(ExecutorService)
    expect(registry.get('filesystem')).toBeInstanceOf(FileSystemService)
    expect(registry.get('notification')).toBeInstanceOf(NotificationService)
  })

  it('should execute code through executor service', async () => {
    const executor = registry.get('executor') as ExecutorService

    const result = await executor.execute('console.log("hello")')
    expect(result.stdout).toContain('hello')
    expect(result.exitCode).toBe(0)
  })

  it('should handle execution errors gracefully', async () => {
    const executor = registry.get('executor') as ExecutorService

    try {
      await executor.execute('throw new Error("test error")')
      expect.fail('Should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('test error')
    }
  })

  it('should support filesystem operations', async () => {
    const fs = registry.get('filesystem') as FileSystemService

    // Write a file
    await fs.writeFile('/test-file.js', 'console.log("test")')

    // Read it back
    const content = await fs.readFile('/test-file.js', 'utf-8')
    expect(content).toBe('console.log("test")')

    // Clean up
    await fs.rm('/test-file.js')
  })

  it('should support service swapping pattern', async () => {
    // Original executor
    const originalExecutor = registry.get('executor')

    // Create new executor (simulating swap to RemoteExecutorService)
    const logger = registry.get('logger')
    const newExecutor = new ExecutorService(logger as LoggerService)
    registry.register('executor', newExecutor)

    // Verify swap
    const swapped = registry.get('executor')
    expect(swapped).toBe(newExecutor)
    expect(swapped).not.toBe(originalExecutor)
  })
})
