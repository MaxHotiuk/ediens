/**
 * RFC 9457 Problem Details Error Handler & Reaction Matrix
 * Spec: docs/Ediens_SRS/05-error-handling.md
 */

import {
  ProblemDetails,
  ProblemErrorCode,
  ConcurrentModificationExtensions,
  InsufficientInventoryExtensions,
  RateLimitExtensions,
  HouseholdAccessDeniedExtensions,
  ItemNotFoundExtensions,
  IdempotencyConflictExtensions,
} from '../types/api';

export class EdiensApiError<TExtensions = Record<string, unknown>> extends Error {
  public readonly problem: ProblemDetails<TExtensions>;
  public readonly status: number;
  public readonly errorCode: ProblemErrorCode | string;
  public readonly traceId?: string;

  constructor(problem: ProblemDetails<TExtensions>) {
    super(problem.detail || problem.title || `API Error (${problem.status})`);
    this.name = 'EdiensApiError';
    this.problem = problem;
    this.status = problem.status;
    this.errorCode = problem.errorCode;
    this.traceId = problem.traceId;
  }
}

export type ErrorListener<T = unknown> = (data: T) => void;

class ErrorEventEmitter {
  private listeners: Map<string, Set<ErrorListener<unknown>>> = new Map();

  public on<T>(event: string, listener: ErrorListener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    const genericListener = listener as ErrorListener<unknown>;
    set.add(genericListener);

    return () => {
      set.delete(genericListener);
    };
  }

  public emit<T>(event: string, payload: T): void {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error(`Error in error listener for ${event}:`, err);
        }
      });
    }
  }
}

export const errorBus = new ErrorEventEmitter();

/**
 * Parses any unknown error (e.g., from Axios or fetch) into a standardized RFC 9457 ProblemDetails
 */
export function parseProblemDetails(error: unknown): ProblemDetails {
  if (error instanceof EdiensApiError) {
    return error.problem;
  }

  const errObj = error as Record<string, unknown> | null;
  const response = (errObj?.response || {}) as {
    status?: number;
    data?: unknown;
    headers?: Record<string, string>;
  };

  const status = response.status || (typeof errObj?.status === 'number' ? errObj.status : 500);
  const data = (response.data && typeof response.data === 'object' ? response.data : {}) as Record<string, unknown>;

  // Check headers for Retry-After or ETag
  const headers = response.headers || {};
  const etagHeader = headers['etag'] || headers['ETag'];
  const retryAfterHeader = headers['retry-after'] || headers['Retry-After'];

  const type =
    (typeof data.type === 'string' && data.type) ||
    `https://ediens.app/errors/${status === 409 ? 'concurrent-modification' : 'generic-error'}`;

  const title =
    (typeof data.title === 'string' && data.title) ||
    (status === 400 ? 'Validation Error' :
     status === 403 ? 'Household Access Denied' :
     status === 404 ? 'Resource Not Found' :
     status === 409 ? 'Conflict during state modification' :
     status === 422 ? 'Unprocessable Entity' :
     status === 429 ? 'Rate Limit Exceeded' :
     status === 503 ? 'External Service Unavailable' : 'Server Error');

  let errorCode = typeof data.errorCode === 'string' ? (data.errorCode as ProblemErrorCode) : '';
  if (!errorCode) {
    switch (status) {
      case 400: errorCode = 'VALIDATION_FAILED'; break;
      case 401: errorCode = 'UNAUTHORIZED_ACCESS'; break;
      case 403: errorCode = 'HOUSEHOLD_ACCESS_DENIED'; break;
      case 404: errorCode = 'ITEM_NOT_FOUND'; break;
      case 409: errorCode = 'CONCURRENT_MODIFICATION'; break;
      case 422: errorCode = 'INSUFFICIENT_INVENTORY'; break;
      case 429: errorCode = 'RATE_LIMIT_EXCEEDED'; break;
      case 503: errorCode = 'EXTERNAL_SERVICE_UNAVAILABLE'; break;
      default: errorCode = 'INTERNAL_SERVER_ERROR'; break;
    }
  }

  const traceId =
    (typeof data.traceId === 'string' && data.traceId) ||
    headers['traceparent'] ||
    headers['x-trace-id'] ||
    undefined;

  const detail = typeof data.detail === 'string' ? data.detail : undefined;
  const instance = typeof data.instance === 'string' ? data.instance : undefined;

  const extensions: Record<string, unknown> =
    data.extensions && typeof data.extensions === 'object'
      ? { ...(data.extensions as Record<string, unknown>) }
      : {};

  // Inject header fallback if missing in extensions
  if (etagHeader && !extensions.currentETag) {
    extensions.currentETag = etagHeader;
  }
  if (retryAfterHeader && !extensions.retryAfterSeconds) {
    const parsed = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsed)) {
      extensions.retryAfterSeconds = parsed;
    }
  }

  return {
    type,
    title,
    status,
    detail,
    instance,
    errorCode,
    traceId,
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
    errors: data.errors as Record<string, string[]> | undefined,
    extensions,
  };
}

