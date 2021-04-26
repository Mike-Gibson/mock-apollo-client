import { Operation } from 'apollo-link';
import { print } from 'graphql/language/printer';
import gql from 'graphql-tag';
import { createMockSubscription } from './mockSubscription';

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

    describe('when queries contain @client directives', () => {
      const clientSideQueryOne = gql`query One {one @client}`;
      const clientSideQueryTwo = gql`query Two {two @client}`;
      const mixedQueryOne = gql`query Three {a @client b}`;
      const mixedQueryTwo = gql`query Four {c @client d}`;

      it('does not throw when adding client-side query', () => {
        expect(() => {
          mockLink.setRequestHandler(clientSideQueryOne, jest.fn());
        }).not.toThrow();
      });

      it('throws when the same client-side only query is added twice', () => {
        mockLink.setRequestHandler(clientSideQueryOne, jest.fn());

        expect(() => {
          mockLink.setRequestHandler(clientSideQueryOne, jest.fn());
        }).toThrowError('Request handler already defined for query');
      });

      it('does not throw when two different client-side only queries are added', () => {
        mockLink.setRequestHandler(clientSideQueryOne, jest.fn());

        expect(() => {
          mockLink.setRequestHandler(clientSideQueryTwo, jest.fn());
        }).not.toThrow();
      });

      it('throws when the same mixed query is added twice', () => {
        mockLink.setRequestHandler(mixedQueryOne, jest.fn());

        expect(() => {
          mockLink.setRequestHandler(mixedQueryOne, jest.fn());
        }).toThrowError('Request handler already defined for query');
      });

      it('does not throw when two different mixed queries are added', () => {
        mockLink.setRequestHandler(mixedQueryOne, jest.fn());

        expect(() => {
          mockLink.setRequestHandler(mixedQueryTwo, jest.fn());
        }).not.toThrow();
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
    const queryOneOperation = { query: queryOne, variables: { a: 'one' } } as Partial<Operation> as Operation;

    it('throws when a handler is not defined for the query', () => {
      expect(() => mockLink.request(queryOneOperation))
        .toThrowError(`Request handler not defined for query: ${print(queryOne)}`);
    });

    it('does not throw when a handler is defined for the query', () => {
      mockLink.setRequestHandler(queryOne, () => Promise.resolve({ data: {} }));

      expect(() => mockLink.request(queryOneOperation))
        .not.toThrow();
    });

    it('correctly executes the handler when the handler is defined as a promise and it and successfully resolves', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 'Query one result' });
      mockLink.setRequestHandler(queryOne, handler);

      const observerable = mockLink.request(queryOneOperation);

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      observerable.subscribe(next, error, complete);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(next).toBeCalledTimes(1);
      expect(next).toBeCalledWith({ data: 'Query one result' });
      expect(error).not.toBeCalled();
      expect(complete).toBeCalledTimes(1);
    });

    it('correctly executes the handler when the handler is defined as a promise and it rejects', async () => {
      const handler = jest.fn().mockRejectedValue('Test error');
      mockLink.setRequestHandler(queryOne, handler);

      const observerable = mockLink.request(queryOneOperation);

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      observerable.subscribe(next, error, complete);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(next).not.toBeCalled();
      expect(error).toBeCalledTimes(1);
      expect(error).toBeCalledWith('Test error');
      expect(complete).not.toBeCalled();
    });

    it('returns an error when the handler is defined but returns undefined', async () => {
      const handler = jest.fn().mockReturnValue(undefined);
      mockLink.setRequestHandler(queryOne, handler);

      const observerable = mockLink.request(queryOneOperation);

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      observerable.subscribe(next, error, complete);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(next).not.toBeCalled();
      expect(error).toBeCalledTimes(1);
      expect(error).toBeCalledWith(new Error("Request handler must return a promise or subscription. Received 'undefined'."));
      expect(complete).not.toBeCalled();
    });

    it('returns an error when the handler is defined but throws', async () => {
      const handler = jest.fn(() => { throw new Error('Error in handler') });
      mockLink.setRequestHandler(queryOne, handler);

      const observerable = mockLink.request(queryOneOperation);

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      observerable.subscribe(next, error, complete);

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(next).not.toBeCalled();
      expect(error).toBeCalledTimes(1);
      expect(error).toBeCalledWith(new Error('Unexpected error whilst calling request handler: Error in handler'));
      expect(complete).not.toBeCalled();
    });

    it('correctly executes the handler when handler is defined as a subscription and it produces data', async () => {
      const subscription = createMockSubscription();
      const handler = jest.fn().mockReturnValue(subscription);
      mockLink.setRequestHandler(queryOne, handler);

      const observerable = mockLink.request(queryOneOperation);

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      observerable.subscribe(next, error, complete);

      subscription.next({ data: 'Query one result' });
      subscription.next({ data: 'Query one result' });

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(next).toBeCalledTimes(2);
      expect(next).toBeCalledWith({ data: 'Query one result' });
      expect(error).not.toBeCalled();
      expect(complete).not.toBeCalledTimes(1);
      expect(subscription.closed).toBe(false);
    })

    it('correctly executes the handler when handler is defined as a subscription and it produces an error', async () => {
      const subscription = createMockSubscription();
      const handler = jest.fn().mockReturnValue(subscription);
      mockLink.setRequestHandler(queryOne, handler);

      const observerable = mockLink.request(queryOneOperation);

      const next = jest.fn();
      const error = jest.fn();
      const complete = jest.fn();

      observerable.subscribe(next, error, complete);

      subscription.error('Test error');

      await new Promise(r => setTimeout(r, 0));

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith({ a: 'one' });

      expect(next).not.toBeCalled();
      expect(error).toBeCalledTimes(1);
      expect(error).toBeCalledWith('Test error');
      expect(complete).not.toBeCalled();
      expect(subscription.closed).toBe(true);
    });

    describe('when query contains @client directives', () => {
      it('correctly executes the handler when query is entirely client side', async () => {
        const clientSideQuery = gql`query One {one @client}`;

        const handler = jest.fn().mockResolvedValue({ data: 'Query result' });
        mockLink.setRequestHandler(clientSideQuery, handler);

        const queryOperation = { query: clientSideQuery, variables: { a: 'one'} } as Partial<Operation> as Operation;

        const observer = mockLink.request(queryOperation);

        const next = jest.fn();
        const error = jest.fn();
        const complete = jest.fn();

        observer.subscribe(next, error, complete);

        await new Promise(r => setTimeout(r, 0));

        expect(handler).toBeCalledTimes(1);
        expect(handler).toBeCalledWith({ a: 'one' });

        expect(next).toBeCalledTimes(1);
        expect(next).toBeCalledWith({ data: 'Query result' });
        expect(error).not.toBeCalled();
        expect(complete).toBeCalledTimes(1);
      });

      it('correctly executes the handler when query is mixed and there are no client resolvers', async () => {
        const mixedQuery = gql`query Two {a @client b}`;

        const handler = jest.fn().mockResolvedValue({ data: 'Query result' });
        mockLink.setRequestHandler(mixedQuery, handler);

        // When there are no client resolvers, client directives get passed down to the link
        const queryOperation = { query: mixedQuery, variables: { a: 'one'} } as Partial<Operation> as Operation;

        const observer = mockLink.request(queryOperation);

        const next = jest.fn();
        const error = jest.fn();
        const complete = jest.fn();

        observer.subscribe(next, error, complete);

        await new Promise(r => setTimeout(r, 0));

        expect(handler).toBeCalledTimes(1);
        expect(handler).toBeCalledWith({ a: 'one' });

        expect(next).toBeCalledTimes(1);
        expect(next).toBeCalledWith({ data: 'Query result' });
        expect(error).not.toBeCalled();
        expect(complete).toBeCalledTimes(1);
      });

      it.each`
      description | initialQuery | processedQuery
      ${'query is mixed and there are client resolvers'} | ${gql`query Two {a @client b}`} | ${gql`query Two {b}`}
      ${'query contains a @connection directive'} | ${gql`query Two {items @connection(key: "foo") { a b }}`} | ${gql`query Two {items { a b }}`}
      `('correctly executes the handler when $description', async ({ initialQuery, processedQuery }) => {
        const handler = jest.fn().mockResolvedValue({ data: 'Query result' });
        mockLink.setRequestHandler(initialQuery, handler);

        // Client and connection directives are removed before being passed down to the link
        const queryOperation = { query: processedQuery, variables: { a: 'one'} } as Partial<Operation> as Operation;

        const observer = mockLink.request(queryOperation);

        const next = jest.fn();
        const error = jest.fn();
        const complete = jest.fn();

        observer.subscribe(next, error, complete);

        await new Promise(r => setTimeout(r, 0));

        expect(handler).toBeCalledTimes(1);
        expect(handler).toBeCalledWith({ a: 'one' });

        expect(next).toBeCalledTimes(1);
        expect(next).toBeCalledWith({ data: 'Query result' });
        expect(error).not.toBeCalled();
        expect(complete).toBeCalledTimes(1);
      });
    });

    describe('when query contains __typename field', () => {
      it('correctly executes the handler', async () => {
        const personQueryWithTypename = gql`query Person { __typename name}`;
        const personQueryWithoutTypename = gql`query Person { name}`;

        const handler = jest.fn().mockResolvedValue({ data: { __typename: 'Person', name: 'Bob' } });
        mockLink.setRequestHandler(personQueryWithoutTypename, handler);

        const queryOperation = { query: personQueryWithTypename } as Partial<Operation> as Operation;

        const observer = mockLink.request(queryOperation);

        const next = jest.fn();
        const error = jest.fn();
        const complete = jest.fn();

        observer.subscribe(next, error, complete);

        await new Promise(r => setTimeout(r, 0));

        expect(handler).toBeCalledTimes(1);
        expect(handler).toBeCalledWith(undefined);

        expect(next).toBeCalledTimes(1);
        expect(next).toBeCalledWith({ data: { __typename: 'Person', name: 'Bob' } });
        expect(error).not.toBeCalled();
        expect(complete).toBeCalledTimes(1);
      });
    });
  });
});
