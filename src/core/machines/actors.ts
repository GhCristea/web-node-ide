import { fromPromise } from 'xstate'
import { registry } from '../services'
import type { LoggerService } from '../services'
import type { ExecutionService, FileService } from '../services/types'

export const fileActors = {
  'load-file': fromPromise(async ({ input }: { input: { path: string } }) => {
    const fileService = registry.get<FileService>('file')
    const logger = registry.get<LoggerService>('logger')

    logger.log(`[Actor] Loading file: ${input.path}`)
    const content = await fileService.readFile(input.path)
    logger.log(`[Actor] Loaded ${content.length} bytes`)

    return { path: input.path, content }
  }),

  'save-file': fromPromise(async ({ input }: { input: { path: string; content: string } }) => {
    const fileService = registry.get<FileService>('file')
    const logger = registry.get<LoggerService>('logger')

    logger.log(`[Actor] Saving file: ${input.path}`)
    await fileService.writeFile(input.path, input.content)
    logger.log(`[Actor] Saved ${input.content.length} bytes`)

    return { path: input.path, timestamp: Date.now() }
  }),

  'list-directory': fromPromise(async ({ input }: { input: { path: string } }) => {
    const fileService = registry.get<FileService>('file')
    const logger = registry.get<LoggerService>('logger')

    logger.log(`[Actor] Listing directory: ${input.path}`)
    const files = await fileService.listDirectory(input.path)
    logger.log(`[Actor] Found ${files.length} files`)

    return { path: input.path, files }
  }),

  'delete-file': fromPromise(async ({ input }: { input: { path: string } }) => {
    const fileService = registry.get<FileService>('file')
    const logger = registry.get<LoggerService>('logger')

    logger.log(`[Actor] Deleting file: ${input.path}`)
    await fileService.deleteFile(input.path)
    logger.log(`[Actor] Deleted`)

    return { path: input.path, timestamp: Date.now() }
  })
}

export const executionActors = {
  'execute-code': fromPromise(async ({ input }: { input: { code: string } }) => {
    const executionService = registry.get<ExecutionService>('execution')
    const logger = registry.get<LoggerService>('logger')

    logger.log('[Actor] Starting code execution')
    const result = await executionService.executeCode(input.code)
    logger.log(`[Actor] Execution complete: exitCode=${result.stderr}`)

    return result
  })
}

export const allActors = { ...fileActors, ...executionActors }