/**
 * Reaction Matrix Dispatcher: executes designated action based on RFC 9457 error code
 */
export function handleApiError(error: unknown): EdiensApiError {
  const problem = parseProblemDetails(error);
  const apiError = new EdiensApiError(problem);

  // Global error notification
  errorBus.emit('error', problem);

  // RFC 9457 Client Reaction Matrix Dispatching
  switch (problem.status) {
    case 400:
      // Validation error -> Form fields highlight
      errorBus.emit<ProblemDetails>('validation-error', problem);
      break;

    case 401:
      // Unauthorized -> Session refresh or Auth modal
      errorBus.emit<ProblemDetails>('unauthorized', problem);
      break;

    case 403:
      // Household access denied -> Household selector / switch modal
      errorBus.emit<ProblemDetails<HouseholdAccessDeniedExtensions>>('household-access-denied', problem);
      break;

    case 404:
      // Item not found -> Cache invalidation + Toast
      errorBus.emit<ProblemDetails<ItemNotFoundExtensions>>('item-not-found', problem);
      break;

    case 409:
      if (problem.errorCode === 'IDEMPOTENCY_CONFLICT') {
        errorBus.emit<ProblemDetails<IdempotencyConflictExtensions>>(
          'idempotency-conflict',
          problem as unknown as ProblemDetails<IdempotencyConflictExtensions>
        );
      } else {
        // Concurrency modification (ETag conflict) -> Conflict Resolution Modal
        errorBus.emit<ProblemDetails<ConcurrentModificationExtensions>>(
          'concurrent-modification',
          problem as unknown as ProblemDetails<ConcurrentModificationExtensions>
        );
      }
      break;

    case 422:
      // Insufficient inventory or Domain invariant -> Insufficient Stock Drawer / Shopping list add
      errorBus.emit<ProblemDetails<InsufficientInventoryExtensions>>(
        'insufficient-inventory',
        problem as unknown as ProblemDetails<InsufficientInventoryExtensions>
      );
      break;

    case 429: {
      // Rate limit exceeded -> RateLimitBanner with countdown timer
      const retryAfter =
        (problem.extensions?.retryAfterSeconds as number) || 30;
      errorBus.emit<RateLimitExtensions>('rate-limit-exceeded', {
        retryAfterSeconds: retryAfter,
        ...(problem.extensions as Record<string, unknown>),
      });
      break;
    }

    case 500:
      // Internal server error -> Error boundary / copy traceId toast
      errorBus.emit<ProblemDetails>('internal-server-error', problem);
      break;

    case 503:
      // External service circuit breaker open -> Manual entry fallback
      errorBus.emit<ProblemDetails>('service-unavailable', problem);
      break;

    default:
      errorBus.emit<ProblemDetails>('unknown-error', problem);
      break;
  }

  return apiError;
}

/**
 * Event subscription helpers for React components
 */
export const ErrorListeners = {
  onValidationError: (cb: (problem: ProblemDetails) => void) =>
    errorBus.on<ProblemDetails>('validation-error', cb),

  onHouseholdAccessDenied: (cb: (problem: ProblemDetails<HouseholdAccessDeniedExtensions>) => void) =>
    errorBus.on<ProblemDetails<HouseholdAccessDeniedExtensions>>('household-access-denied', cb),

  onItemNotFound: (cb: (problem: ProblemDetails<ItemNotFoundExtensions>) => void) =>
    errorBus.on<ProblemDetails<ItemNotFoundExtensions>>('item-not-found', cb),

  onConcurrentModification: (cb: (problem: ProblemDetails<ConcurrentModificationExtensions>) => void) =>
    errorBus.on<ProblemDetails<ConcurrentModificationExtensions>>('concurrent-modification', cb),

  onIdempotencyConflict: (cb: (problem: ProblemDetails<IdempotencyConflictExtensions>) => void) =>
    errorBus.on<ProblemDetails<IdempotencyConflictExtensions>>('idempotency-conflict', cb),

  onInsufficientInventory: (cb: (problem: ProblemDetails<InsufficientInventoryExtensions>) => void) =>
    errorBus.on<ProblemDetails<InsufficientInventoryExtensions>>('insufficient-inventory', cb),

  onRateLimitExceeded: (cb: (data: RateLimitExtensions) => void) =>
    errorBus.on<RateLimitExtensions>('rate-limit-exceeded', cb),

  onServerError: (cb: (problem: ProblemDetails) => void) =>
    errorBus.on<ProblemDetails>('internal-server-error', cb),

  onServiceUnavailable: (cb: (problem: ProblemDetails) => void) =>
    errorBus.on<ProblemDetails>('service-unavailable', cb),
};
