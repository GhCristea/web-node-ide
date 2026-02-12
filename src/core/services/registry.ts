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

const services = new Map<string, unknown>()

export const registry = {
  register<T>(name: string, instance: T): void {
    services.set(name, instance)
  },

  get<T>(name: string): T {
    const instance = services.get(name)
    if (!instance) {
      throw new Error(`Service not registered: ${name}`)
    }
    return instance as T
  },

  has(name: string): boolean {
    return services.has(name)
  }
}

export async function initializeServices(): Promise<void> {
  const logger = new LoggerService()
  const notification = new NotificationService()
  const executor = new ExecutorService(logger)
  const filesystem = new FileSystemService()

  await filesystem.initialize()

  registry.register('logger', logger)
  registry.register('notification', notification)
  registry.register('executor', executor)
  registry.register('filesystem', filesystem)
}
