import { ApolloClientOptions, ApolloClient, DocumentNode } from '@apollo/client/core';
import { InMemoryCache as Cache, NormalizedCacheObject } from '@apollo/client/cache';
import { MissingHandlerPolicy, MockLink } from './mockLink';
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

interface CustomOptions {
  missingHandlerPolicy?: MissingHandlerPolicy;
}

export type MockApolloClientOptions = (Partial<Omit<ApolloClientOptions<NormalizedCacheObject>, 'link'>> & CustomOptions) | undefined;

export const createMockClient = (options: MockApolloClientOptions = {}): MockApolloClient => {
  if ((options as any)?.link) {
    throw new Error('Providing link to use is not supported.');
  }
  const { missingHandlerPolicy, ...restOptions } = options;

  const mockLink = new MockLink({ missingHandlerPolicy });

  const client = new ApolloClient({
    cache: new Cache({
      addTypename: false,
    }),
    ...restOptions,
    link: mockLink
  });

  const mockMethods = {
    setRequestHandler: mockLink.setRequestHandler.bind(mockLink),
  };

  return Object.assign(client, mockMethods);
}
