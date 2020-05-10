import ApolloClient, { ApolloClientOptions } from 'apollo-client';
import { InMemoryCache as Cache, NormalizedCacheObject } from 'apollo-cache-inmemory';
import { DocumentNode } from 'apollo-link';
import { MockLink } from './mockLink';

export type RequestHandler<TData = any, TVariables = any> =
  (variables: TVariables) => Promise<RequestHandlerResponse<TData>>;

export type RequestHandlerResponse<T> = { data: T, errors?: any[] };

export type RequestHandlerOptions = { includeClientDirectives?: boolean };

export type MockApolloClient = ApolloClient<NormalizedCacheObject> &
  { setRequestHandler: (query: DocumentNode, handler: RequestHandler, options?: RequestHandlerOptions) => void };

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
    setRequestHandler: (query: DocumentNode, handler: RequestHandler, options?: RequestHandlerOptions) => {
      if (options?.includeClientDirectives && areResolversDefined(client)) {
        console.warn('Warning: mock-apollo-client - includeClientDirectives should not be used when local resolvers have been configured.');
      }

      mockLink.setRequestHandler(query, handler, options);
    },
  };

  return Object.assign(client, mockMethods);
}

const areResolversDefined = (client: ApolloClient<any>) =>
  // getResolvers returns empty object if not defined, so cannot check for truthy value
  client.getResolvers() === client.getResolvers();
