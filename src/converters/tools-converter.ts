import { GeminiToolDeclaration, GeminiContentPart } from '../providers/base.js';

export class ToolsConverter {
  /**
   * Cleans and sanitizes JSON Schema for Google Gemini Function Declarations
   */
  public static sanitizeSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;

    // Handle anyOf / oneOf / allOf by taking the primary branch
    if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
      return ToolsConverter.sanitizeSchema(schema.anyOf[0]);
    }
    if (schema.oneOf && Array.isArray(schema.oneOf) && schema.oneOf.length > 0) {
      return ToolsConverter.sanitizeSchema(schema.oneOf[0]);
    }
    if (schema.allOf && Array.isArray(schema.allOf) && schema.allOf.length > 0) {
      return ToolsConverter.sanitizeSchema(schema.allOf[0]);
    }

    const cleaned: any = {};
    for (const [key, value] of Object.entries(schema)) {
      // Filter out unsupported JSON Schema meta properties
      if (['$schema', 'additionalProperties', 'default', 'pattern', 'format', 'title'].includes(key)) {
        continue;
      }

      if (key === 'type') {
        if (typeof value === 'string') {
          cleaned.type = value.toUpperCase();
        } else if (Array.isArray(value)) {
          const firstNonEmpty = value.find((v: any) => v && v !== 'null') || value[0] || 'STRING';
          cleaned.type = String(firstNonEmpty).toUpperCase();
        }
      } else if (key === 'properties' && value && typeof value === 'object') {
        cleaned.properties = {};
        for (const [propKey, propVal] of Object.entries(value as Record<string, any>)) {
          cleaned.properties[propKey] = ToolsConverter.sanitizeSchema(propVal);
        }
      } else if (key === 'items' && value && typeof value === 'object') {
        cleaned.items = ToolsConverter.sanitizeSchema(value);
      } else if (key === 'required' && Array.isArray(value)) {
        cleaned.required = value;
      } else if (key === 'enum' && Array.isArray(value)) {
        cleaned.enum = value.map(v => String(v));
      } else if (key === 'description' && typeof value === 'string') {
        cleaned.description = value;
      }
    }

    if (!cleaned.type) {
      if (cleaned.properties) cleaned.type = 'OBJECT';
      else if (cleaned.items) cleaned.type = 'ARRAY';
      else cleaned.type = 'STRING';
    }

    return cleaned;
  }

  /**
   * Converts OpenAI / Codex tools array to Gemini tool declarations with stable sorting and sanitized schema
   */
  public static openAiToolsToGemini(tools?: any[]): GeminiToolDeclaration[] | undefined {
    if (!tools || !Array.isArray(tools) || tools.length === 0) return undefined;

    const functionDeclarations: any[] = [];
    for (const tool of tools) {
      if (tool.function) {
        functionDeclarations.push({
          name: tool.function.name,
          description: tool.function.description || '',
          parameters: ToolsConverter.sanitizeSchema(tool.function.parameters || { type: 'OBJECT', properties: {} })
        });
      } else if (tool.name) {
        functionDeclarations.push({
          name: tool.name,
          description: tool.description || '',
          parameters: ToolsConverter.sanitizeSchema(tool.parameters || tool.input_schema || { type: 'OBJECT', properties: {} })
        });
      }
    }

    if (functionDeclarations.length === 0) return undefined;

    // Stable alphabetical sort by function name to maximize prefix caching efficiency
    functionDeclarations.sort((a, b) => a.name.localeCompare(b.name));
    return [{ functionDeclarations }];
  }

  /**
   * Converts Claude tools array to Gemini tool declarations
   */
  public static claudeToolsToGemini(tools?: any[]): GeminiToolDeclaration[] | undefined {
    if (!tools || !Array.isArray(tools) || tools.length === 0) return undefined;

    const functionDeclarations: any[] = [];
    for (const tool of tools) {
      if (tool.name) {
        functionDeclarations.push({
          name: tool.name,
          description: tool.description || '',
          parameters: ToolsConverter.sanitizeSchema(tool.input_schema || { type: 'OBJECT', properties: {} })
        });
      }
    }

    if (functionDeclarations.length === 0) return undefined;

    functionDeclarations.sort((a, b) => a.name.localeCompare(b.name));
    return [{ functionDeclarations }];
  }

  /**
   * Converts Gemini functionCall parts to OpenAI tool_calls
   */
  public static geminiPartsToOpenAiToolCalls(parts: GeminiContentPart[]): any[] | undefined {
    const toolCalls: any[] = [];
    let callIdx = 0;

    for (const part of parts) {
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${Math.random().toString(36).substring(2, 10)}_${callIdx++}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {})
          }
        });
      }
    }

    return toolCalls.length > 0 ? toolCalls : undefined;
  }

  /**
   * Converts Gemini functionCall parts to Claude content blocks
   */
  public static geminiPartsToClaudeContentBlocks(parts: GeminiContentPart[]): any[] {
    const blocks: any[] = [];
    let callIdx = 0;

    for (const part of parts) {
      if (part.text) {
        blocks.push({
          type: 'text',
          text: part.text
        });
      }
      if (part.functionCall) {
        blocks.push({
          type: 'tool_use',
          id: `toolu_${Math.random().toString(36).substring(2, 10)}_${callIdx++}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {}
        });
      }
    }

    return blocks;
  }
}
