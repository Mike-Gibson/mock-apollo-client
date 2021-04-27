import ApolloClient, { ApolloClientOptions } from 'apollo-client';
import { InMemoryCache as Cache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { DocumentNode } from 'apollo-link';
import { removeClientSetsFromDocument } from 'apollo-utilities';
import { MockLink } from './mockLink';
import { IMockSubscription } from './mockSubscription';

export type RequestHandler<TData = any, TVariables = any> =
  (variables: TVariables) =>
  | Promise<RequestHandlerResponse<TData>>
  | IMockSubscription<TData>;

export type RequestHandlerResponse<T> =
  | { data: T }
  | { errors: any[] };


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
    setRequestHandler: (query: DocumentNode, handler: RequestHandler) => {
      if (removeClientSetsFromDocument(query) === null && areResolversDefined(client)) {
        console.warn('Warning: mock-apollo-client - The query is entirely client side (using @client directives) and resolvers have been configured. ' +
          'The request handler will not be called.');
      }

      mockLink.setRequestHandler(query, handler);
    },
  };

  return Object.assign(client, mockMethods);
}

const areResolversDefined = (client: ApolloClient<any>) =>
  // getResolvers returns empty object if not defined, so cannot check for truthy value
  client.getResolvers() === client.getResolvers();
