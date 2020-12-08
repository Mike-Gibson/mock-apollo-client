import { gql, Operation, Observer } from '@apollo/client/core';
import { print } from 'graphql';

import { MockLink } from './mockLink';

describe('class MockLink', () => {
  let mockLink: MockLink;

  const queryOne = gql`query One {one}`;
  const queryTwo = gql`query Two {two}`;

  beforeEach(() => {
    jest.spyOn(console, 'warn')
      .mockReset();

    mockLink = new MockLink();
  });

  describe('method setRequestHandler', () => {
    it('throws when a handler has already been defined for a query', () => {
      mockLink.setRequestHandler(queryOne, () => Promise.resolve({ data: {} }));

      expect(() => mockLink.setRequestHandler(queryOne, () => <any>{}))
        .toThrow('Request handler already defined for query');

      expect(console.warn).not.toBeCalled();
    });

    it('does not throw when two handlers are added for two different queries', () => {
      expect(() => {
        mockLink.setRequestHandler(queryOne, () => Promise.resolve({ data: {} }));
        mockLink.setRequestHandler(queryTwo, () => Promise.resolve({ data: {} }));
      }).not.toThrow();
    });

    describe('when queries contain @client directives', () => {
      const clientSideQuery = gql`query One {one @client}`;
      const mixedQueryOne = gql`query Three {a @client b}`;
      const mixedQueryTwo = gql`query Four {c @client d}`;

      it('does not throw, but warns, when adding client-side query', () => {
        expect(() => {
          mockLink.setRequestHandler(clientSideQuery, jest.fn());
        }).not.toThrow();

        expect(console.warn).toBeCalledTimes(1);
        expect(console.warn).toBeCalledWith('Warning: mock-apollo-client - The query is entirely client side (using @client directives) so the request handler will not be registered.');
      });

      it('throws when the same mixed query is added twice', () => {
        mockLink.setRequestHandler(mixedQueryOne, jest.fn());

        expect(() => {
          mockLink.setRequestHandler(mixedQueryOne, jest.fn());
        }).toThrowError('Request handler already defined for query');

        expect(console.warn).not.toBeCalled();
      });

      it('does not throw when two different mixed queries are added', () => {
        mockLink.setRequestHandler(mixedQueryOne, jest.fn());

        expect(() => {
          mockLink.setRequestHandler(mixedQueryTwo, jest.fn());
        }).not.toThrow();

        expect(console.warn).not.toBeCalled();
      });
    });

    describe('when queries contain a @connection directive', () => {
      const connectionDirectiveQuery = gql`query One {one @connection(key: "foo")}`;
      const queryWithoutConnectionDirective = gql`query One {one}`;
      const anotherConnectionDirectiveQuery = gql`query Two {two @connection(key: "foo")}`;

      it('throws when a handler has already been defined for a query', () => {
        mockLink.setRequestHandler(connectionDirectiveQuery, () => Promise.resolve({ data: {} }));

        expect(() => mockLink.setRequestHandler(connectionDirectiveQuery, () => <any>{}))
          .toThrow('Request handler already defined for query');

        expect(console.warn).not.toBeCalled();
      });

      it('throws when a handler has already been defined for an equivalent query without the @connection directive', () => {
        mockLink.setRequestHandler(queryWithoutConnectionDirective, () => Promise.resolve({ data: {} }));

        expect(() => mockLink.setRequestHandler(connectionDirectiveQuery, () => <any>{}))
          .toThrow('Request handler already defined for query');

        expect(console.warn).not.toBeCalled();
      });

      it('does not throw when two handlers are added for two different queries with @connection directives', () => {
        expect(() => {
          mockLink.setRequestHandler(connectionDirectiveQuery, () => Promise.resolve({ data: {} }));
          mockLink.setRequestHandler(anotherConnectionDirectiveQuery, () => Promise.resolve({ data: {} }));
        }).not.toThrow();
      });
    });
  });

  describe('method request', () => {
    const queryOneOperation = { query: queryOne, variables: { a: 'one'} } as Partial<Operation> as Operation;

    const createMockObserver = (): jest.Mocked<Observer<any>> => ({
      next: jest.fn(),
      error: jest.fn(),
      complete: jest.fn(),
    });

    it('returns an error when a handler is not defined for the query', async () => {
      const observable = mockLink.request(queryOneOperation);

      const observer = createMockObserver();

      observable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(observer.next).not.toBeCalled();
      expect(observer.error).toBeCalledTimes(1);
      expect(observer.error).toBeCalledWith(new Error(`Request handler not defined for query: ${print(queryOne)}`));
      expect(observer.complete).not.toBeCalled();
    });

    it('correctly executes the handler when the handler successfully resolves', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 'Query one result' });
      mockLink.setRequestHandler(queryOne, handler);
      const observer = createMockObserver();

      const observerable = mockLink.request(queryOneOperation);

      observerable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(observer.next).toBeCalledTimes(1);
      expect(observer.next).toBeCalledWith({ data: 'Query one result' });
      expect(observer.error).not.toBeCalled();
      expect(observer.complete).toBeCalledTimes(1);
    });

    it('correctly executes the handler when the handler rejects', async () => {
      const handler = jest.fn().mockRejectedValue('Test error');
      mockLink.setRequestHandler(queryOne, handler);
      const observer = createMockObserver();

      const observerable = mockLink.request(queryOneOperation);

      observerable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(observer.next).not.toBeCalled();
      expect(observer.error).toBeCalledTimes(1);
      expect(observer.error).toBeCalledWith('Test error');
      expect(observer.complete).not.toBeCalled();
    });

    it('returns an error when the handler returns undefined', async () => {
      const handler = jest.fn().mockReturnValue(undefined);
      mockLink.setRequestHandler(queryOne, handler);
      const observer = createMockObserver();

      const observable = mockLink.request(queryOneOperation);

      observable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(observer.next).not.toBeCalled();
      expect(observer.error).toBeCalledTimes(1);
      expect(observer.error).toBeCalledWith(new Error("Request handler must return a promise. Received 'undefined'."));
      expect(observer.complete).not.toBeCalled();
    });

    it('returns an error when the handler throws', async () => {
      const handler = jest.fn(() => { throw new Error('Error in handler') });
      mockLink.setRequestHandler(queryOne, handler);
      const observer = createMockObserver();

      const observable = mockLink.request(queryOneOperation);

      observable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(observer.next).not.toBeCalled();
      expect(observer.error).toBeCalledTimes(1);
      expect(observer.error).toBeCalledWith(new Error('Unexpected error whilst calling request handler: Error in handler'));
      expect(observer.complete).not.toBeCalled();
    });
  });
});
