import type * as db from '../db'

export interface IDEDependencies {
  db: typeof db
  terminal: { write: (data: string) => void }
}
