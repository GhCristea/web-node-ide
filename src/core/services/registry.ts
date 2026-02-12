/**
 * Central service registry for dependency injection.
 * Singleton pattern ensures single instance across app lifecycle.
 */

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services = new Map<string, unknown>();

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  register<T = unknown>(key: string, service: T): void {
    this.services.set(key, service);
  }

  get<T = unknown>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service "${key}" not registered. Available: ${Array.from(this.services.keys()).join(', ')}`);
    }
    return service as T;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.services);
  }

  clear(): void {
    this.services.clear();
  }
}

export const registry = ServiceRegistry.getInstance();
