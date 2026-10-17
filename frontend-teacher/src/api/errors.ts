// Shared: changes need a PR note and a teammate review.
// Purpose: error thrown when a booking rule blocks an action. The real backend should answer 4xx with { code, message }.
import type { RuleCode } from '../types'

export class RuleError extends Error {
  code: RuleCode

  constructor(code: RuleCode, message: string) {
    super(message)
    this.name = 'RuleError'
    this.code = code
  }
}
