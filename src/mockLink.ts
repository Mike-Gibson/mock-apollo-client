import { ApolloLink, DocumentNode, Observable, Operation, FetchResult } from 'apollo-link';
import { removeClientSetsFromDocument, removeConnectionDirectiveFromDocument } from 'apollo-utilities';
import { print } from 'graphql/language/printer';
import { visit } from 'graphql/language/visitor';
import { RequestHandler, RequestHandlerResponse } from './mockClient';
import { IMockSubscription, MockSubscription } from './mockSubscription';

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

    return new Observable<FetchResult>(observer => {
      let result:
        | Promise<RequestHandlerResponse<any>>
        | IMockSubscription<any>
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
        throw new Error(`Request handler must return a promise or subscription. Received '${typeof result}'.`);
      }

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

const isSubscription = (maybeSubscription: any): maybeSubscription is MockSubscription<any> =>
  maybeSubscription && maybeSubscription instanceof MockSubscription;
