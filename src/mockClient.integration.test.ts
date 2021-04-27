import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloQueryResult, ApolloError } from 'apollo-client';
import gql from 'graphql-tag';

// Currently do not test against all valid peer dependency versions of apollo
// Would be nice to have, but can't find an elegant way of doing it.

import { createMockClient, MockApolloClient } from './mockClient';
import { createMockSubscription, IMockSubscription } from './mockSubscription';

describe('MockClient integration tests', () => {
  let mockClient: MockApolloClient;

  beforeEach(() => {
    jest
      .spyOn(console, 'warn')
      .mockReset();

    jest
      .spyOn(console, 'error')
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
      it('throws when executing the query', async () => {
        await expect(mockClient.query({ query: queryTwo }))
          .rejects
          .toThrowError('Request handler not defined for query');
      });
    });
  });

  describe('Client directives', () => {
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

      it('warns when request handler is added', () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).toBeCalledTimes(1);
        expect(console.warn).toBeCalledWith('Warning: mock-apollo-client - The query is entirely client side (using @client directives) and resolvers have been configured. ' +
          'The request handler will not be called.');
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

      it('does not warn when request handler is added and handles request', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).not.toBeCalled();

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ visibilityFilter: 'handler data' });
        expect(requestHandler).toHaveBeenCalledTimes(1);
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

  describe('Fragments', () => {
    describe('Given cache has addTypename enabled and query contains a fragment spread', () => {
      const query = gql`
        query User {
          user {
            ...UserDetails
          }
        }
        fragment UserDetails on User {
          id
          name
        }
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          cache: new InMemoryCache({
            addTypename: true,
          }),
        });

        requestHandler = jest.fn().mockResolvedValue({ data: { user: { __typename: 'User', id: 1, name: 'Bob' } } });
      });

      it('does not warn or error when request handler is added and request is handled', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).not.toBeCalled();
        expect(console.error).not.toBeCalled();

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ user: { __typename: 'User', id: 1, name: 'Bob' } });
        expect(requestHandler).toBeCalledTimes(1);

        expect(console.warn).not.toBeCalled();
        expect(console.error).not.toBeCalled();
      });
    });

    describe('Given cache has addTypename enabled, with fragment matcher defined and query contains an inline fragment for a union type', () => {
      const query = gql`
        query Hardware {
          hardware {
            id
            ... on Memory {
              size
            }
            ... on Cpu {
              speed
            }
          }
        }
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          cache: new InMemoryCache({
            addTypename: true,
            fragmentMatcher: {
              match: (_id, typeCondition, _context) => {
                return typeCondition === 'Memory';
              },
            },
          }),
        });

        requestHandler = jest.fn().mockResolvedValue({ data: { hardware: { __typename: 'Memory', id: 2, size: '16gb', speed: 'fast', brand: 'Samsung' } } });
      });

      it('does not warn or error when request handler is added and request is handled', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).not.toBeCalled();
        expect(console.error).not.toBeCalled();

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ hardware: { __typename: 'Memory', id: 2, size: '16gb' } });
        expect(requestHandler).toBeCalledTimes(1);

        expect(console.warn).not.toBeCalled();
        expect(console.error).not.toBeCalled();
      });
    });

    describe('Given cache has addTypename enabled and mutation contains a fragment spread', () => {
      const mutation = gql`
        mutation AddUser($name: String!) {
          addUser(name: $name) {
            ...UserDetails
          }
        }
        fragment UserDetails on User {
          id
          name
        }
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          cache: new InMemoryCache({
            addTypename: true,
          }),
        });

        requestHandler = jest.fn().mockResolvedValue({ data: { addUser: { __typename: 'User', id: 7, name: 'Barry' } } });
      });

      it('does not warn or error when request handler is added and request is handled', async () => {
        mockClient.setRequestHandler(mutation, requestHandler);

        expect(console.warn).not.toBeCalled();
        expect(console.error).not.toBeCalled();

        const result = await mockClient.mutate({ mutation, variables: { name: 'Barry' } });

        expect(result.data).toEqual({ addUser: { __typename: 'User', id: 7, name: 'Barry' } });
        expect(requestHandler).toBeCalledTimes(1);
        expect(requestHandler).toBeCalledWith({ name: 'Barry' });

        expect(console.warn).not.toBeCalled();
        expect(console.error).not.toBeCalled();
      });
    });

    describe('Given cache has addTypename enabled, with fragment matcher defined and mutation contains an inline fragment for a union type', () => {
      const mutation = gql`
        mutation UpdateHardware($id: String!, $quantity: Int!) {
          updateHardware(id: $id, quantity: $quantity) {
            id
            quantity
            ... on Memory {
              size
            }
            ... on Cpu {
              speed
            }
          }
        }
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          cache: new InMemoryCache({
            addTypename: true,
            fragmentMatcher: {
              match: (_id, typeCondition, _context) => {
                return typeCondition === 'Memory';
              },
            },
          }),
        });

        requestHandler = jest.fn().mockResolvedValue({
          data: {
            updateHardware: {
              __typename: 'Memory',
              id: 2,
              quantity: 7,
              size: '16gb',
            },
          },
        });
      });

      it('does not warn or error when request handler is added and request is handled', async () => {
        mockClient.setRequestHandler(mutation, requestHandler);

        expect(console.warn).not.toBeCalled();
        expect(console.error).not.toBeCalled();

        const result = await mockClient.mutate({ mutation, variables: { id: 2, quantity: 7 } });
        expect(requestHandler).toBeCalledWith({ id: 2, quantity: 7 });

        expect(result.data).toEqual({ updateHardware: { __typename: 'Memory', id: 2, quantity: 7, size: '16gb' } });
        expect(requestHandler).toBeCalledTimes(1);

        expect(console.warn).not.toBeCalled();
        expect(console.error).not.toBeCalled();
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

        mockSubscription.next({ errors: [{ message: 'GraphQL Error' }] });

        expect(onNext).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalled();
        expect(onError).toHaveBeenCalledWith(new ApolloError({ graphQLErrors: [{ message: 'GraphQL Error' } as any] }));
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
