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

    describe('when queries contain @client directives', () => {
      const clientSideQueryOne = gql`query One {one @client}`;
      const clientSideQueryTwo = gql`query Two {two @client}`;
      const mixedQueryOne = gql`query Three {a @client b}`;
      const mixedQueryTwo = gql`query Four {c @client d}`;

      describe.each([
        [undefined],
        [{ includeClientDirectives: false }],
      ])('and setRequestHandler called with options: %p', (options) => {
        it('throws when query is entirely client side', () => {
          expect(() => {
            mockLink.setRequestHandler(clientSideQueryOne, jest.fn(), options);
          }).toThrowError('The query after normalisation is null.');
        });

        it('does not throw when query is not entirely client side', () => {
          expect(() => {
            mockLink.setRequestHandler(mixedQueryOne, jest.fn(), options);
          }).not.toThrow();
        });

        it('throws when the same mixed query is added twice', () => {
          mockLink.setRequestHandler(mixedQueryOne, jest.fn(), options);

          expect(() => {
            mockLink.setRequestHandler(mixedQueryOne, jest.fn(), options);
          }).toThrowError('Request handler already defined for query');
        });

        it('does not throw when two different mixed queries are added', () => {
          mockLink.setRequestHandler(mixedQueryOne, jest.fn(), options);

          expect(() => {
            mockLink.setRequestHandler(mixedQueryTwo, jest.fn(), options);
          }).not.toThrow();
        });
      });

      describe.each([
        [{ includeClientDirectives: true }],
      ])('and setRequestHandler called with options: %p', (options) => {
        it('does not throw when query is entirely client side', () => {
          expect(() => {
            mockLink.setRequestHandler(clientSideQueryOne, jest.fn(), options);
          }).not.toThrow();
        });

        it('does not throw when query is not entirely client side', () => {
          expect(() => {
            mockLink.setRequestHandler(mixedQueryOne, jest.fn(), options);
          }).not.toThrow();
        });

        it('throws when the same client-side only query is added twice', () => {
          mockLink.setRequestHandler(clientSideQueryOne, jest.fn(), options);

          expect(() => {
            mockLink.setRequestHandler(clientSideQueryOne, jest.fn(), options);
          }).toThrowError('Request handler already defined for query');
        });

        it('does not throw when two different client-side only queries are added', () => {
          mockLink.setRequestHandler(clientSideQueryOne, jest.fn(), options);

          expect(() => {
            mockLink.setRequestHandler(clientSideQueryTwo, jest.fn(), options);
          }).not.toThrow();
        });

        it('throws when the same mixed query is added twice', () => {
          mockLink.setRequestHandler(mixedQueryOne, jest.fn(), options);

          expect(() => {
            mockLink.setRequestHandler(mixedQueryOne, jest.fn(), options);
          }).toThrowError('Request handler already defined for query');
        });

        it('does not throw when two different mixed queries are added', () => {
          mockLink.setRequestHandler(mixedQueryOne, jest.fn(), options);

          expect(() => {
            mockLink.setRequestHandler(mixedQueryTwo, jest.fn(), options);
          }).not.toThrow();
        });
      });
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

    describe('when query contains @client directives', () => {
      it('correctly executes the handler when query is entirely client side', async () => {
        const clientSideQuery = gql`query One {one @client}`;

        const handler = jest.fn().mockResolvedValue({ data: 'Query result' });
        mockLink.setRequestHandler(clientSideQuery, handler, { includeClientDirectives: true });

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
        mockLink.setRequestHandler(mixedQuery, handler, { includeClientDirectives: true });

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

      it('correctly executes the handler when query is mixed and there are client resolvers', async () => {
        const mixedQuery = gql`query Two {a @client b}`;
        const queryWithoutClientDirectives = gql`query Two {b}`;

        const handler = jest.fn().mockResolvedValue({ data: 'Query result' });
        mockLink.setRequestHandler(mixedQuery, handler, { includeClientDirectives: false });

        // When there are client resolvers, client directives are removed before being passed down to the link
        const queryOperation = { query: queryWithoutClientDirectives, variables: { a: 'one'} } as Partial<Operation> as Operation;

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
  });
});
