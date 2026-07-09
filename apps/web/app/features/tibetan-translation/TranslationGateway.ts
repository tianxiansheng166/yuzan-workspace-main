import type { TranslationRequest, TranslationResult } from "./types";

export interface TranslationGatewayOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export class TranslationError extends Error {
  constructor(
    message: string,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = "TranslationError";
  }
}

/**
 * 藏汉翻译网关。
 *
 * 当前实现仅负责调用远端翻译 API；未接入 API 时返回空结果（不做伪翻译），
 * 由上层根据本地教学短语兜底。
 */
export class TranslationGateway {
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(private readonly options: TranslationGatewayOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async translate(request: TranslationRequest): Promise<TranslationResult> {
    if (!request.text.trim()) {
      throw new TranslationError("请输入需要翻译的内容");
    }

    try {
      const response = await this.fetchImpl(
        `${this.options.baseUrl}/translations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        },
      );

      if (!response.ok) {
        throw new TranslationError(
          `翻译服务暂不可用（${response.status}），请稍后重试`,
        );
      }

      const data = (await response.json()) as {
        target: string;
        model?: string;
        confidence?: number;
      };

      if (!data.target || typeof data.target !== "string") {
        throw new TranslationError("翻译结果格式异常");
      }

      return {
        source: request.text,
        target: data.target,
        direction: request.direction,
        isLocalPhrase: false,
        meta: {
          model: data.model,
          confidence: data.confidence,
        },
      };
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }
      throw new TranslationError(
        "翻译服务未接入或网络异常，已切换到本地短语模式",
        error,
      );
    }
  }
}
