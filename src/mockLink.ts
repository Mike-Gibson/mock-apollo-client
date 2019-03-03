import { ApolloLink, DocumentNode, Observable, Operation } from 'apollo-link';
import { removeClientSetsFromDocument } from 'apollo-utilities';
import { print } from 'graphql/language/printer';
import { IRequestHandler, RequestHandler } from './requestHandler';

export class MockLink extends ApolloLink {
  private requestHandlers: Record<string, RequestHandler<any, any>> = {};

  getRequestHandler<TData = any>(requestQuery: DocumentNode): IRequestHandler<TData> {
    const key = requestToKey(requestQuery);

    if (!this.requestHandlers[key]) {
      this.requestHandlers[key] = new RequestHandler();
    }

    return this.requestHandlers[key];
  }

  request(operation: Operation) {
    const key = requestToKey(operation.query);

    const handler = this.requestHandlers[key];

    if (!handler) {
      throw new Error(`No request handler defined for the query: ${print(operation.query)}`);
    }

    return new Observable(observer => {
      handler.update(operation, observer);
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
