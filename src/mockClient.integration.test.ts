import gql from 'graphql-tag';

// Currently do not test against all valid peer dependency versions of apollo
// Would be nice to have, but can't find an elegant way of doing it.

import { createMockClient, MockApolloClient } from './mockClient';
import { ApolloQueryResult } from 'apollo-client';

describe('MockClient integration tests', () => {
  let mockClient: MockApolloClient;

  beforeEach(() => {
    jest.spyOn(console, 'warn');
    jest.spyOn(console, 'error');
  });

  afterEach(() => {
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  describe('Basic tests', () => {
    describe('Given a request handler has been defined', () => {
      const queryOne = gql`query One {one}`;
      const queryTwo = gql`query Two {two}`;

      let requestHandlerOne: jest.Mock;
      let resolveRequestOne: Function;

      beforeEach(() => {
        mockClient = createMockClient();

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
  });

  describe('Fragments', () => {
    describe('Given a query with a simple fragment', () => {
      const query = gql`
        query Comment {...CommentFragment}
        fragment CommentFragment on Comment {id text}
      `;

      let requestHandler: jest.Mock;

      beforeEach(() => {
        mockClient = createMockClient();

        requestHandler = jest.fn()

        requestHandler.mockResolvedValue({ data: { id: 1, text: 'hello' } });

        mockClient.setRequestHandler(query, requestHandler);
      });

      describe('when the query is executed', () => {
        let promise: Promise<any>;

        beforeEach(() => {
          promise = mockClient.query({ query });
        });

        it('returns a promise which resolves to the correct value', async () => {
          expect(promise).toBeInstanceOf(Promise);

          const actual = await promise;

          console.log(actual)

          expect(actual).toEqual(expect.objectContaining({ data: { id: 1, text: 'hello' } }));
        });

        it('returns a promise which resolves to the correct value when called twice', async () => {
          expect(promise).toBeInstanceOf(Promise);

          const actual = await promise;

          expect(actual).toEqual(expect.objectContaining({ data: { id: 1, text: 'hello' } }));

          requestHandler.mockResolvedValue({ data: { id: 2, text: 'world' } });
          promise = mockClient.query({ query });

          const actualSecondCall = await promise;

          expect(actualSecondCall).toEqual(expect.objectContaining({ data: { id: 2, text: 'world' } }));
        });
      });
    });
  });
});
