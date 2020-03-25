import ApolloClient from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { MockLink } from './mockLink';

import { createMockClient } from './mockClient';

describe('MockClient tests', () => {
  describe('createMockClient method', () => {
    it('creates client when called with no options', () => {
      const mockClient = createMockClient();
  
      expect(mockClient).toBeInstanceOf(ApolloClient);
      expect(mockClient.cache).toBeInstanceOf(InMemoryCache);
      expect(mockClient.link).toBeInstanceOf(MockLink);
      expect(mockClient.setRequestHandler).toBeDefined();
    });
  
    it('creates client when called with options', () => {
      const options = {
        cache: {} as any,
        defaultOptions: {},
      };

      const mockClient = createMockClient(options);
  
      expect(mockClient).toBeInstanceOf(ApolloClient);
      expect(mockClient.cache).toBe(options.cache);
      expect(mockClient.link).toBeInstanceOf(MockLink);
      expect(mockClient.defaultOptions).toBe(options.defaultOptions);
    });

    it('throws when link is specified in options', () => {
      const options: any = {
        link: {},
      };

      expect(() => createMockClient(options)).toThrowError('Providing link to use is not supported.');
    });
  });
});
