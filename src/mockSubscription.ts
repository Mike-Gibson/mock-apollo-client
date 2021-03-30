import { FetchResult } from "@apollo/client/core";
import type { RequestHandlerResponse } from "./mockClient";

export class MockSubscription<TData = any> {
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
  error(errorValue?: any) {
    this.observer?.error(errorValue);
  }
  complete() {
    this.observer?.complete();
  }
}

export const createMockSubscription = <TData = any>() =>
  new MockSubscription<TData>();
