export class CognitiveOSError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CognitiveOSError";
  }
}

export function assert(condition: boolean, message: string, code: string): asserts condition {
  if (!condition) {
    throw new CognitiveOSError(message, code);
  }
}
