export class ThoughtSignatureCache {
  private static cache = new Map<string, string>();
  private static MAX_CACHE_SIZE = 1000;

  /**
   * Saves an authentic Google thought_signature associated with a tool call ID and function name
   */
  public static save(toolCallId: string | undefined, functionName: string | undefined, signature: string | undefined) {
    if (!signature) return;
    
    // Prevent memory leaks by capping cache size
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    if (toolCallId) {
      this.cache.set(toolCallId, signature);
    }
    if (functionName) {
      this.cache.set(`func:${functionName}`, signature);
    }
  }

  /**
   * Retrieves a cached authentic thought_signature for a given tool call ID or function name
   */
  public static get(toolCallId?: string, functionName?: string): string | undefined {
    if (toolCallId && this.cache.has(toolCallId)) {
      return this.cache.get(toolCallId);
    }
    if (functionName && this.cache.has(`func:${functionName}`)) {
      return this.cache.get(`func:${functionName}`);
    }
    return undefined;
  }
}
