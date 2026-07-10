export {
  createLogger,
  type Logger,
  type LoggerOptions,
  type LogEvent,
  type LogLevel,
} from "./logger/logger.js";

export {
  redact,
  redactValue,
  redactHeaders,
  redactQueryString,
  redactBodySummary,
  type RedactionOptions,
} from "./redaction/redaction.js";

export {
  createRegistry,
  Registry,
  Counter,
  Gauge,
  Histogram,
  MetricNameValidationError,
  METRIC_NAME_PATTERN,
  MAX_METRIC_NAME_LENGTH,
  type Labels,
  type MetricDefinition,
  type HistogramSample,
} from "./metrics/metrics.js";

export {
  getContext,
  runWithContext,
  setContextDefaults,
  CORRELATION_ID_PATTERN,
  type ObservabilityContext,
} from "./context/context.js";

export {
  createShutdownCoordinator,
  ShutdownCoordinator,
  type CleanupTask,
  type CleanupResult,
  type CleanupStrategy,
  type ShutdownCoordinatorOptions,
} from "./shutdown/shutdown.js";

export {
  type DependencyCategory,
  type DependencyStatus,
  type DependencyCheckResult,
  type ReadinessResult,
  type StartupState,
  type LivenessResult,
} from "./health/health.types.js";
