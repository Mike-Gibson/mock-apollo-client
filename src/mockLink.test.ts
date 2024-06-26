import { gql, Operation, Observer } from '@apollo/client/core';
import { print } from 'graphql';

import { MockLink } from './mockLink';
import { createMockSubscription } from './mockSubscription';

describe('class MockLink', () => {
  let mockLink: MockLink;

  const queryOne = gql`query One {one}`;
  const queryTwo = gql`query Two {two}`;

  const queryOneOperation = { query: queryOne, variables: { a: 'one' } } as Partial<Operation> as Operation;

  const createMockObserver = (): jest.Mocked<Observer<any>> => ({
    next: jest.fn(),
    error: jest.fn(),
    complete: jest.fn(),
  });

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

    describe('when queries contain __typename field', () => {
      it('does not throw when adding query', () => {
        const query = gql`query Person { __typename name }`;

        expect(() => {
          mockLink.setRequestHandler(query, jest.fn());
        }).not.toThrow();
      });
    });
  });

  describe('method request', () => {
    it('correctly executes the handler when the handler is defined as a promise and it and successfully resolves', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 'Query one result' });
      mockLink.setRequestHandler(queryOne, handler);
      const observer = createMockObserver();

      const observable = mockLink.request(queryOneOperation);

      observable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(observer.next).toBeCalledTimes(1);
      expect(observer.next).toBeCalledWith({ data: 'Query one result' });
      expect(observer.error).not.toBeCalled();
      expect(observer.complete).toBeCalledTimes(1);
    });

    it('correctly executes the handler when the handler is defined as a promise and it rejects', async () => {
      const handler = jest.fn().mockRejectedValue('Test error');
      mockLink.setRequestHandler(queryOne, handler);
      const observer = createMockObserver();

      const observable = mockLink.request(queryOneOperation);

      observable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(observer.next).not.toBeCalled();
      expect(observer.error).toBeCalledTimes(1);
      expect(observer.error).toBeCalledWith('Test error');
      expect(observer.complete).not.toBeCalled();
    });

    it('returns an error when the handler is defined but returns undefined', async () => {
      const handler = jest.fn().mockReturnValue(undefined);
      mockLink.setRequestHandler(queryOne, handler);
      const observer = createMockObserver();

      const observable = mockLink.request(queryOneOperation);

      observable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(observer.next).not.toBeCalled();
      expect(observer.error).toBeCalledTimes(1);
      expect(observer.error).toBeCalledWith(new Error("Request handler must return a promise or subscription. Received 'undefined'."));
      expect(observer.complete).not.toBeCalled();
    });

    it('returns an error when the handler is defined but throws', async () => {
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

    it('correctly executes the handler when handler is defined as a subscription and it produces data', async () => {
      const subscription = createMockSubscription();
      const handler = jest.fn().mockReturnValue(subscription);
      mockLink.setRequestHandler(queryOne, handler);
      const observer = createMockObserver();

      const observable = mockLink.request(queryOneOperation);

      observable.subscribe(observer);

      subscription.next({ data: 'Query one result' });
      subscription.next({ data: 'Query one result' });

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(observer.next).toBeCalledTimes(2);
      expect(observer.next).toBeCalledWith({ data: 'Query one result' });
      expect(observer.error).not.toBeCalled();
      expect(observer.complete).not.toBeCalledTimes(1);
      expect(subscription.closed).toBe(false);
    })

    it('correctly executes the handler when handler is defined as a subscription and it produces an error', async () => {
      const subscription = createMockSubscription();
      const handler = jest.fn().mockReturnValue(subscription);
      mockLink.setRequestHandler(queryOne, handler);
      const observer = createMockObserver();

      const observable = mockLink.request(queryOneOperation);

      observable.subscribe(observer);

      subscription.error('Test error');

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(observer.next).not.toBeCalled();
      expect(observer.error).toBeCalledTimes(1);
      expect(observer.error).toBeCalledWith('Test error');
      expect(observer.complete).not.toBeCalled();
      expect(subscription.closed).toBe(true);
    });

    it('correctly executes the handler when query contains __typename field', async () => {
      const personQueryWithTypename = gql`query Person { __typename name}`;
      const personQueryWithoutTypename = gql`query Person { name }`;

      const handler = jest.fn().mockResolvedValue({ data: { __typename: 'Person', name: 'Bob' } });
      mockLink.setRequestHandler(personQueryWithoutTypename, handler);
      const observer = createMockObserver();

      const queryOperation = { query: personQueryWithTypename } as Partial<Operation> as Operation;

      const observable = mockLink.request(queryOperation);

      observable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith(undefined);

      expect(observer.next).toBeCalledTimes(1);
      expect(observer.next).toBeCalledWith({ data: { __typename: 'Person', name: 'Bob' } });
      expect(observer.error).not.toBeCalled();
      expect(observer.complete).toBeCalledTimes(1);
    });
  });

  describe('constructor option "missingHandlerPolicy"', () => {
    it('when "throw-error" throws when a handler is not defined for the query', () => {
      mockLink = new MockLink({missingHandlerPolicy: 'throw-error'})

      expect(() => mockLink.request(queryOneOperation))
        .toThrowError(`Request handler not defined for query: ${print(queryOne)}`)
    });

    it('when "warn-and-return-error" logs a warning when a handler is not defined for the query', async () => {
      mockLink = new MockLink({missingHandlerPolicy: 'warn-and-return-error'})

      const observable = mockLink.request(queryOneOperation);
      const observer = createMockObserver();

      observable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(observer.next).not.toBeCalled();
      expect(observer.error).toBeCalled();
      expect(observer.complete).not.toBeCalled();
      expect(console.warn).toBeCalledTimes(1);
      expect(console.warn).toBeCalledWith(`Request handler not defined for query: ${print(queryOne)}`);
    });

    it('when "return-error" returns an error when a handler is not defined for the query', async () => {
      mockLink = new MockLink({missingHandlerPolicy: 'return-error'})

      const observable = mockLink.request(queryOneOperation);
      const observer = createMockObserver();

      observable.subscribe(observer);

      await new Promise(r => setTimeout(r, 0));

      expect(observer.next).not.toBeCalled();
      expect(observer.error).toBeCalledTimes(1);
      expect(observer.error).toBeCalledWith(new Error(`Request handler not defined for query: ${print(queryOne)}`));
      expect(observer.complete).not.toBeCalled();
    });
  })
});
