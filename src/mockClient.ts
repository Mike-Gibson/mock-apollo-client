import ApolloClient from 'apollo-client';
import { InMemoryCache as Cache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { DocumentNode } from 'apollo-link';
import { MockLink } from './mockLink';
import { IRequestHandler } from './requestHandler';

export type MockApolloClient = ApolloClient<NormalizedCacheObject> &
  { getRequestHandler: <TData = any, TVariables = any>(requestQuery: DocumentNode) => IRequestHandler<TData, TVariables> };

export const createMockClient = (): MockApolloClient => {
  const mockLink = new MockLink();

  const client = new ApolloClient({
    cache: new Cache({
      addTypename: false, // TODO: Handle addTypename?
    }),
    link: mockLink,
  });

  const mockMethods = {
    getRequestHandler: (requestQuery: DocumentNode) => mockLink.getRequestHandler(requestQuery),
  };

  return Object.assign(client, mockMethods);
}