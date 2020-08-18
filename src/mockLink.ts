import { ApolloLink, DocumentNode, Observable, Operation, FetchResult } from '@apollo/client/core';
import { hasDirectives, removeClientSetsFromDocument } from '@apollo/client/utilities';
import { print } from 'graphql/language/printer';
import { RequestHandler, RequestHandlerResponse } from './mockClient';

export class MockLink extends ApolloLink {
  private requestHandlers: Record<string, RequestHandler> = {};

  setRequestHandler(requestQuery: DocumentNode, handler: RequestHandler): void {
    const identifiers = getIdentifiers(requestQuery);

    for (const identifier of identifiers) {
      const key = requestToKey(identifier);

      if (this.requestHandlers[key]) {
        throw new Error(`Request handler already defined for query: ${format(identifier)}`);
      }

      this.requestHandlers[key] = handler;
    }
  }

  request(operation: Operation) {
    const key = requestToKey(operation.query);

    const handler = this.requestHandlers[key];

    if (!handler) {
      throw new Error(`Request handler not defined for query: ${format(operation.query)}`);
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

    return new Observable<FetchResult>(observer => {
      resultPromise!
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
}

const getIdentifiers = (requestQuery: DocumentNode): [DocumentNode] | [DocumentNode, DocumentNode] => {
  const withoutClientSets = hasDirectives(['client'], requestQuery)
    ? removeClientSetsFromDocument(requestQuery)
    : null;

  return withoutClientSets === null
    ? [requestQuery]
    : [requestQuery, withoutClientSets];
};

const requestToKey = (query: DocumentNode): string => {
  const queryString = print(query);
  const requestKey = { query: queryString };
  return JSON.stringify(requestKey);
}

const format = (query: DocumentNode | null): string =>
  query
    ? print(query)
    : 'null';

const isPromise = (maybePromise: any): maybePromise is Promise<any> =>
  maybePromise && typeof (maybePromise as any).then === 'function';
