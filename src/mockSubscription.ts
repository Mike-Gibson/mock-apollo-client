import { ApolloLink } from '@apollo/client';
import { Observer } from 'rxjs';
import type { RequestHandlerResponse } from './mockClient';

export interface IMockSubscription<TData = any> {
  next: (value: RequestHandlerResponse<TData>) => void;
  error: (errorValue: any) => void;
  complete: () => void;
}

export type MockSubscriptionOptions = {
  disableLogging?: boolean;
};

export class MockSubscription<TData = any> implements IMockSubscription<TData> {
  private observer?: Observer<ApolloLink.Result<TData>>;
  private loggingDisabled: boolean;
  private isComplete = false;

  constructor(options?: MockSubscriptionOptions) {
    this.loggingDisabled = options?.disableLogging ?? false;
  }

  subscribe(observer: Observer<ApolloLink.Result<TData>>) {
    if (this.observer && !this.loggingDisabled) {
      console.warn(
        'Warning: mock-apollo-client - Mock subscription was already being used for a previous query. ' +
          'Subsequent calls to next/error/complete will only affect subscriptions to the new query.',
      );
    }
    this.observer = observer;
  }

  next(value: RequestHandlerResponse<TData>) {
    this.verifyState();
    this.observer?.next(value);
  }

  error(errorValue: any) {
    this.verifyState();
    this.observer?.error(errorValue);
    this.isComplete = true;
  }

  complete() {
    this.verifyState();
    this.observer?.complete();
    this.isComplete = true;
  }

  private verifyState() {
    if (this.loggingDisabled) {
      return;
    }

    if (!this.observer) {
      console.warn(
        'Warning: mock-apollo-client - Mock subscription has no observer, this will have no effect',
      );
    } else if (this.isComplete) {
      console.warn(
        'Warning: mock-apollo-client - Mock subscription is complete, this will have no effect',
      );
    }
  }
}

export const createMockSubscription = <TData = any>(
  options?: MockSubscriptionOptions,
) => new MockSubscription<TData>(options) as IMockSubscription<TData>;
