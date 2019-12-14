import gql from 'graphql-tag';

// Currently do not test against all valid peer dependency versions of apollo
// Would be nice to have, but can't find an elegant way of doing it.

import { createMockClient, MockApolloClient } from './mockClient';
import { ApolloQueryResult } from 'apollo-client';

describe('MockClient integration tests', () => {
  let mockClient: MockApolloClient;

  const queryOne = gql`query One {one}`;
  const queryTwo = gql`query Two {two}`;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  describe('Given a request handler has been defined', () => {
    let requestHandlerOne: jest.Mock;
    let resolveRequestOne: Function;

    beforeEach(() => {
      requestHandlerOne = jest.fn(() => new Promise((r) => { resolveRequestOne = r }));

      mockClient.setRequestHandler(queryOne, requestHandlerOne);
    });

    describe('query', () => {
      describe('when request handler is defined', () => {
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

      describe('when request handler is not defined', () => {
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
  });

  describe('createMockClient configuration options', () => {
    describe('replaceHandlers', () => {
      const requestHandlerOne = () => Promise.resolve({ data: { one: 'one' }});
      const requestHandlerTwo = () => Promise.resolve({ data: { one: 'two' }});

      it('is false by default', async () => {
        mockClient = createMockClient();

        mockClient.setRequestHandler(queryOne, requestHandlerOne);

        const promise = mockClient.query({ query: queryOne });

        const actual = await promise;

        expect(actual).toEqual(expect.objectContaining({ data: { one: 'one' } }));

        expect(() => mockClient.setRequestHandler(queryOne, requestHandlerTwo))
          .toThrow('Request handler already defined for query');
      });

      it('allows handlers to be replaced', async () => {
        mockClient = createMockClient({ replaceHandlers: true });

        mockClient.setRequestHandler(queryOne, requestHandlerOne);

        const promiseOne = mockClient.query({ query: queryOne });
        const actualOne = await promiseOne;

        expect(actualOne).toEqual(expect.objectContaining({ data: { one: 'one' } }));

        // Clear InMemoryCache
        await mockClient.resetStore();

        // Same request, different handler
        mockClient.setRequestHandler(queryOne, requestHandlerTwo);

        const promiseTwo = mockClient.query({ query: queryOne });
        const actualTwo = await promiseTwo;

        expect(actualTwo).toEqual(expect.objectContaining({ data: { one: 'two' } }));
      });
    });
  });
});
