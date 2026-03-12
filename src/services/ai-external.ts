/**
 * 外部 AI 适配器 - 支持 Replicate、OpenAI 等
 * @see docs/tasklist.md 阶段 4.3
 */

import { TagResult, EmbedResult } from "./ai.js";

export type AIProvider = "workers-ai" | "replicate" | "openai";

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
}

export interface ExternalAIConfig {
  replicate?: {
    apiKey: string;
  };
  openai?: {
    apiKey: string;
    model?: string;
  };
}

export interface AIProviderAdapter {
  tagImage(imageData: ArrayBuffer): Promise<TagResult>;
  embedText(text: string): Promise<EmbedResult>;
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed";
  error?: string;
  output?: Record<string, number> | number[];
}

interface OpenAIResponse {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  data?: Array<{
    embedding: number[];
  }>;
}

export class ReplicateAdapter implements AIProviderAdapter {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async tagImage(imageData: ArrayBuffer): Promise<TagResult> {
    const base64 = this.arrayBufferToBase64(imageData);
    
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "05a115e2253617e7e42bc9d7e0ef93780f3cf01e6594e6c9e0a9d4f4c2e9a3a",
        input: { image: base64 },
      }),
    });

    const prediction = await response.json() as ReplicatePrediction;

    if (prediction.status === "failed") {
      throw new Error(`Replicate prediction failed: ${prediction.error}`);
    }

    if (prediction.status === "starting" || prediction.status === "processing") {
      await this.waitForPrediction(prediction.id);
    }

    const result = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { "Authorization": `Token ${this.apiKey}` },
    });
    const finalResult = await result.json() as ReplicatePrediction;

    const tags: string[] = [];
    const confidences: number[] = [];
    
    if (finalResult.output) {
      for (const [label, prob] of Object.entries(finalResult.output)) {
        tags.push(label);
        confidences.push(prob as number);
      }
    }

    return { tags, confidences };
  }

  async embedText(text: string): Promise<EmbedResult> {
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "b6b7588c0869ea7776dd7c2d5c4b937a1c3eb0cc8c563c7d80f6a6b11e1a1e",
        input: { text },
      }),
    });

    const prediction = await response.json() as ReplicatePrediction;

    if (prediction.status === "failed") {
      throw new Error(`Replicate prediction failed: ${prediction.error}`);
    }

    if (prediction.status === "starting" || prediction.status === "processing") {
      await this.waitForPrediction(prediction.id);
    }

    const result = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { "Authorization": `Token ${this.apiKey}` },
    });
    const finalResult = await result.json() as ReplicatePrediction;

    return {
      embedding: finalResult.output as number[],
      dimensions: (finalResult.output as number[]).length,
    };
  }

  private async waitForPrediction(predictionId: string): Promise<void> {
    while (true) {
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { "Authorization": `Token ${this.apiKey}` },
      });
      const prediction = await response.json() as ReplicatePrediction;

      if (prediction.status === "succeeded") break;
      if (prediction.status === "failed") break;

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export class OpenAIAdapter implements AIProviderAdapter {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = "gpt-4o") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async tagImage(imageData: ArrayBuffer): Promise<TagResult> {
    const base64 = this.arrayBufferToBase64(imageData);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image and provide a list of tags with confidence scores. Return as JSON array with label and probability." },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    const result = await response.json() as OpenAIResponse;
    const content = result.choices?.[0]?.message?.content || "";

    try {
      const parsed = JSON.parse(content);
      const tags = parsed.map((p: any) => p.label);
      const confidences = parsed.map((p: any) => p.probability);
      return { tags, confidences };
    } catch {
      const lines = content.split("\n").filter((l: string) => l.trim());
      const tags = lines.map((l: string) => l.replace(/^-\s*/, "").trim());
      return { tags, confidences: tags.map(() => 0.5) };
    }
  }

  async embedText(text: string): Promise<EmbedResult> {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    const result = await response.json() as OpenAIResponse;
    const embedding = result.data?.[0]?.embedding || [];

    return { embedding, dimensions: embedding.length };
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

export function createExternalAIAdapter(config: AIProviderConfig): AIProviderAdapter {
  switch (config.provider) {
    case "replicate":
      return new ReplicateAdapter(config.apiKey!);
    case "openai":
      return new OpenAIAdapter(config.apiKey!);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}
