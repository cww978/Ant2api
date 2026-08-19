export class ThoughtSignatureCache {
  private static cache = new Map<string, string>();
  private static MAX_CACHE_SIZE = 1000;

  /**
   * Saves an authentic Google thought_signature associated with a tool call ID and function name
   */
  public static save(toolCallId: string | undefined, functionName: string | undefined, signature: string | undefined) {
    if (!signature || typeof signature !== 'string' || signature.trim().length === 0) return;
    const cleanSig = signature.trim();

    // Prevent memory leaks by capping cache size
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    if (toolCallId) {
      this.cache.set(toolCallId, cleanSig);
    }
    if (functionName) {
      this.cache.set(`func:${functionName}`, cleanSig);
      const cleanName = functionName.includes(':') ? functionName.split(':').pop()! : functionName;
      this.cache.set(`func:${cleanName}`, cleanSig);
    }
  }

  /**
   * Retrieves a cached authentic thought_signature for a given tool call ID or function name.
   * Returns undefined if no authentic signature was recorded (never returns a fake signature).
   */
  public static get(toolCallId?: string, functionName?: string): string | undefined {
    if (toolCallId && this.cache.has(toolCallId)) {
      return this.cache.get(toolCallId);
    }
    if (functionName) {
      if (this.cache.has(`func:${functionName}`)) {
        return this.cache.get(`func:${functionName}`);
      }
      const cleanName = functionName.includes(':') ? functionName.split(':').pop()! : functionName;
      if (this.cache.has(`func:${cleanName}`)) {
        return this.cache.get(`func:${cleanName}`);
      }
    }
    return undefined;
  }
}
