import { FetchResult } from "@apollo/client/core";
import { MockSubscription } from "./mockSubscription";

class MockObserver implements ZenObservable.SubscriptionObserver<FetchResult> {
  closed: boolean;
  next: (value: FetchResult) => void;
  error: (errorValue: any) => void;
  complete: () => void;

  constructor() {
    this.closed = false;
    this.next = jest.fn();
    this.error = jest.fn(() => {
      this.closed = true;
    });
    this.complete = jest.fn(() => {
      this.closed = true;
    });
  }
}

describe("class MockLink", () => {
  let mockSubscription: MockSubscription;
  let mockObserver: MockObserver;

  beforeEach(() => {
    jest.spyOn(console, "warn").mockReset();

    mockSubscription = new MockSubscription();
    mockObserver = new MockObserver();
  });

  describe("method subscribe", () => {
    it("warns if overriding observer", () => {
      mockSubscription.subscribe(mockObserver)
      mockSubscription.subscribe(mockObserver)
      expect(console.warn).toBeCalled();
    });

    it("does not warn if loggin disabled", () => {
      mockSubscription = new MockSubscription({ logging: false });
      mockSubscription.subscribe(mockObserver)
      mockSubscription.subscribe(mockObserver)
      expect(console.warn).not.toBeCalled();
    });
  });

  describe("method next", () => {
    it("warns if the observer is not set", () => {
      mockSubscription.next({ data: {} });
      expect(console.warn).toBeCalled();
    });

    it("warns if the observer is closed", () => {
      mockSubscription.subscribe(mockObserver);
      mockObserver.closed = true;
      mockSubscription.next({ data: {} });
      expect(console.warn).toBeCalled();
    });

    it("does not warn if loggin disabled", () => {
      mockSubscription = new MockSubscription({ logging: false });
      mockSubscription.next({ data: {} });
      expect(console.warn).not.toBeCalled();
    });
  });

  describe("method error", () => {
    it("warns if the observer is not set", () => {
      mockSubscription.error(new Error());
      expect(console.warn).toBeCalled();
    });

    it("warns if the observer is closed", () => {
      mockSubscription.subscribe(mockObserver);
      mockObserver.closed = true;
      mockSubscription.error(new Error());
      expect(console.warn).toBeCalled();
    });

    it("does not warn if loggin disabled", () => {
      mockSubscription = new MockSubscription({ logging: false });
      mockSubscription.error(new Error());
      expect(console.warn).not.toBeCalled();
    });
  });

  describe("method complete", () => {
    it("warns if the observer is not set", () => {
      mockSubscription.complete();
      expect(console.warn).toBeCalled();
    });

    it("warns if the observer is closed", () => {
      mockSubscription.subscribe(mockObserver);
      mockObserver.closed = true;
      mockSubscription.complete();
      expect(console.warn).toBeCalled();
    });

    it("does not warn if loggin disabled", () => {
      mockSubscription = new MockSubscription({ logging: false });
      mockSubscription.complete();
      expect(console.warn).not.toBeCalled();
    });
  });
});
