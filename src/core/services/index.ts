/**
 * Service bootstrap and public API.
 * Initialize all services at app startup.
 */

import { registry } from './registry';
import { FileServiceImpl } from './file-service';
import { ExecutionServiceImpl } from './execution-service';
import { NotificationServiceImpl } from './notification-service';
import { LoggerServiceImpl } from './logger-service';

export * from './types';
export * from './registry';
export * from './file-service';
export * from './execution-service';
export * from './notification-service';
export * from './logger-service';

/**
 * Initialize all core services.
 * Call this once at app startup, before creating any machines.
 */
export function initializeServices(): void {
  registry.register('file', new FileServiceImpl());
  registry.register('execution', new ExecutionServiceImpl());
  registry.register('notification', new NotificationServiceImpl());
  registry.register('logger', new LoggerServiceImpl());
}
