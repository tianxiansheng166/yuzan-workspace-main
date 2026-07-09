/**
 * Port for time access.
 *
 * Abstracts Date.now() so tests can deterministically control session
 * expiry and rotation behavior.
 */
export interface Clock {
  now(): Date;
}

export const CLOCK = Symbol("CLOCK");
