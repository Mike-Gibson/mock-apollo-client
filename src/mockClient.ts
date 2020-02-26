import ApolloClient from 'apollo-client';
import { InMemoryCache as Cache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { DocumentNode } from 'apollo-link';
import { MockLink } from './mockLink';

export type RequestHandler<TData = any, TVariables = any> =
  (variables: TVariables) => Promise<RequestHandlerResponse<TData>>;

export type RequestHandlerResponse<T> = { data: T, errors?: any[] };

export type MockApolloClient = ApolloClient<NormalizedCacheObject> &
  { setRequestHandler: (query: DocumentNode, handler: RequestHandler) => void };

// Taken from the suggestion here: https://github.com/apollographql/react-apollo/issues/1747#issuecomment-562658518
const fragmentMatcher = { match: () => true }

export const createMockClient = (): MockApolloClient => {
  const mockLink = new MockLink();

  const client = new ApolloClient({
    cache: new Cache({
      addTypename: false, // TODO: Handle addTypename?
      fragmentMatcher,
    }),
    link: mockLink,
  });

  const mockMethods = {
    setRequestHandler: mockLink.setRequestHandler.bind(mockLink),
  };

  return Object.assign(client, mockMethods);
}
