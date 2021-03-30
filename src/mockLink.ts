import { ApolloLink, DocumentNode, Observable, Operation, FetchResult } from '@apollo/client/core';
import { print } from 'graphql';
import { RequestHandler, RequestHandlerResponse } from './mockClient';
import { removeClientSetsFromDocument } from '@apollo/client/utilities';
import { MockSubscription } from './mockSubscription';

export class MockLink extends ApolloLink {
  private requestHandlers: Record<string, RequestHandler | undefined> = {};

  setRequestHandler(requestQuery: DocumentNode, handler: RequestHandler): void {
    const queryWithoutClientDirectives = removeClientSetsFromDocument(requestQuery);

    if (queryWithoutClientDirectives === null) {
      console.warn('Warning: mock-apollo-client - The query is entirely client side (using @client directives) so the request handler will not be registered.');
      return;
    }

    const key = requestToKey(queryWithoutClientDirectives);

    if (this.requestHandlers[key]) {
      throw new Error(`Request handler already defined for query: ${print(requestQuery)}`);
    }

    this.requestHandlers[key] = handler;
  }

  request = (operation: Operation) =>
    new Observable<FetchResult>(observer => {
      const key = requestToKey(operation.query);

      const handler = this.requestHandlers[key];

      if (!handler) {
        throw new Error(`Request handler not defined for query: ${print(operation.query)}`);
      }

      let result:
      | Promise<RequestHandlerResponse<any>>
      | MockSubscription<any>
      | undefined = undefined;

      try {
        result = handler(operation.variables);
      } catch (error) {
        throw new Error(`Unexpected error whilst calling request handler: ${error.message}`);
      }

      if (isPromise(result)) {
        result
        .then((result) => {
          observer.next(result);
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
      } else if (isSubscription(result)) {
        result.subscribe(observer)
      } else {
        throw new Error(`Request handler must return a promise. Received '${typeof result}'.`);
      }
   
      return () => {};
    });
}

const requestToKey = (query: DocumentNode): string => {
  const queryString = query && print(query);
  const requestKey = { query: queryString };
  return JSON.stringify(requestKey);
}

const isPromise = (maybePromise: any): maybePromise is Promise<any> =>
  maybePromise && typeof (maybePromise as any).then === 'function';

const isSubscription = (maybeSubscription: any): maybeSubscription is MockSubscription<any> => 
  maybeSubscription && typeof (maybeSubscription as any).next === 'function';
