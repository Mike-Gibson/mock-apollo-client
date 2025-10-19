import { ApolloLink, DocumentNode, Observable } from '@apollo/client';
import { print } from '@apollo/client/utilities';
import { RequestHandler, RequestHandlerResponse } from './mockClient';
import { IMockSubscription, MockSubscription } from './mockSubscription';
import {
  removeClientSetsFromDocument,
  removeConnectionDirectiveFromDocument,
  stripTypenames,
} from './directiveUtils';

export type MissingHandlerPolicy =
  | 'throw-error'
  | 'warn-and-return-error'
  | 'return-error';

interface MockLinkOptions {
  missingHandlerPolicy?: MissingHandlerPolicy;
}

const DEFAULT_MISSING_HANDLER_POLICY: MissingHandlerPolicy = 'throw-error';

export class MockLink extends ApolloLink {
  constructor(options?: MockLinkOptions) {
    super();

    this.missingHandlerPolicy =
      options?.missingHandlerPolicy || DEFAULT_MISSING_HANDLER_POLICY;
  }

  private readonly missingHandlerPolicy: MissingHandlerPolicy;
  private readonly requestHandlers: Record<string, RequestHandler | undefined> =
    {};

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
    const key = requestToKey(operation.query);

    const handler = this.requestHandlers[key];

    // TODO: THink can remove this - should always return observable - doesn't change behaviour
    if (!handler && this.missingHandlerPolicy === 'throw-error') {
      const errorMessage = getNotDefinedHandlerMessage(operation);
      throw new Error(errorMessage);
    }

    return new Observable<ApolloLink.Result>((observer) => {
      if (!handler) {
        const errorMessage = getNotDefinedHandlerMessage(operation);

        if (this.missingHandlerPolicy === 'warn-and-return-error') {
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

const getNotDefinedHandlerMessage = (operation: ApolloLink.Operation) => {
  return `Request handler not defined for query: ${print(operation.query)}`;
};

const writeWarning = (message: string) => {
  console.warn(`Warning: mock-apollo-client - ${message}`);
};
