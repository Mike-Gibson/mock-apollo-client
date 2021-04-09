import { FetchResult } from "@apollo/client/core";
import type { RequestHandlerResponse } from "./mockClient";

export interface IMockSubscription<TData = any> {
  readonly closed: boolean;
  next: (value: RequestHandlerResponse<TData>) => void;
  error: (errorValue: any) => void;
  complete: () => void;
}

export type MockSubscriptionOptions = {
  logging?: boolean
}

export class MockSubscription<TData = any> implements IMockSubscription<TData> {
  private observer?: ZenObservable.SubscriptionObserver<FetchResult>;
  private logging: boolean;

  constructor(options?: MockSubscriptionOptions) {
    this.logging = options?.logging ?? true;
  }

  subscribe(observer: ZenObservable.SubscriptionObserver<FetchResult>) {
    if (this.observer && this.logging) {
      console.warn(
        "Warning: mock-apollo-client - Subscription observer should probably not be overriden"
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
    if (this.logging) {
      if (!this.observer) {
        console.warn(
          "Warning: mock-apollo-client - Subscription has no observer, this will have no effect"
        );
      } else if (this.closed) {
        console.warn(
          "Warning: mock-apollo-client - Subscription is closed, this will have no effect"
        );
      }
    }
  }
}

export const createMockSubscription = <TData = any>(options?: MockSubscriptionOptions) =>
  new MockSubscription<TData>(options) as IMockSubscription<TData>;
