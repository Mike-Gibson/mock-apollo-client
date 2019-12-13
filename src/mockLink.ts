import { ApolloLink, DocumentNode, Observable, Operation, FetchResult } from 'apollo-link';
import { removeClientSetsFromDocument } from 'apollo-utilities';
import { print } from 'graphql/language/printer';
import { RequestHandler, RequestHandlerResponse, MockClientOptions, defaultOptions } from './mockClient';


export class MockLink extends ApolloLink {
  private requestHandlers: Record<string, RequestHandler> = {};

  constructor(private options: MockClientOptions = defaultOptions) {
    super();
  }

  setRequestHandler(requestQuery: DocumentNode, handler: RequestHandler): void {
    const key = requestToKey(requestQuery);

    if (this.requestHandlers[key] && !this.options.replaceHandlers) {
      throw new Error(`Request handler already defined for query: ${print(requestQuery)}. Use createMockClient({ replaceHandlers: true }) to overwrite handlers.`);
    }

    this.requestHandlers[key] = handler;
  }

  request(operation: Operation) {
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

function requestToKey(requestQuery: DocumentNode): string {
  const query = removeClientSetsFromDocument(requestQuery);
  const queryString = query && print(query);
  const requestKey = { query: queryString };
  return JSON.stringify(requestKey);
}

function isPromise(maybePromise: any): maybePromise is Promise<any> {
  return maybePromise && typeof (maybePromise as any).then === 'function';
}
