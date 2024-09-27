import { isObject } from "./isObject";

export interface DebouncedFunc<T extends (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  cancel(): void;
  flush(): ReturnType<T> | undefined;
  pending(): boolean;
}

interface DebounceOptions {
  maxWait?: number;
  leading?: boolean;
  trailing?: boolean;
  callImmediately?: boolean; // If true, calls the function immediately before starting the debounce process
  maxCalls?: number; // Limits the total number of times the debounced function can be called
}

type TimeoutId = ReturnType<typeof setTimeout>;

export function debounce<T extends (...args: any) => any>(
  func: T,
  wait?: number,
  options?: DebounceOptions
): DebouncedFunc<T> {
  type Result = ReturnType<T> | undefined;

  let lastArgs: any;
  let lastThis: any;
  let result: Result;
  let lastCallTime: number | undefined;
  let timerId: TimeoutId | undefined;
  let lastInvokeTime = 0;
  let callCount = 0; // Tracks the number of times the function has been called

  const useRAF =
    wait === undefined && typeof window !== "undefined" && typeof window.requestAnimationFrame === "function";

  if (typeof func !== "function") {
    throw new TypeError("Expected a function");
  }

  const waitValue = Number(wait) || 0;

  let leading = false;
  let trailing = true;
  let maxWait: number | null = null;
  let callImmediately = false; // Flag to determine if the function should be called immediately
  let maxCalls: number | undefined; // Maximum number of times the function can be called
  if (isObject(options)) {
    leading = !!options.leading;
    maxWait = "maxWait" in options ? Math.max(Number(options.maxWait) || 0, waitValue) : maxWait;
    trailing = "trailing" in options ? !!options.trailing : trailing;
    callImmediately = !!options.callImmediately; // Set callImmediately based on options
    maxCalls = options.maxCalls; // Set maxCalls based on options
  }

  function invokeFunc(time: number): Result {
    const args = lastArgs;
    const thisArg = lastThis;

    lastArgs = lastThis = undefined;
    lastInvokeTime = time;
    result = func.apply(thisArg, args);
    callCount++; // Increment call count
    return result;
  }

  function startTimer(pendingFunc: () => Result, wait: number): TimeoutId {
    if (useRAF && typeof timerId === "number") {
      window.cancelAnimationFrame(timerId);
      return window.requestAnimationFrame(pendingFunc) as any;
    }
    return setTimeout(pendingFunc, wait);
  }

  function cancelTimer(id: TimeoutId): void {
    if (useRAF && typeof id === "number") {
      window.cancelAnimationFrame(id);
    }
    clearTimeout(id);
  }

  function leadingEdge(time: number): Result {
    lastInvokeTime = time;
    timerId = startTimer(timerExpired, waitValue);
    return leading ? invokeFunc(time) : result;
  }

  function remainingWait(time: number): number {
    if (lastCallTime === undefined) return 0;

    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = waitValue - timeSinceLastCall;

    return maxWait !== null ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
  }

  function shouldInvoke(time: number): boolean {
    if (lastCallTime === undefined) return true;

    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      timeSinceLastCall >= waitValue || timeSinceLastCall < 0 || (maxWait !== null && timeSinceLastInvoke >= maxWait)
    );
  }

  function timerExpired(): Result {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    timerId = startTimer(timerExpired, remainingWait(time));
    return;
  }

  function trailingEdge(time: number): Result {
    timerId = undefined;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = lastThis = undefined;
    return result;
  }

  function cancel(): void {
    if (timerId !== undefined) {
      cancelTimer(timerId);
    }
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timerId = undefined;
    callCount = 0; // Reset call count on cancel
  }

  function flush(): Result {
    return timerId === undefined ? result : trailingEdge(Date.now());
  }

  function pending(): boolean {
    return timerId !== undefined;
  }

  function debounced(this: any, ...args: any[]): Result {
    // Check if maxCalls has been reached, if so, return the last result
    if (maxCalls !== undefined && callCount >= maxCalls) {
      return result;
    }

    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime);
      }
      if (maxWait !== null) {
        timerId = startTimer(timerExpired, waitValue);
        return invokeFunc(lastCallTime);
      }
    }
    if (timerId === undefined) {
      timerId = startTimer(timerExpired, waitValue);
    }
    return result;
  }

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.pending = pending;

  // If callImmediately is true, invoke the function immediately
  if (callImmediately) {
    result = invokeFunc(Date.now());
  }

  return debounced;
}

