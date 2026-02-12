export interface FileService {
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  listDirectory(path: string): Promise<string[]>
  deleteFile(path: string): Promise<void>
}

export interface ExecutionService {
  executeCode(code: string): Promise<{ stdout: string; stderr: string }>
  stopExecution(): Promise<void>
}

export interface NotificationService {
  success(message: string): void
  error(message: string): void
  info(message: string): void
}

export interface LoggerService {
  log(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
}

export interface StorageService {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}
