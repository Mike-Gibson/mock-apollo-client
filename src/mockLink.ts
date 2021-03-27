import { ApolloLink, DocumentNode, Observable, Operation, FetchResult } from 'apollo-link';
import { removeClientSetsFromDocument, removeConnectionDirectiveFromDocument } from 'apollo-utilities';
import { print } from 'graphql/language/printer';
import { visit } from 'graphql/language/visitor';
import { RequestHandler, RequestHandlerResponse } from './mockClient';

export class MockLink extends ApolloLink {
  private requestHandlers: Record<string, RequestHandler> = {};

  setRequestHandler(requestQuery: DocumentNode, handler: RequestHandler): void {
    const key = requestToKey(requestQuery);

    if (this.requestHandlers[key]) {
      throw new Error(`Request handler already defined for query: ${format(requestQuery)}`);
    }

    this.requestHandlers[key] = handler;
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
      return () => { };
    });
  }
}

const normalise = (requestQuery: DocumentNode): DocumentNode => {
  let stripped = removeClientSetsFromDocument(requestQuery);

  stripped = stripped !== null
    ? removeConnectionDirectiveFromDocument(stripped)
    : null;

  stripped = stripped !== null
    ? stripTypenames(stripped)
    : null;

  return stripped === null
    ? requestQuery
    : stripped;
};

const stripTypenames = (document: DocumentNode): DocumentNode | null =>
  visit(
    document,
    {
      Field: {
        enter: (node) => node.name.value === '__typename'
          ? null
          : undefined,
      },
    });

const requestToKey = (query: DocumentNode): string => {
  const normalised = normalise(query);
  const queryString = print(normalised);
  const requestKey = { query: queryString };
  return JSON.stringify(requestKey);
}

const format = (query: DocumentNode | null): string =>
  query
    ? print(query)
    : 'null';

const isPromise = (maybePromise: any): maybePromise is Promise<any> =>
  maybePromise && typeof (maybePromise as any).then === 'function';
