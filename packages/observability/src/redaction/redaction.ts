const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "passcode",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "apikey",
  "clientsecret",
  "audio",
  "audiocontent",
  "recording",
  "studentname",
  "studentanswer",
  "answertext",
  "prompt",
  "transcript",
]);

const URL_SENSITIVE_PARAMS = [
  "token",
  "access_token",
  "code",
  "password",
  "secret",
];

const CENSOR = "[REDACTED]";

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase());
}

export interface RedactionOptions {
  maxDepth?: number;
  censor?: string;
}

interface RedactionState {
  depth: number;
  options: Required<RedactionOptions>;
  seen: WeakSet<object>;
}

export function redactValue(
  value: unknown,
  state: RedactionState = createState(),
): unknown {
  if (state.depth > state.options.maxDepth) {
    return "[MAX_DEPTH_REACHED]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactQueryString(value, state.options.censor);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if (state.seen.has(value)) {
      return "[CIRCULAR]";
    }
    state.seen.add(value);

    if (value instanceof Error) {
      return redactError(value, state);
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        redactValue(item, { ...state, depth: state.depth + 1 }),
      );
    }

    return redactObject(value as Record<string, unknown>, state);
  }

  return state.options.censor;
}

function createState(options: RedactionOptions = {}): RedactionState {
  return {
    depth: 0,
    options: {
      maxDepth: options.maxDepth ?? 32,
      censor: options.censor ?? CENSOR,
    },
    seen: new WeakSet<object>(),
  };
}

function redactObject(
  obj: Record<string, unknown>,
  state: RedactionState,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      result[key] = state.options.censor;
    } else {
      result[key] = redactValue(val, {
        ...state,
        depth: state.depth + 1,
      });
    }
  }
  return result;
}

function redactError(
  error: Error,
  state: RedactionState,
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: error.name,
    message: state.options.censor,
  };

  if (error.cause instanceof Error) {
    result.cause = redactError(error.cause, {
      ...state,
      depth: state.depth + 1,
    });
  } else if (error.cause !== undefined) {
    result.cause = redactValue(error.cause, {
      ...state,
      depth: state.depth + 1,
    });
  }

  return result;
}

export function redactHeaders(
  headers: Record<string, unknown>,
  options?: RedactionOptions,
): Record<string, unknown> {
  return redactValue(headers, createState(options)) as Record<string, unknown>;
}

export function redactQueryString(url: string, censor = CENSOR): string {
  try {
    const parsed = new URL(url, "http://localhost");
    const params: [string, string][] = Array.from(
      new URLSearchParams(parsed.search).entries(),
    );
    let changed = false;
    for (const entry of params) {
      const [key] = entry;
      if (URL_SENSITIVE_PARAMS.includes(key)) {
        entry[1] = censor;
        changed = true;
      }
    }
    if (!changed) return url;

    const origin =
      parsed.protocol === "http:" && parsed.host === "localhost"
        ? ""
        : `${parsed.protocol}//${parsed.host}`;
    const pathname = parsed.pathname;
    const search = params.map(([k, v]) => `${k}=${v}`).join("&");
    return `${origin}${pathname}${search ? `?${search}` : ""}`;
  } catch {
    return redactInlineQuery(url, censor);
  }
}

function redactInlineQuery(input: string, censor: string): string {
  for (const param of URL_SENSITIVE_PARAMS) {
    const pattern = new RegExp(`([?&]${param}=)[^&]*`, "gi");
    input = input.replace(pattern, `$1${censor}`);
  }
  return input;
}

export function redactBodySummary(
  body: unknown,
  options?: RedactionOptions,
): { present: boolean; sizeHint: number; redacted: unknown } {
  const serialized = typeof body === "string" ? body : JSON.stringify(body);
  return {
    present: body !== undefined && body !== null,
    sizeHint: serialized.length,
    redacted: redactValue(
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : { value: body },
      createState(options),
    ),
  };
}

export function redact<T extends Record<string, unknown>>(
  input: T,
  options?: RedactionOptions,
): T {
  return redactValue(input, createState(options)) as T;
}
