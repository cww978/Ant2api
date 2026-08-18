import { StorageService } from './storage.js';
import { config } from '../config.js';

export const SUPPORTED_UPSTREAM_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-pro',
  'gemini-3.7-thinking'
];

export class ModelRouterService {
  private static instance: ModelRouterService;
  private storage: StorageService;

  private constructor() {
    this.storage = StorageService.getInstance();
  }

  public static getInstance(): ModelRouterService {
    if (!ModelRouterService.instance) {
      ModelRouterService.instance = new ModelRouterService();
    }
    return ModelRouterService.instance;
  }

  /**
   * Resolves a client requested model name to the target upstream model name
   */
  public resolveModel(requestedModel?: string): { mappedModel: string; originalModel: string } {
    if (!requestedModel) {
      return { mappedModel: config.defaultModel, originalModel: config.defaultModel };
    }

    const mappings = this.storage.getModelMappings();
    const cleanRequested = requestedModel.trim().toLowerCase();

    // Check exact or case-insensitive match
    const matched = mappings.find(m => m.enabled && m.sourceModel.toLowerCase() === cleanRequested);
    if (matched) {
      return {
        mappedModel: matched.targetModel,
        originalModel: requestedModel
      };
    }

    // Direct passthrough if it's already a valid gemini model or custom model
    return {
      mappedModel: requestedModel,
      originalModel: requestedModel
    };
  }

  /**
   * Returns the list of exposed models in OpenAI format
   */
  public getOpenAiModelsList() {
    const mappings = this.storage.getModelMappings().filter(m => m.enabled);
    const modelsSet = new Set<string>([...SUPPORTED_UPSTREAM_MODELS]);

    for (const m of mappings) {
      modelsSet.add(m.sourceModel);
    }

    return Array.from(modelsSet).map(modelId => ({
      id: modelId,
      object: 'model',
      created: 1700000000,
      owned_by: 'ant2api',
      permission: [],
      root: modelId,
      parent: null
    }));
  }
}
