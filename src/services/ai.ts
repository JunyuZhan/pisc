/**
 * AI 服务 - 图片打标与文本向量化
 * @see docs/tasklist.md 阶段 4
 */

export interface TagResult {
  tags: string[];
  confidences: number[];
}

export interface EmbedResult {
  embedding: number[];
  dimensions: number;
}

const TAGGING_MODEL = "@cf/mobilenet/v1.0";
const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
const EMBEDDING_DIMENSIONS = 768;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;

interface MobilenetPrediction {
  label: string;
  probability: number;
}

interface MobilenetResult {
  predictions: MobilenetPrediction[];
}

interface BgeResult {
  shape: number[];
  data: number[][];
}

export class AIService {
  private env: Env;
  private tokenBucket: TokenBucket;
  private confidenceThreshold: number;

  constructor(env: Env, confidenceThreshold = 0.1) {
    this.env = env;
    this.tokenBucket = new TokenBucket(10, 1);
    this.confidenceThreshold = confidenceThreshold;
  }

  async tagImage(imageData: ArrayBuffer): Promise<TagResult> {
    await this.tokenBucket.acquire();

    const result = await this.runWithRetry<MobilenetResult>(async () => {
      return await (this.env.AI as any).run(TAGGING_MODEL, {
        image: Array.from(new Uint8Array(imageData)),
      }) as MobilenetResult;
    });

    const predictions = result.predictions;
    
    const tags: string[] = [];
    const confidences: number[] = [];

    for (const pred of predictions) {
      if (pred.probability > this.confidenceThreshold) {
        tags.push(pred.label);
        confidences.push(pred.probability);
      }
    }

    return { tags, confidences };
  }

  async embedText(text: string): Promise<EmbedResult> {
    await this.tokenBucket.acquire();

    const result = await this.runWithRetry<BgeResult>(async () => {
      return await (this.env.AI as any).run(EMBEDDING_MODEL, {
        text: text,
      }) as BgeResult;
    });

    const embedding = result.data[0];
    
    return {
      embedding,
      dimensions: EMBEDDING_DIMENSIONS,
    };
  }

  async generateTagsFromLabels(labels: string[]): Promise<number[]> {
    const text = labels.join(", ");
    const result = await this.embedText(text);
    return result.embedding;
  }

  private async runWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        const isRateLimit = error?.message?.includes("429") || 
                           error?.message?.includes("rate limit") ||
                           error?.message?.includes("Rate limit");
        
        if (isRateLimit) {
          this.tokenBucket.refund();
          const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        if (attempt === MAX_RETRIES - 1) {
          throw error;
        }
        
        const delay = RETRY_DELAY_BASE * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}

class TokenBucket {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    const waitTime = (1 - this.tokens) / this.refillRate * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
    
    this.refill();
    this.tokens -= 1;
  }

  refund(): void {
    this.tokens = Math.min(this.maxTokens, this.tokens + 1);
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

export function createAIService(env: Env): AIService {
  return new AIService(env);
}
