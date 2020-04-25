import gql from 'graphql-tag';

// Currently do not test against all valid peer dependency versions of apollo
// Would be nice to have, but can't find an elegant way of doing it.

import { createMockClient, MockApolloClient } from './mockClient';
import { ApolloQueryResult } from 'apollo-client';

describe('MockClient integration tests', () => {
  let mockClient: MockApolloClient;

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
    describe('Given query which entirely uses cache', () => {
      const clientDirectiveQuery = gql` { visibilityFilter @client }`;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        // Empty resolvers required when only using client cache
        // https://www.apollographql.com/docs/react/data/local-state/#handling-client-fields-with-the-cache
        mockClient = createMockClient({ resolvers: {} });

        requestHandler = jest.fn().mockResolvedValue({ data: { visibilityFilter: 'mock handler data' } });
        mockClient.writeData({ data: { visibilityFilter: 'mock cache data' } });

        mockClient.setRequestHandler(clientDirectiveQuery, requestHandler);
      });

      it('uses local state and does not call request handler', async () => {
        const result = await mockClient.query({ query: clientDirectiveQuery });

        expect(result.data).toEqual({ visibilityFilter: 'mock cache data' });
        expect(requestHandler).not.toBeCalled();
      });
    });

    describe('Given query which partially uses cache', () => {
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
        // Empty resolvers required when only using client cache
        // https://www.apollographql.com/docs/react/data/local-state/#handling-client-fields-with-the-cache
        mockClient = createMockClient({ resolvers: {} });

        requestHandler = jest.fn().mockResolvedValue({ data: { user: { id: 1, name: 'bob' } } });
        mockClient.writeData({ data: { user: { isLoggedIn: true } } });

        mockClient.setRequestHandler(query, requestHandler);
      });

      it('combines local state and request handler result', async () => {
        const result = await mockClient.query({ query });

        expect(result.data).toEqual({ user: { id: 1, name: 'bob', isLoggedIn: true } });
        expect(requestHandler).toBeCalledTimes(1);
      });
    });
  });
});
