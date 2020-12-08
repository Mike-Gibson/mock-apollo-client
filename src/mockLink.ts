import { ApolloLink, DocumentNode, Observable, Operation, FetchResult } from '@apollo/client/core';
import { print } from 'graphql';
import { RequestHandler, RequestHandlerResponse } from './mockClient';
import { removeClientSetsFromDocument, removeConnectionDirectiveFromDocument } from '@apollo/client/utilities';

export class MockLink extends ApolloLink {
  private requestHandlers: Record<string, RequestHandler | undefined> = {};

  setRequestHandler(requestQuery: DocumentNode, handler: RequestHandler): void {
    let strippedQuery = removeClientSetsFromDocument(requestQuery);

    if (strippedQuery === null) {
      console.warn('Warning: mock-apollo-client - The query is entirely client side (using @client directives) so the request handler will not be registered.');
      return;
    }

    strippedQuery = removeConnectionDirectiveFromDocument(strippedQuery)!;

    const key = requestToKey(strippedQuery);

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

      let resultPromise: Promise<RequestHandlerResponse<any>> | undefined = undefined;

      try {
        resultPromise = handler(operation.variables);
      } catch (error) {
        throw new Error(`Unexpected error whilst calling request handler: ${error.message}`);
      }

      if (!isPromise(resultPromise)) {
        throw new Error(`Request handler must return a promise. Received '${typeof resultPromise}'.`);
      }

      resultPromise
        .then((result) => {
          observer.next(result);
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
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
