import { StorageService, AccountItem } from './storage.js';
import { BaseProvider } from '../providers/base.js';
import { AntigravityProvider } from '../providers/antigravity.js';
import { GeminiCliProvider } from '../providers/gemini-cli.js';

export class AccountPoolService {
  private static instance: AccountPoolService;
  private storage: StorageService;
  private roundRobinIndex = 0;

  private constructor() {
    this.storage = StorageService.getInstance();
  }

  public static getInstance(): AccountPoolService {
    if (!AccountPoolService.instance) {
      AccountPoolService.instance = new AccountPoolService();
    }
    return AccountPoolService.instance;
  }

  /**
   * Instantiates a provider instance from an AccountItem
   */
  public createProvider(account: AccountItem): BaseProvider {
    switch (account.type) {
      case 'antigravity':
      case 'google_oauth':
        return new AntigravityProvider(account);
      case 'gemini_cli':
      case 'gemini_api':
      default:
        return new GeminiCliProvider(account);
    }
  }

  public getEnabledAccountsCount(): number {
    return this.storage.getAccounts().filter(a => a.enabled).length;
  }

  /**
   * Selects an available account from the pool based on strategy
   */
  public getNextAccount(excludedIds: string[] = []): { account: AccountItem; provider: BaseProvider } {
    const allAccounts = this.storage.getAccounts();
    const enabledAccounts = allAccounts.filter(a => a.enabled && !excludedIds.includes(a.id));

    if (enabledAccounts.length === 0) {
      if (excludedIds.length > 0) {
        throw new Error('All candidate accounts in the pool failed.');
      }
      throw new Error('No accounts configured in Ant2api. Please add an Antigravity or Gemini account in the Web Dashboard.');
    }

    const now = Date.now();
    // Filter out accounts currently in cooldown
    const availableAccounts = enabledAccounts.filter(a => !a.cooldownUntil || a.cooldownUntil <= now);

    // Prefer accounts with valid API Key or zero consecutive errors
    const pool = availableAccounts.length > 0 ? availableAccounts : enabledAccounts;
    const settings = this.storage.getSettings();

    let selectedAccount: AccountItem;

    if (settings.loadBalanceStrategy === 'least_errors') {
      selectedAccount = pool.reduce((prev, curr) => (curr.consecutiveErrors < prev.consecutiveErrors ? curr : prev), pool[0]);
    } else if (settings.loadBalanceStrategy === 'random') {
      selectedAccount = pool[Math.floor(Math.random() * pool.length)];
    } else {
      // Default: round_robin among healthiest candidates first
      // Sort candidates so accounts with apiKey or lower consecutive errors come first
      const sorted = [...pool].sort((a, b) => {
        const aScore = (a.apiKey ? 0 : 5) + (a.consecutiveErrors || 0);
        const bScore = (b.apiKey ? 0 : 5) + (b.consecutiveErrors || 0);
        return aScore - bScore;
      });
      this.roundRobinIndex = (this.roundRobinIndex + 1) % sorted.length;
      selectedAccount = sorted[this.roundRobinIndex];
    }

    return {
      account: selectedAccount,
      provider: this.createProvider(selectedAccount)
    };
  }

  /**
   * Reports request success for an account
   */
  public reportSuccess(accountId: string) {
    const account = this.storage.getAccountById(accountId);
    if (!account) return;

    account.totalRequests = (account.totalRequests || 0) + 1;
    account.consecutiveErrors = 0;
    account.lastUsedAt = Date.now();
    account.cooldownUntil = undefined;
    this.storage.saveAccount(account);
  }

  /**
   * Reports request error for an account, applying cooldown on rate-limit
   */
  public reportError(accountId: string, error: any) {
    const account = this.storage.getAccountById(accountId);
    if (!account) return;

    account.failedRequests = (account.failedRequests || 0) + 1;
    account.consecutiveErrors = (account.consecutiveErrors || 0) + 1;
    account.lastUsedAt = Date.now();

    const errMessage = String(error?.message || error || '');
    const isRateLimit = errMessage.includes('429') || errMessage.toLowerCase().includes('quota') || errMessage.toLowerCase().includes('rate limit');
    const isAuthError = errMessage.includes('401') || errMessage.includes('403') || errMessage.toLowerCase().includes('unauthorized');

    const settings = this.storage.getSettings();
    const cooldownSecs = settings.maxCooldownSeconds || 60;

    if (isRateLimit || isAuthError || account.consecutiveErrors >= 3) {
      account.cooldownUntil = Date.now() + cooldownSecs * 1000;
      console.warn(`[AccountPool] Account "${account.name}" placed on cooldown until ${new Date(account.cooldownUntil).toISOString()} due to error: ${errMessage}`);
    }

    this.storage.saveAccount(account);
  }
}
