import ApolloClient, { ApolloClientOptions } from 'apollo-client';
import { InMemoryCache as Cache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { DocumentNode } from 'apollo-link';
import { MockLink } from './mockLink';

export type RequestHandler<TData = any, TVariables = any> =
  (variables: TVariables) => Promise<RequestHandlerResponse<TData>>;

export type RequestHandlerResponse<T> = { data: T, errors?: any[] };

export type MockApolloClient = ApolloClient<NormalizedCacheObject> &
  { setRequestHandler: (query: DocumentNode, handler: RequestHandler) => void };

export const createMockClient = (options?: Partial<ApolloClientOptions<NormalizedCacheObject>>): MockApolloClient => {
  const mockLink = new MockLink();

  const client = new ApolloClient({
    cache: new Cache({
      addTypename: false, // TODO: Handle addTypename?
    }),
    link: mockLink,
    ...options
  });

  const mockMethods = {
    setRequestHandler: mockLink.setRequestHandler.bind(mockLink),
  };

  return Object.assign(client, mockMethods);
}