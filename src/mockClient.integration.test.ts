import { ApolloQueryResult } from 'apollo-client';
import gql from 'graphql-tag';

// Currently do not test against all valid peer dependency versions of apollo
// Would be nice to have, but can't find an elegant way of doing it.

import { createMockClient, MockApolloClient } from './mockClient';

describe('MockClient integration tests', () => {
  let mockClient: MockApolloClient;

  beforeEach(() => {
    jest.spyOn(console, 'warn')
      .mockReset();
    jest.spyOn(console, 'error')
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

      it('throws when request handler has not been configured to include client directives', () => {
        expect(() => {
          mockClient.setRequestHandler(query, requestHandler, { includeClientDirectives: false });
        }).toThrowError('The query after normalisation is null');

        expect(console.warn).not.toBeCalled();
      });

      it('warns when request handler has been configured to include client directives and does not handle request', async () => {
        expect(() => {
          mockClient.setRequestHandler(query, requestHandler, { includeClientDirectives: true });
        }).not.toThrow();

        expect(console.warn).toBeCalledTimes(1);
        expect(console.warn).toBeCalledWith('Warning: mock-apollo-client - includeClientDirectives should not be used when local resolvers have been configured.');

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

      it('throws when request handler has not been configured to include client directives', () => {
        expect(() => {
          mockClient.setRequestHandler(query, requestHandler, { includeClientDirectives: false });
        }).toThrowError('The query after normalisation is null');

        expect(console.warn).not.toBeCalled();
      });

      it('does not warn when request handler has been configured to include client directives and handles request', async () => {
        expect(() => {
          mockClient.setRequestHandler(query, requestHandler, { includeClientDirectives: true });
        }).not.toThrow();

        expect(console.warn).not.toBeCalled();

        const result = await mockClient.query({ query });
        expect(result.data).toEqual({ visibilityFilter: 'handler data' });
        expect(requestHandler).toHaveBeenCalledTimes(1);
      });
    });

    describe('Given part of the query is client-side and client side resolver exists', () => {
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

      it('returns merged result when request handler has not been configured to include client directives', async () => {
        mockClient.setRequestHandler(query, requestHandler, { includeClientDirectives: false });

        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ user: { id: 1, name: 'bob', isLoggedIn: true } });
        expect(requestHandler).toBeCalledTimes(1);
        expect(console.warn).not.toBeCalled();
      });

      it('warns when request handler has been configured to include client directives and does not handle request', async () => {
        expect(() => {
          mockClient.setRequestHandler(query, requestHandler, { includeClientDirectives: true });
        }).not.toThrow();

        expect(console.warn).toBeCalledTimes(1);
        expect(console.warn).toBeCalledWith('Warning: mock-apollo-client - includeClientDirectives should not be used when local resolvers have been configured.');

        await expect(mockClient.query({ query }))
          .rejects.toThrowError('Request handler not defined for query');
      });
    });
  });
});
