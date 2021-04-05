import { FetchResult } from "@apollo/client/core";
import type { RequestHandlerResponse } from "./mockClient";

export interface IMockSubscription<TData = any> {
  readonly closed: boolean;
  next: (value: RequestHandlerResponse<TData>) => void;
  error: (errorValue: any) => void;
  complete: () => void;
}

export class MockSubscription<TData = any> implements IMockSubscription<TData> {
  private observer?: ZenObservable.SubscriptionObserver<FetchResult>;

  subscribe(observer: ZenObservable.SubscriptionObserver<FetchResult>) {
    this.observer = observer;
  }

  get closed() {
    return this.observer?.closed ?? true;
  }

  next(value: RequestHandlerResponse<TData>) {
    this.observer?.next(value);
  }

  error(errorValue: any) {
    this.observer?.error(errorValue);
  }

  complete() {
    this.observer?.complete();
  }
}

export const createMockSubscription = <TData = any>() =>
  new MockSubscription<TData>() as IMockSubscription<TData>;
