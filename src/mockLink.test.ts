import { Operation } from 'apollo-link';
import gql from 'graphql-tag';

import { MockLink } from './mockLink';

describe('class MockLink', () => {
  let mockLink: MockLink;

  const queryOne = gql`query One {one}`;
  const queryTwo = gql`query Two {two}`;

  beforeEach(() => {
    mockLink = new MockLink();
  });

  describe('method setRequestHandler', () => {
    it('throws when a handler has already been defined for a query', () => {
      mockLink.setRequestHandler(queryOne, () => Promise.resolve({ data: {} }));

      expect(() => mockLink.setRequestHandler(queryOne, () => <any>{}))
        .toThrow('Request handler already defined for query');
    });

    it('does not throw when two handlers are added for two different queries', () => {
      expect(() => {
        mockLink.setRequestHandler(queryOne, () => Promise.resolve({ data: {} }));
        mockLink.setRequestHandler(queryTwo, () => Promise.resolve({ data: {} }));
      }).not.toThrow();
    });

    it('does not throw when a handler has already been defined but override is true', () => {
      expect(() => {
        mockLink.setRequestHandler(queryOne, () => Promise.resolve({ data: {} }));
        mockLink.setRequestHandler(queryOne, () => Promise.resolve({ data: {} }), {replace: true});
      }).not.toThrow();
    });
  });

  describe('method request', () => {
    const queryOneOperation = { query: queryOne, variables: { a: 'one'} } as Partial<Operation> as Operation;

    it('throws when a handler is not defined for the query', () => {
      expect(() => mockLink.request(queryOneOperation))
        .toThrow('Request handler not defined for query');
    });

    it('does not throw when a handler is defined for the query', () => {
      mockLink.setRequestHandler(queryOne, () => Promise.resolve({ data: {} }));

      expect(() => mockLink.request(queryOneOperation))
        .not.toThrow();
    });

    it('correctly executes the handler when the handler successfully resolves', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 'Query one result' });
      mockLink.setRequestHandler(queryOne, handler);

      const observer = mockLink.request(queryOneOperation);

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      observer.subscribe(next, error, complete);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(next).toBeCalledTimes(1);
      expect(next).toBeCalledWith({ data: 'Query one result' });
      expect(error).not.toBeCalled();
      expect(complete).toBeCalledTimes(1);
    });

    it('correctly executes the handler when the handler rejects', async () => {
      const handler = jest.fn().mockRejectedValue('Test error');
      mockLink.setRequestHandler(queryOne, handler);

      const observer = mockLink.request(queryOneOperation);

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      observer.subscribe(next, error, complete);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(next).not.toBeCalled();
      expect(error).toBeCalledTimes(1);
      expect(error).toBeCalledWith('Test error');
      expect(complete).not.toBeCalled();
    });

    it('throws when the handler returns undefined', async () => {
      const handler = jest.fn();
      mockLink.setRequestHandler(queryOne, handler);

      expect(() => mockLink.request(queryOneOperation))
        .toThrow("Request handler must return a promise. Received 'undefined'.");
    });

    it('throws when the handler throws', async () => {
      const handler = jest.fn(() => { throw new Error('Error in handler') });
      mockLink.setRequestHandler(queryOne, handler);

      expect(() => mockLink.request(queryOneOperation))
        .toThrow("Unexpected error whilst calling request handler: Error in handler");
    });
  });
});
