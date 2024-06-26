import { FetchResult } from '@apollo/client/core';
import type { RequestHandlerResponse } from './mockClient';

export interface IMockSubscription<TData = any> {
  readonly closed: boolean;
  next: (value: RequestHandlerResponse<TData>) => void;
  error: (errorValue: any) => void;
  complete: () => void;
}

export type MockSubscriptionOptions = {
  disableLogging?: boolean;
}

/**
 * SubscriptionObserver interface copied from zen-observable-ts in order to be compatible
 * with @apollo/client library pre-3.5 which used zen-observable and different imports/types
 */
 export interface SubscriptionObserver<T> {
  closed: boolean;
  next(value: T): void;
  error(errorValue: any): void;
  complete(): void;
}

export class MockSubscription<TData = any> implements IMockSubscription<TData> {
  private observer?: SubscriptionObserver<FetchResult<TData>>;
  private loggingDisabled: boolean;

  constructor(options?: MockSubscriptionOptions) {
    this.loggingDisabled = options?.disableLogging ?? false;
  }

  subscribe(observer: SubscriptionObserver<FetchResult<TData>>) {
    if (this.observer && !this.loggingDisabled) {
      console.warn(
        'Warning: mock-apollo-client - Mock subscription was already being used for a previous query. ' +
        'Subsequent calls to next/error/complete will only affect subscriptions to the new query.'
      );
    }
    this.observer = observer;
  }

  get closed() {
    return this.observer?.closed ?? true;
  }

  next(value: RequestHandlerResponse<TData>) {
    this.verifyState();
    this.observer?.next(value);
  }

  error(errorValue: any) {
    this.verifyState();
    this.observer?.error(errorValue);
  }

  complete() {
    this.verifyState();
    this.observer?.complete();
  }

  private verifyState() {
    if (this.loggingDisabled) {
      return;
    }

    if (!this.observer) {
      console.warn(
        'Warning: mock-apollo-client - Mock subscription has no observer, this will have no effect'
      );
    } else if (this.closed) {
      console.warn(
        'Warning: mock-apollo-client - Mock subscription is closed, this will have no effect'
      );
    }
  }
}

export const createMockSubscription = <TData = any>(options?: MockSubscriptionOptions) =>
  new MockSubscription<TData>(options) as IMockSubscription<TData>;
