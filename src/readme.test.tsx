// @ts-nocheck

import { InMemoryCache } from 'apollo-cache-inmemory';
import ApolloClient from 'apollo-client';
import gql from 'graphql-tag';
import { createMockClient } from './mockClient';

describe('README examples tests', () => {
  describe('client directives', () => {
    // production code

    const GET_CURRENT_USER = gql`
      query CurrentUser {
        currentUser {
          id
          name
          authToken @client
        }
      }`;

    const resolvers = {
      Query: {
        authToken: () => sessionStorage.getItem('authToken'),
      },
    };

    const client = new ApolloClient({
      cache: new InMemoryCache(),
      resolvers,
    });

    // Then at some point, client.query({ query: GET_CURRENT_USER }) would be called.

    it('with resolvers', async () => {
      // Test code (using client resolvers)

      const mockClient = createMockClient({ resolvers });

      const handler = () => Promise.resolve({ data: { currentUser: { id: 1, name: 'Bob' } } });
      mockClient.setRequestHandler(GET_CURRENT_USER, handler);

      sessionStorage.setItem('authToken', 'abcd');

      // <TEST-CODE>
      const result = await mockClient.query({ query: GET_CURRENT_USER });

      expect(result.data).toEqual({ currentUser: { id: 1, name: 'Bob', authToken: 'abcd' } });
      // </TEST-CODE>
    });

    it('with resolvers and spies', async () => {
      // Test code (using client resolvers and spies)

      const mockClient = createMockClient({ resolvers });

      const handler = () => Promise.resolve({ data: { currentUser: { id: 1, name: 'Bob' } } });

      jest
        .spyOn(resolvers.Query, 'authToken')
        .mockReturnValue('abcd');

      mockClient.setRequestHandler(GET_CURRENT_USER, handler);

      // <TEST-CODE>
      const result = await mockClient.query({ query: GET_CURRENT_USER });

      expect(result.data).toEqual({ currentUser: { id: 1, name: 'Bob', authToken: 'abcd' } });
      expect(resolvers.Query.authToken).toBeCalledTimes(1);
      // </TEST-CODE>
    });

    it('without resolvers - invalid', () => {
      // Invalid test code (without client resolvers)

      const mockClient = createMockClient(); // resolvers not specified

      const handler = () => Promise.resolve({
        data: { currentUser: { id: 1, name: 'Bob', authToken: 'abc' } },
      });

      mockClient.setRequestHandler(GET_CURRENT_USER, handler);
    });

    it('without resolvers - valid', async () => {
      // Test code (without client resolvers)

      const mockClient = createMockClient(); // resolvers not specified

      const handler = () => Promise.resolve({
        data: { currentUser: { id: 1, name: 'Bob', authToken: 'abc' } },
      });

      mockClient.setRequestHandler(GET_CURRENT_USER, handler, { includeClientDirectives: true });

      // <TEST-CODE>
      // Suppress Apollo warning
      const consoleSpy = jest.spyOn(console, 'warn')
        .mockImplementation(() => {});

      const result = await mockClient.query({ query: GET_CURRENT_USER });

      expect(result.data).toEqual({ currentUser: { id: 1, name: 'Bob', authToken: 'abc' } });

      consoleSpy.mockRestore();
      // </TEST-CODE>
    });
  });
});
