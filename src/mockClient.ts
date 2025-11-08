import {
  ApolloClient,
  DocumentNode,
  InMemoryCache as Cache,
} from '@apollo/client';
import { MockLink, MockLinkOptions } from './mockLink';
import { IMockSubscription } from './mockSubscription';

export type RequestHandler<TData = any, TVariables = any> = (
  variables: TVariables,
) => Promise<RequestHandlerResponse<TData>> | IMockSubscription<TData>;

export type RequestHandlerResponse<T> = { data: T } | { errors: any[] };

export type MockApolloClient = ApolloClient & {
  setRequestHandler: (query: DocumentNode, handler: RequestHandler) => void;
  removeRequestHandler: (query: DocumentNode) => void;
};

export type MockApolloClientOptions = Partial<
  Omit<ApolloClient.Options, 'link'>
> &
  Partial<MockLinkOptions>;

export const createMockClient = (
  options: MockApolloClientOptions = {},
): MockApolloClient => {
  if ((options as any)?.link) {
    throw new Error('Providing link to use is not supported.');
  }
  const {
    suppressMissingHandlerWarning,
    cache: cacheFromOptions,
    ...restOptions
  } = options;

  const cache = cacheFromOptions ?? new Cache();
  const link = new MockLink({ suppressMissingHandlerWarning });

  const client = new ApolloClient({
    ...restOptions,
    cache,
    link,
  });

  const mockMethods = {
    setRequestHandler: link.setRequestHandler.bind(link),
    removeRequestHandler: link.removeRequestHandler.bind(link),
  };

  return Object.assign(client, mockMethods);
};
