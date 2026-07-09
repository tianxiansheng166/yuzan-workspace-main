import { describe, expect, it } from "vitest";
import {
  TranslationError,
  TranslationGateway,
} from "../../app/features/tibetan-translation/TranslationGateway";

describe("TranslationGateway", () => {
  it("returns translation result on successful API response", async () => {
    const fetchMock = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ target: "khyed rang bde mo" }),
      }) as Response;

    const gateway = new TranslationGateway({
      baseUrl: "http://localhost:4000/api/v1",
      fetch: fetchMock,
    });

    const result = await gateway.translate({
      text: "你好",
      direction: "zh-to-bo",
    });

    expect(result.source).toBe("你好");
    expect(result.target).toBe("khyed rang bde mo");
    expect(result.direction).toBe("zh-to-bo");
    expect(result.isLocalPhrase).toBe(false);
  });

  it("throws TranslationError when response is not ok", async () => {
    const fetchMock = async () =>
      ({
        ok: false,
        status: 503,
      }) as Response;

    const gateway = new TranslationGateway({
      baseUrl: "http://localhost:4000/api/v1",
      fetch: fetchMock,
    });

    await expect(
      gateway.translate({ text: "你好", direction: "zh-to-bo" }),
    ).rejects.toBeInstanceOf(TranslationError);
  });

  it("throws TranslationError for empty input", async () => {
    const gateway = new TranslationGateway({
      baseUrl: "http://localhost:4000/api/v1",
    });

    await expect(
      gateway.translate({ text: "   ", direction: "zh-to-bo" }),
    ).rejects.toBeInstanceOf(TranslationError);
  });

  it("throws TranslationError when fetch fails", async () => {
    const fetchMock = async () => {
      throw new Error("Network error");
    };

    const gateway = new TranslationGateway({
      baseUrl: "http://localhost:4000/api/v1",
      fetch: fetchMock,
    });

    await expect(
      gateway.translate({ text: "你好", direction: "zh-to-bo" }),
    ).rejects.toBeInstanceOf(TranslationError);
  });

  it("throws TranslationError when response target is missing", async () => {
    const fetchMock = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ target: "" }),
      }) as Response;

    const gateway = new TranslationGateway({
      baseUrl: "http://localhost:4000/api/v1",
      fetch: fetchMock,
    });

    await expect(
      gateway.translate({ text: "你好", direction: "zh-to-bo" }),
    ).rejects.toBeInstanceOf(TranslationError);
  });
});
