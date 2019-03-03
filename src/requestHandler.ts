import { FetchResult, Operation } from "apollo-link";

export interface IRequestHandler<TData = any, TVariables = any> {
  resolve(result: TData): void;
  reject(error: any): void

  requestCount: number;
  getLastRequestVariables: () => TVariables;
}

export class RequestHandler<TData, TVariables> implements IRequestHandler<TData, TVariables> {
  private operations: Operation[] = [];
  private observer: ZenObservable.SubscriptionObserver<FetchResult<TData>> | null = null;

  get requestCount() {
    return this.operations.length;
  }

  getLastRequestVariables(): TVariables {
    if (!this.operations.length) {
      throw new Error('Request has not been called');
    }

    const lastOperation = this.operations[this.operations.length - 1];
    return lastOperation.variables as TVariables;
  }

  update(operation: Operation, observer: ZenObservable.SubscriptionObserver<FetchResult<TData>>) {
    this.operations.push(operation);
    this.observer = observer;
  }

  resolve(result: TData) {
    const observer = this.getObserver();

    observer.next({ data: result });
    observer.complete();
  }

  reject(error: any) {
    const observer = this.getObserver();

    observer.error(error);
  }

  private getObserver(): ZenObservable.SubscriptionObserver<FetchResult<TData>> {
    if (!this.observer) {
      throw new Error('No request has been made yet');
    }

    if (this.observer.closed) {
      throw new Error('Result/error has already been returned for the latest request');
    }

    return this.observer;
  }
}
