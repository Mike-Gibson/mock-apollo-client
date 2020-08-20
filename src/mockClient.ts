import { ApolloClientOptions, ApolloClient, DocumentNode } from '@apollo/client/core';
import { InMemoryCache as Cache, NormalizedCacheObject } from '@apollo/client/cache';
import { MockLink } from './mockLink';

export type RequestHandler<TData = any, TVariables = any> =
  (variables: TVariables) => Promise<RequestHandlerResponse<TData>>;

export type RequestHandlerResponse<T> = { data: T, errors?: any[] };

export type MockApolloClient = ApolloClient<NormalizedCacheObject> &
  { setRequestHandler: (query: DocumentNode, handler: RequestHandler) => void };

export type MockApolloClientOptions = Partial<Omit<ApolloClientOptions<NormalizedCacheObject>, 'link'>> | undefined;

export const createMockClient = (options?: MockApolloClientOptions): MockApolloClient => {
  if ((options as any)?.link) {
    throw new Error('Providing link to use is not supported.');
  }

  const mockLink = new MockLink();

  const client = new ApolloClient({
    cache: new Cache({
      addTypename: false,
    }),
    ...options,
    link: mockLink
  });

  const mockMethods = {
    setRequestHandler: mockLink.setRequestHandler.bind(mockLink),
  };

  return Object.assign(client, mockMethods);
}
