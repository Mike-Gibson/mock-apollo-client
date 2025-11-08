import { ApolloClient, gql, InMemoryCache } from '@apollo/client';
import { print } from 'graphql';

// Currently do not test against all valid peer dependency versions of apollo
// Would be nice to have, but can't find an elegant way of doing it.

import { createMockClient, MockApolloClient } from './mockClient';
import { createMockSubscription, IMockSubscription } from './mockSubscription';
import { LocalState } from '@apollo/client/local-state';
import { CombinedGraphQLErrors } from '@apollo/client';

describe('MockClient integration tests', () => {
  let mockClient: MockApolloClient;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockReset();

    jest.spyOn(console, 'error').mockReset();
  });

  describe('Simple queries', () => {
    const queryOne = gql`
      query One {
        one
      }
    `;
    const queryTwo = gql`
      query Two {
        two
      }
    `;

    let requestHandlerOne: jest.Mock;
    let resolveRequestOne: Function;

    beforeEach(() => {
      mockClient = createMockClient();

      requestHandlerOne = jest.fn(
        () =>
          new Promise((r) => {
            resolveRequestOne = r;
          }),
      );

      mockClient.setRequestHandler(queryOne, requestHandlerOne);
    });

    describe('Given request handler is defined', () => {
      let promise: Promise<ApolloClient.QueryResult<any>>;

      beforeEach(() => {
        promise = mockClient.query({ query: queryOne });
      });

      it('returns a promise which resolves to the correct value', async () => {
        expect(promise).toBeInstanceOf(Promise);

        resolveRequestOne({ data: { one: 'one' } });

        const actual = await promise;

        expect(actual).toEqual(
          expect.objectContaining({ data: { one: 'one' } }),
        );
      });

      it('throws when a handler is added for the same query', () => {
        expect(() => mockClient.setRequestHandler(queryOne, jest.fn())).toThrow(
          'Request handler already defined ',
        );
      });
    });

    describe('Given request handler is not defined', () => {
      it('returns a promise which rejects and logs warning in console', async () => {
        let promise = mockClient.query({ query: queryTwo });

        await expect(promise).rejects.toThrow(
          'Request handler not defined for query',
        );

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          `Warning: mock-apollo-client - Request handler not defined for query: ${print(queryTwo)}`,
        );
      });

      it('returns a promise which rejects and does not log warning in console when "suppressMissingHandlerWarning" is true', async () => {
        mockClient = createMockClient({
          suppressMissingHandlerWarning: true,
        });

        let promise = mockClient.query({ query: queryTwo });

        await expect(promise).rejects.toThrow(
          'Request handler not defined for query',
        );
        expect(console.warn).not.toHaveBeenCalled();
      });
    });

    describe('Given request handler has been removed', () => {
      it('returns a promise which rejects and logs warning in console', async () => {
        mockClient.setRequestHandler(queryTwo, jest.fn());
        mockClient.removeRequestHandler(queryTwo);

        await expect(() =>
          mockClient.query({ query: queryTwo }),
        ).rejects.toThrow('Request handler not defined for query');
      });

      it('returns a promise which rejects and does not log warning in console when "suppressMissingHandlerWarning" is true', async () => {
        mockClient = createMockClient({
          suppressMissingHandlerWarning: true,
        });

        mockClient.setRequestHandler(queryTwo, jest.fn());
        mockClient.removeRequestHandler(queryTwo);

        let promise = mockClient.query({ query: queryTwo });

        await expect(promise).rejects.toThrow(
          'Request handler not defined for query',
        );
        expect(console.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('__typename behaviour', () => {
    const queryWithoutTypename = gql`
      query TestQuery {
        people {
          id
          name
        }
      }
    `;
    const queryWithTypename = gql`
      query TestQuery {
        people {
          __typename
          id
          name
        }
      }
    `;

    let requestHandler: jest.Mock;

    beforeEach(() => {
      mockClient = createMockClient();

      requestHandler = jest.fn().mockResolvedValue({
        data: {
          people: [
            {
              id: 1,
              name: 'John',
            },
          ],
        },
      });
    });

    describe('Given request handler is registered against query with __typename field', () => {
      beforeEach(() => {
        mockClient.setRequestHandler(queryWithTypename, requestHandler);
      });

      it('returns the expected result', async () => {
        const actual = await mockClient.query({
          query: queryWithTypename,
        });

        expect(actual).toEqual(
          expect.objectContaining({
            data: { people: [{ id: 1, name: 'John' }] },
          }),
        );
      });
    });

    describe('Given request handler is registered against query without __typename field', () => {
      beforeEach(() => {
        mockClient.setRequestHandler(queryWithoutTypename, requestHandler);
      });

      it('returns the expected result', async () => {
        const actual = await mockClient.query({
          query: queryWithoutTypename,
        });

        expect(actual).toEqual(
          expect.objectContaining({
            data: { people: [{ id: 1, name: 'John' }] },
          }),
        );
      });
    });
  });

  describe('Client directives', () => {
    describe('Given entire query is client-side and client side resolvers exist', () => {
      const query = gql`
        query A {
          visibilityFilter @client
        }
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          localState: new LocalState({
            resolvers: {
              Query: {
                visibilityFilter: () => 'client resolver data',
              },
            },
          }),
        });

        requestHandler = jest.fn().mockResolvedValue({
          data: {
            visibilityFilter: 'handler data',
          },
        });
      });

      it('warns when request handler is added and does not handle request', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          'Warning: mock-apollo-client - The query is entirely client side (using @client directives) so the request handler will not be registered.',
        );

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({
          visibilityFilter: 'client resolver data',
        });
        expect(requestHandler).not.toHaveBeenCalled();
      });
    });

    describe('Given entire query is client-side and client side resolvers do not exist', () => {
      const query = gql`
        query A {
          visibilityFilter @client
        }
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient({
          localState: new LocalState({
            resolvers: undefined,
          }),
        });

        requestHandler = jest.fn().mockResolvedValue({
          data: {
            visibilityFilter: 'handler data',
          },
        });
      });

      it('warns when request handler is added and does not handle request', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).toHaveBeenCalledTimes(1);
        expect(console.warn).toHaveBeenCalledWith(
          'Warning: mock-apollo-client - The query is entirely client side (using @client directives) so the request handler will not be registered.',
        );

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ visibilityFilter: null });
        expect(requestHandler).not.toHaveBeenCalled();
      });
    });

    describe('Given part of the query is client-side and client side resolvers exist', () => {
      const query = gql`
        query UserQuery {
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
          localState: new LocalState({
            resolvers: {
              User: {
                isLoggedIn: () => true,
              },
            },
          }),
        });

        requestHandler = jest.fn().mockResolvedValue({
          data: {
            user: { __typename: 'User', id: 1, name: 'bob' },
          },
        });
      });

      it('does not warn when request handler is added and handles request with merging', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).not.toHaveBeenCalled();

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({
          user: { __typename: 'User', id: 1, name: 'bob', isLoggedIn: true },
        });
        expect(requestHandler).toHaveBeenCalledTimes(1);
        expect(console.warn).not.toHaveBeenCalled();
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
          localState: new LocalState({
            resolvers: undefined,
          }),
        });

        requestHandler = jest.fn().mockResolvedValue({
          data: {
            user: { __typename: 'User', id: 1, name: 'bob' },
          },
        });
      });

      it('does not warn when request handler is added and handles request', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).not.toHaveBeenCalled();

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({
          user: { __typename: 'User', id: 1, name: 'bob', isLoggedIn: null },
        });
        expect(requestHandler).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Connection directives', () => {
    describe('Given query contains @connection directive', () => {
      const query = gql`
        query A {
          items @connection(key: "foo") {
            id
          }
        }
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient();

        requestHandler = jest.fn().mockResolvedValue({
          data: { items: [{ id: 1 }] },
        });
      });

      it('correctly executes the registered request handler and returns the correct result', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ items: [{ id: 1 }] });

        expect(console.warn).not.toHaveBeenCalled();
      });
    });
  });

  describe('Fragments', () => {
    describe('Given query contains a fragment spread', () => {
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
        mockClient = createMockClient();

        requestHandler = jest.fn().mockResolvedValue({
          data: { user: { __typename: 'User', id: 1, name: 'Bob' } },
        });
      });

      it('does not warn or error when request handler is added and request is handled', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({
          user: { __typename: 'User', id: 1, name: 'Bob' },
        });
        expect(requestHandler).toHaveBeenCalledTimes(1);

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
      });
    });

    describe('Given possible types defined and query contains an inline fragment for a union type', () => {
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
            possibleTypes: {
              Hardware: ['Memory', 'Cpu'],
            },
          }),
        });

        requestHandler = jest.fn().mockResolvedValue({
          data: {
            hardware: {
              __typename: 'Memory',
              id: 2,
              size: '16gb',
              speed: 'fast',
              brand: 'Samsung',
            },
          },
        });
      });

      it('does not warn or error when request handler is added and request is handled', async () => {
        mockClient.setRequestHandler(query, requestHandler);

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({
          hardware: { __typename: 'Memory', id: 2, size: '16gb' },
        });
        expect(requestHandler).toHaveBeenCalledTimes(1);

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
      });
    });

    describe('Given mutation contains a fragment spread', () => {
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
        mockClient = createMockClient();

        requestHandler = jest.fn().mockResolvedValue({
          data: { addUser: { __typename: 'User', id: 7, name: 'Barry' } },
        });
      });

      it('does not warn or error when request handler is added and request is handled', async () => {
        mockClient.setRequestHandler(mutation, requestHandler);

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();

        const result = await mockClient.mutate({
          mutation,
          variables: { name: 'Barry' },
        });

        expect(result.data).toEqual({
          addUser: { __typename: 'User', id: 7, name: 'Barry' },
        });
        expect(requestHandler).toHaveBeenCalledTimes(1);
        expect(requestHandler).toHaveBeenCalledWith({ name: 'Barry' });

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
      });
    });

    describe('Given possible types are defined and mutation contains an inline fragment for a union type', () => {
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
            possibleTypes: {
              Hardware: ['Memory', 'Cpu'],
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

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();

        const result = await mockClient.mutate({
          mutation,
          variables: { id: 2, quantity: 7 },
        });
        expect(requestHandler).toHaveBeenCalledWith({ id: 2, quantity: 7 });

        expect(result.data).toEqual({
          updateHardware: {
            __typename: 'Memory',
            id: 2,
            quantity: 7,
            size: '16gb',
          },
        });
        expect(requestHandler).toHaveBeenCalledTimes(1);

        expect(console.warn).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
      });
    });
  });

  describe('Subscriptions', () => {
    const queryOne = gql`
      subscription One {
        one
      }
    `;
    const queryTwo = gql`
      subscription Two {
        two
      }
    `;

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

        const observable = mockClient.subscribe({
          query: queryOne,
          variables: { a: 1 },
        });

        observable.subscribe(onNext, onError, onComplete);
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

        mockSubscription.next({
          data: undefined,
          errors: [{ message: 'GraphQL Error' }],
        });

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledWith({
          error: expect.any(CombinedGraphQLErrors),
        });
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).not.toHaveBeenCalled();

        expect(console.warn).not.toHaveBeenCalled();
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

        expect(onNext).toHaveBeenCalledWith({
          error: new Error('GraphQL Network Error'),
        });
        expect(onError).not.toHaveBeenCalled();
        expect(onComplete).toHaveBeenCalledTimes(1);

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
        expect(() => mockClient.setRequestHandler(queryOne, jest.fn())).toThrow(
          'Request handler already defined ',
        );
      });
    });

    describe('Given request handler is not defined', () => {
      it('calls onNext with error on observer after subscribing to observable', () => {
        const onNext = jest.fn();

        const observable = mockClient.subscribe({ query: queryTwo });

        observable.subscribe({ next: onNext });

        expect(onNext).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenLastCalledWith({
          error: new Error(
            `Request handler not defined for query: ${print(queryTwo)}`,
          ),
        });
      });
    });
  });
});
