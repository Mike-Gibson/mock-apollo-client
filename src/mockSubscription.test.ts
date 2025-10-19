import { ApolloLink } from '@apollo/client';
import { Observer } from 'rxjs';
import { MockSubscription } from './mockSubscription';

class MockObserver implements Observer<ApolloLink.Result> {
  next: (value: ApolloLink.Result) => void;
  error: (errorValue: any) => void;
  complete: () => void;

  constructor() {
    this.next = jest.fn();
    this.error = jest.fn();
    this.complete = jest.fn();
  }
}

describe('class MockLink', () => {
  let mockSubscription: MockSubscription;
  let mockObserver: MockObserver;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockReset();

    mockSubscription = new MockSubscription();
    mockObserver = new MockObserver();
  });

  describe('method subscribe', () => {
    it('warns if overriding observer', () => {
      mockSubscription.subscribe(mockObserver);

      mockSubscription.subscribe(mockObserver);

      expect(console.warn).toHaveBeenCalled();
    });

    it('does not warn if logging is disabled', () => {
      mockSubscription = new MockSubscription({ disableLogging: true });
      mockSubscription.subscribe(mockObserver);

      mockSubscription.subscribe(mockObserver);

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('method next', () => {
    it('warns if the observer is not set', () => {
      mockSubscription.next({ data: {} });

      expect(console.warn).toHaveBeenCalled();
    });

    it('warns if already complete', () => {
      mockSubscription.subscribe(mockObserver);
      mockSubscription.complete();

      mockSubscription.next({ data: {} });

      expect(console.warn).toHaveBeenCalled();
    });

    it('does not warn if logging is disabled', () => {
      mockSubscription = new MockSubscription({ disableLogging: true });
      mockSubscription.subscribe(mockObserver);
      mockSubscription.complete();

      mockSubscription.next({ data: {} });

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('method error', () => {
    it('warns if the observer is not set', () => {
      mockSubscription.error(new Error());

      expect(console.warn).toHaveBeenCalled();
    });

    it('warns if already complete', () => {
      mockSubscription.subscribe(mockObserver);
      mockSubscription.complete();

      mockSubscription.error(new Error());

      expect(console.warn).toHaveBeenCalled();
    });

    it('does not warn if logging is disabled', () => {
      mockSubscription = new MockSubscription({ disableLogging: true });
      mockSubscription.subscribe(mockObserver);
      mockSubscription.complete();

      mockSubscription.error(new Error());

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('method complete', () => {
    it('warns if the observer is not set', () => {
      mockSubscription.complete();

      expect(console.warn).toHaveBeenCalled();
    });

    it('warns if already complete', () => {
      mockSubscription.subscribe(mockObserver);
      mockSubscription.complete();

      mockSubscription.complete();

      expect(console.warn).toHaveBeenCalled();
    });

    it('does not warn if logging is disabled', () => {
      mockSubscription = new MockSubscription({ disableLogging: true });
      mockSubscription.subscribe(mockObserver);
      mockSubscription.complete();

      mockSubscription.complete();

      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
