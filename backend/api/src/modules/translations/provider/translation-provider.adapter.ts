import { Injectable, Logger } from "@nestjs/common";
import { TranslationUnavailableException } from "../domain/translation.errors.js";
import { SupportedLanguage } from "../domain/translation.types.js";

export const TRANSLATION_PROVIDER = Symbol("TRANSLATION_PROVIDER");

export interface ProviderResult {
  readonly resultText: string;
  readonly requestId: string;
  readonly model: string;
  readonly latencyMs: number;
}

export interface TranslationProviderPort {
  translate(
    sourceLang: SupportedLanguage,
    targetLang: SupportedLanguage,
    text: string,
  ): Promise<ProviderResult>;
}

@Injectable()
export class ConfigurableTranslationProvider implements TranslationProviderPort {
  private readonly logger = new Logger(ConfigurableTranslationProvider.name);
  private readonly endpoint: string | null;
  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor() {
    this.endpoint = process.env.TRANSLATION_PROVIDER_ENDPOINT ?? null;
    this.apiKey = process.env.TRANSLATION_PROVIDER_API_KEY ?? null;
    this.model = process.env.TRANSLATION_PROVIDER_MODEL ?? "default";
    this.timeoutMs = Number.parseInt(
      process.env.TRANSLATION_PROVIDER_TIMEOUT_MS ?? "30000",
      10,
    );
  }

  async translate(
    sourceLang: SupportedLanguage,
    targetLang: SupportedLanguage,
    text: string,
  ): Promise<ProviderResult> {
    if (!this.endpoint || !this.apiKey) {
      throw new TranslationUnavailableException(
        "翻译服务提供商未配置",
      );
    }

    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          source_language: sourceLang,
          target_language: targetLang,
          text,
          model: this.model,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const status = response.status;

        if (status === 401 || status === 403) {
          this.logger.error("Translation provider authentication failed");
          throw new TranslationUnavailableException("翻译服务认证失败");
        }

        if (status === 429) {
          this.logger.warn("Translation provider quota exceeded");
          throw new TranslationUnavailableException("翻译服务配额已用尽");
        }

        if (status >= 500) {
          this.logger.error(
            `Translation provider server error: ${status}`,
          );
          throw new TranslationUnavailableException("翻译服务不可用");
        }

        throw new TranslationUnavailableException(
          `翻译服务返回错误: ${status}`,
        );
      }

      const body = (await response.json()) as Record<string, unknown>;

      return {
        resultText: body.resultText as string,
        requestId: (body.requestId as string) ?? crypto.randomUUID(),
        model: (body.model as string) ?? this.model,
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      if (err instanceof TranslationUnavailableException) {
        throw err;
      }

      if ((err as Error).name === "AbortError") {
        this.logger.error("Translation provider request timed out");
        throw new TranslationUnavailableException("翻译服务请求超时");
      }

      this.logger.error(
        `Translation provider error: ${(err as Error).message}`,
      );
      throw new TranslationUnavailableException("翻译服务不可用");
    }
  }
}
