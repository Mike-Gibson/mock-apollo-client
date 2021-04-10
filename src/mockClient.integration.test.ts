import { ApolloQueryResult, gql } from '@apollo/client/core';

// Currently do not test against all valid peer dependency versions of apollo
// Would be nice to have, but can't find an elegant way of doing it.

import { createMockClient, MockApolloClient } from './mockClient';
import { createMockSubscription, IMockSubscription } from './mockSubscription';

describe('MockClient integration tests', () => {
  let mockClient: MockApolloClient;

  beforeEach(() => {
    jest.spyOn(console, 'warn')
      .mockReset();
  });

  describe('Simple queries', () => {
    const queryOne = gql`query One {one}`;
    const queryTwo = gql`query Two {two}`;

    let requestHandlerOne: jest.Mock;
    let resolveRequestOne: Function;

    beforeEach(() => {
      mockClient = createMockClient();

      requestHandlerOne = jest.fn(() => new Promise((r) => { resolveRequestOne = r }));

      mockClient.setRequestHandler(queryOne, requestHandlerOne);
    });

    describe('Given request handler is defined', () => {
      let promise: Promise<ApolloQueryResult<any>>;

      beforeEach(() => {
        promise = mockClient.query({ query: queryOne });
      });

      it('returns a promise which resolves to the correct value', async () => {
        expect(promise).toBeInstanceOf(Promise);

        resolveRequestOne({ data: { one: 'one' } });

        const actual = await promise;

        expect(actual).toEqual(expect.objectContaining({ data: { one: 'one' } }));
      });

      it('throws when a handler is added for the same query', () => {
        expect(() => mockClient.setRequestHandler(queryOne, jest.fn())).toThrowError('Request handler already defined ');
      });
    });

    describe('Given request handler is not defined', () => {
      it('throws when executing the query', () => {
        expect(() => mockClient.query({ query: queryTwo }))
          .toThrowError('Request handler not defined for query');
      });
    });
  });

  describe('Client directives', () => {
    // Note: React apollo 3 no longer passes @client directives down to the link (regardless of whether
    // client-side resolvers have been configured).
    // See https://github.com/apollographql/apollo-client/blob/master/CHANGELOG.md#apollo-client-300

    describe('Given entire query is client-side and client side resolvers exist', () => {
      const query = gql` { visibilityFilter @client }`;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          resolvers: {
            Query: {
              visibilityFilter: () => 'client resolver data',
            },
          },
        });

        requestHandler = jest.fn().mockResolvedValue({
          data: {
            visibilityFilter: 'handler data',
          },
        });
      });

      it('warns when request handler is added and does not handle request', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).toBeCalledTimes(1);
        expect(console.warn).toBeCalledWith('Warning: mock-apollo-client - The query is entirely client side (using @client directives) so the request handler will not be registered.');

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ visibilityFilter: 'client resolver data' });
        expect(requestHandler).not.toHaveBeenCalled();
      });
    });

    describe('Given entire query is client-side and client side resolvers do not exist', () => {
      const query = gql` { visibilityFilter @client }`;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          resolvers: undefined,
        });

        requestHandler = jest.fn().mockResolvedValue({
          data: {
            visibilityFilter: 'handler data',
          },
        });
      });

      it('warns when request handler is added and does not handle request', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).toBeCalledTimes(1);
        expect(console.warn).toBeCalledWith('Warning: mock-apollo-client - The query is entirely client side (using @client directives) so the request handler will not be registered.');

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({});
        expect(requestHandler).not.toHaveBeenCalled();
      });
    });

    describe('Given part of the query is client-side and client side resolvers exist', () => {
      const query = gql`
        query User {
          user {
            id
            name
            isLoggedIn @client
          }
        }
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          resolvers: {
            Query: {
              user: () => ({ isLoggedIn: true }),
            },
          },
        });

        requestHandler = jest.fn().mockResolvedValue({ data: { user: { id: 1, name: 'bob', isLoggedIn: false } } });
      });

      it('does not warn when request handler is added and handles request with merging', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).not.toBeCalled();

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ user: { id: 1, name: 'bob', isLoggedIn: true } });
        expect(requestHandler).toBeCalledTimes(1);
        expect(console.warn).not.toBeCalled();
      });
    });

    describe('Given part of the query is client-side and client side resolvers do not exist', () => {
      const query = gql`
        query User {
          user {
            id
            name
            isLoggedIn @client
          }
        }
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          resolvers: undefined,
        });

        requestHandler = jest.fn().mockResolvedValue({ data: { user: { id: 1, name: 'bob', isLoggedIn: false } } });
      });

      it('does not warn when request handler is added and handles request', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).not.toBeCalled();

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ user: { id: 1, name: 'bob', isLoggedIn: false } });
        expect(requestHandler).toBeCalledTimes(1);
      });
    });
  });

  describe('Subscriptions', () => {
    const queryOne = gql`query One {one}`;
    const queryTwo = gql`query Two {two}`;

    let mockSubscription: IMockSubscription<{ one: string }>;
    let requestHandler: jest.Mock;

    beforeEach(() => {
      mockClient = createMockClient();

      mockSubscription = createMockSubscription();

      requestHandler = jest.fn().mockReturnValue(mockSubscription);

      mockClient.setRequestHandler(queryOne, requestHandler);
    });

    describe('Given request handler is defined', () => {
      let onNext: jest.Mock;
      let onError: jest.Mock;
      let onComplete: jest.Mock;

      let clearMocks: () => void;

      beforeEach(() => {
        onNext = jest.fn();
        onError = jest.fn();
        onComplete = jest.fn();

        clearMocks = () => {
          onNext.mockClear();
          onError.mockClear();
          onComplete.mockClear();
        };

        const observable = mockClient.subscribe({ query: queryOne, variables: { a: 1 } });

        observable.subscribe(
          onNext,
          onError,
          onComplete);
      });

      it('returns an observable which produces the correct values until a GraphQL error is returned', async () => {
        expect(onNext).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        clearMocks();

        mockSubscription.next({ data: { one: 'A' } });

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledWith({ data: { one: 'A' } });
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        clearMocks();

        mockSubscription.next({ data: { one: 'B' } });

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledWith({ data: { one: 'B' } });
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        clearMocks();

        mockSubscription.next({ data: undefined, errors: [{ message: 'GraphQL Error' }] });

        expect(onNext).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(new Error('GraphQL Error'));
        expect(onComplete).not.toHaveBeenCalled();
      });

      it('returns an observable which produces the correct values until a GraphQL network error is returned', async () => {
        expect(onNext).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        clearMocks();

        mockSubscription.next({ data: { one: 'A' } });

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledWith({ data: { one: 'A' } });
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        clearMocks();

        mockSubscription.error(new Error('GraphQL Network Error'));

        expect(onNext).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledTimes(1);
        expect(onError).toHaveBeenCalledWith(new Error('GraphQL Network Error'));
        expect(onComplete).not.toHaveBeenCalled();

        expect(console.warn).not.toHaveBeenCalled();
      });

      it('returns an observable which produces the correct values until the subscription is completed', async () => {
        expect(onNext).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        clearMocks();

        mockSubscription.next({ data: { one: 'A' } });

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledWith({ data: { one: 'A' } });
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        clearMocks();

        mockSubscription.complete();

        expect(onNext).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledWith();

        expect(console.warn).not.toHaveBeenCalled();
      });

      it('throws when a handler is added for the same query', () => {
        expect(() => mockClient.setRequestHandler(queryOne, jest.fn())).toThrowError('Request handler already defined ');
      });
    });

    describe('Given request handler is not defined', () => {
      it('throws when attempting to subscribe to query', () => {
        expect(() => mockClient.subscribe({ query: queryTwo }))
          .toThrowError('Request handler not defined for query');
      });
    });
  });
});
