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

  describe('Cache', () => {
    describe('Given cache has data', () => {
      const query = gql`query GetComment($id:Number!) { comment(id: $id) { id, text } }`;

      beforeEach(async () => {
        mockClient = createMockClient();

        mockClient.setRequestHandler(
          query,
          () => Promise.resolve({ data: { comment: { id: 1, text: 'aa' } } }),
        );

        await mockClient.query({ query, variables: { id: 1 } });
      });

      it('readQuery returns correct data', async () => {
        const actual = mockClient.readQuery({ query, variables: { id: 1 } });

        expect(actual).toEqual({ comment: { id: 1, text: 'aa' } });
      });
    });
  });
});
