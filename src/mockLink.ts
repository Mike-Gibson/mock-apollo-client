import { ApolloLink, DocumentNode, Observable } from '@apollo/client';
import { print } from '@apollo/client/utilities';
import { RequestHandler, RequestHandlerResponse } from './mockClient';
import { IMockSubscription, MockSubscription } from './mockSubscription';
import {
  removeClientSetsFromDocument,
  removeConnectionDirectiveFromDocument,
  stripTypenames,
} from './directiveUtils';

export type MockLinkOptions = {
  /**
   * When true, warnings will not be logged to the console when a query
   * is executed and there is no request handler defined for it.
   * @default false
   */
  supressMissingHandlerWarning: boolean;
};

export class MockLink extends ApolloLink {
  private options: MockLinkOptions;
  private readonly requestHandlers: Record<string, RequestHandler> = {};

  constructor(options: Partial<MockLinkOptions> = {}) {
    super();

    this.options = {
      supressMissingHandlerWarning: false,
      ...options,
    };
  }

  setRequestHandler(requestQuery: DocumentNode, handler: RequestHandler): void {
    const queryWithoutDirectives = removeClientSetsFromDocument(requestQuery);

    if (queryWithoutDirectives === null) {
      writeWarning(
        'The query is entirely client side (using @client directives) so the request handler will not be registered.',
      );
      return;
    }

    const key = requestToKey(queryWithoutDirectives);

    if (this.requestHandlers[key]) {
      throw new Error(
        `Request handler already defined for query: ${print(requestQuery)}`,
      );
    }

    this.requestHandlers[key] = handler;
  }

  removeRequestHandler(requestQuery: DocumentNode): void {
    const queryWithoutClientDirectives =
      removeClientSetsFromDocument(requestQuery);

    if (queryWithoutClientDirectives === null) {
      writeWarning(
        'The query is entirely client side (using @client directives) so the request handler is not registered.',
      );
      return;
    }

    const key = requestToKey(queryWithoutClientDirectives);

    if (!this.requestHandlers[key]) {
      throw new Error(
        `Request handler not defined for query: ${print(requestQuery)}`,
      );
    }

    delete this.requestHandlers[key];
  }

  request = (operation: ApolloLink.Operation) => {
    return new Observable<ApolloLink.Result>((observer) => {
      const key = requestToKey(operation.query);

      const handler = this.requestHandlers[key];

      if (!handler) {
        const errorMessage = `Request handler not defined for query: ${print(operation.query)}`;

        if (!this.options.supressMissingHandlerWarning) {
          writeWarning(errorMessage);
        }

        throw new Error(errorMessage);
      }

      let result:
        | Promise<RequestHandlerResponse<any>>
        | IMockSubscription<any>
        | undefined = undefined;

      try {
        result = handler(operation.variables);
      } catch (error) {
        const message = error instanceof Error ? error.message : error;
        throw new Error(
          `Unexpected error whilst calling request handler: ${message}`,
        );
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
        result.subscribe(observer);
      } else {
        throw new Error(
          `Request handler must return a promise or subscription. Received '${typeof result}'.`,
        );
      }

      return () => {};
    });
  };
}

const normalise = (requestQuery: DocumentNode): DocumentNode => {
  let stripped: DocumentNode | null =
    removeConnectionDirectiveFromDocument(requestQuery);

  stripped = stripped !== null ? stripTypenames(stripped) : null;

  return stripped === null ? requestQuery : stripped;
};

const requestToKey = (query: DocumentNode): string => {
  const normalised = normalise(query);
  const queryString = query && print(normalised);
  const requestKey = { query: queryString };
  return JSON.stringify(requestKey);
};

const isPromise = (maybePromise: any): maybePromise is Promise<any> =>
  maybePromise && typeof (maybePromise as any).then === 'function';

const isSubscription = (
  maybeSubscription: any,
): maybeSubscription is MockSubscription<any> =>
  maybeSubscription && maybeSubscription instanceof MockSubscription;

const writeWarning = (message: string) => {
  console.warn(`Warning: mock-apollo-client - ${message}`);
};
