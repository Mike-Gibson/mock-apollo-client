import { InMemoryCache } from 'apollo-cache-inmemory';
import { ApolloQueryResult } from 'apollo-client';
import gql from 'graphql-tag';

// Currently do not test against all valid peer dependency versions of apollo
// Would be nice to have, but can't find an elegant way of doing it.

import { createMockClient, MockApolloClient } from './mockClient';

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
      let promise: Promise<ApolloQueryResult<any>>;

      beforeEach(() => {
        promise = mockClient.query({ query: queryTwo });
      });

      it('returns a promise which rejects due to handler not being defined', async () => {
        expect(promise).toBeInstanceOf(Promise);

        await expect(promise).rejects.toThrowError('Request handler not defined for query');
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
              user: () => ({ isLoggedIn: true, wtf: 'yes' }),
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
  });
});
