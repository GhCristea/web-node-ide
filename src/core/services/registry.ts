/**
 * Service registry - dependency injection container.
 * Singleton pattern for service instances.
 */

import { LoggerService } from './logger'
import { NotificationService } from './notification'
import { ExecutorService } from './executor'
import { FileSystemService } from './filesystem'

export interface ServiceRegistry {
  logger: LoggerService
  notification: NotificationService
  executor: ExecutorService
  filesystem: FileSystemService
}

class ServiceContainer {
  private services: Map<string, any> = new Map()

  register<T>(name: string, instance: T): void {
    this.services.set(name, instance)
  }

  get<T>(name: string): T {
    const instance = this.services.get(name)
    if (!instance) {
      throw new Error(`Service not registered: ${name}`)
    }
    return instance as T
  }

  has(name: string): boolean {
    return this.services.has(name)
  }
}

// Global singleton instance
export const registry = new ServiceContainer()

/**
 * Initialize all services.
 * Call once at app startup before creating any machines.
 */
export async function initializeServices(): Promise<void> {
  const logger = new LoggerService()
  const notification = new NotificationService()
  const executor = new ExecutorService(logger)
  const filesystem = new FileSystemService()

  // Initialize services that need async setup
  await filesystem.initialize()

  // Register in container
  registry.register('logger', logger)
  registry.register('notification', notification)
  registry.register('executor', executor)
  registry.register('filesystem', filesystem)
}
