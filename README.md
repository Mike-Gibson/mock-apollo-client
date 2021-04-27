# Mock Apollo Client

Helps unit test components which use the Apollo Client.

## Versions

Version 0.x of this library is compatible with Apollo client 2
```bash
npm install --save-dev mock-apollo-client@apollo2
```

Version 1.x of this library is compatible with Apollo client 3
```bash
npm install --save-dev mock-apollo-client
```

## Motivation

Whilst using the impressive `react-apollo` library, I ran into issues while trying to unit test components which used the GraphQL `Query` and `Mutation` components. The `react-apollo` library includes a `MockedProvider` component which allows query and mutation results to be mocked, but didn't offer enough control within unit tests. The `react-apollo` documentation for testing can be found [here](https://www.apollographql.com/docs/react/recipes/testing).

Specifically, some of the issues I faced were:

- Unable to assert queries/mutations were called with the expected variables
- Unable to assert how many times a specific query was called
- Unable to change the query/mutation result after the `MockProvider` was initialised
- Unable to easily control the query/mutation loading state

The `mock-apollo-client` library helps with the above issues, by allowing more control within unit tests.

## Installation

```bash
npm install --save-dev mock-apollo-client@apollo2
```

Assuming `mock-apollo-client` is being used within unit tests and should be installed as a dev dependency.

## Usage

The examples below use `react-apollo`, `enzyme` and `Jest`, but `mock-apollo-client` is standalone and can used with any libraries and test frameworks.

The examples have been adapted from the official `react-apollo` testing docs and are written in TypeScript.

### Simple Query Example

Consider the file below, which contains a single GraphQL query and a component which is responsible for rendering the result of the query:

```tsx
// dog.ts

import * as React from 'react';
import gql from 'graphql-tag';
import { Query } from 'react-apollo';

export const GET_DOG_QUERY = gql`
  query getDog($name: String) {
    dog(name: $name) {
      id
      name
      breed
    }
  }
`;

export const Dog = ({ name }) => (
  <Query query={GET_DOG_QUERY} variables={{ name }}>
    {({ loading, error, data }) => {
      if (loading) return <p>Loading...</p>;
      if (error) return <p>Error!</p>;

      return (
        <p>
          {data.dog.name} is a {data.dog.breed}
        </p>
      );
    }}
  </Query>
);
```

To unit test this component using `mock-apollo-client`, the test file could look like the following:

```tsx
// dog.test.ts

import { mount, ReactWrapper } from 'enzyme';
import * as React from 'react';
import { ApolloProvider } from 'react-apollo';
import { createMockClient } from 'mock-apollo-client';

import { GET_DOG_QUERY, Dog } from './dog';

let wrapper: ReactWrapper;

beforeEach(() => {
  const mockClient = createMockClient();

  mockClient.setRequestHandler(
    GET_DOG_QUERY,
    () => Promise.resolve({ data: { dog: { id: 1, name: 'Rufus', breed: 'Poodle' } } }));

  wrapper = mount(
    <ApolloProvider client={mockClient}>
      <Dog name="Rufus" />
    </ApolloProvider>
  );
});

it('renders the dog name and breed', () => {
  expect(wrapper.text()).toContain('Rufus is a Poodle');
});
```

This test file does the following:

1. Instantiates a new mock Apollo client
1. Calls `setRequestHandler` on the mock Apollo client to set a function to be called when the Apollo client executes the Dog query
1. Uses the mock and initialises the enzyme wrapper for the unit tests

### Asserting query variables

The method `setRequestHandler` is passed a function to call when Apollo client executes a given query and it is called with the variables for that query, so it is easy to assert the component is behaving as expected using a spy framework.

```typescript
const queryHandler = jest.fn().mockResolvedValue({ data: { dog: { id: 1, name: 'Rufus', breed: 'Poodle' } } });

mockApolloClient.setRequestHandler(GET_DOG_QUERY, queryHandler);

// ....

it('executes the query with the correct variables', () => {
  expect(queryHandler).toBeCalledTimes(1);
  expect(queryHandler).toBeCalledWith({ name: 'Rufus' });
});
```

### Loading states

A request handler returns a promise, so testing for loading state just requires that the promise returned is not resolved or rejected.

### Error states

To simulate a GraphQL network error, the request handler should return a rejected promise. i.e.

```typescript
mockApolloClient.setRequestHandler(
  GET_DOG_QUERY,
  () => Promise.reject(new Error('GraphQL Network Error')));
```

To simulate GraphQL errors, the request handler should return a Promise which resolves with an `errors` field. i.e.

```typescript
mockApolloClient.setRequestHandler(
  GET_DOG_QUERY,
  () => Promise.resolve({ errors: [{message: 'GraphQL Error'}] }));
```

### Mutations

Mutations can be tested the same way that queries are, by using `setRequestHandler` and specifying a request handler for the mutation query.

### Subscriptions

Subscriptions can be tested, but require a different setup as they receive a stream of data.
Consider the file below, which contains a single subscription and a component which is responsible for rendering the updated data:
```tsx
// dogSubscription.tsx

import * as React from 'react';
import gql from 'graphql-tag';
import { Subscription } from 'react-apollo';

export const SUBSCRIBE_DOG_DOCUMENT = gql`
  subscription subscribeDog($name: String) {
    dog(name: $name) {
      id
      name
      numberOfBarks
    }
  }
`;

export const DogSubscription = ({ name }) => (
  <Subscription subscription={SUBSCRIBE_DOG_DOCUMENT} variables={{ name }}>
    {({ loading, error, data }) => {
      if (loading) return <p>Loading...</p>;
      if (error) return <p>Error!</p>;

      return (
        <p>
          {data.dog.name} has barked {data.dog.numberOfBarks} time(s)
        </p>
      );
    }}
  </Subscription>
);
```

To unit test this component using `mock-apollo-client`, the test file could look like the following:

```tsx
// dogSubscription.test.tsx

import { mount, ReactWrapper } from 'enzyme';
import * as React from 'react';
import { ApolloProvider } from 'react-apollo';
import { createMockClient, createMockSubscription, IMockSubscription } from 'mock-apollo-client';

import { SUBSCRIBE_DOG_DOCUMENT, DogSubscription } from './dogSubscription';

let wrapper: ReactWrapper;
let mockSubscription: IMockSubscription;

beforeEach(() => {
  const mockClient = createMockClient();
  mockSubscription = createMockSubscription();

  mockClient.setRequestHandler(
    SUBSCRIBE_DOG_DOCUMENT,
    () => mockSubscription);

  wrapper = mount(
    <ApolloProvider client={mockClient}>
      <DogSubscription name="Rufus" />
    </ApolloProvider>
  );
});

it('renders the dog details', () => {
  mockSubscription.next({ data: { dog: { id: 1, name: 'Rufus', numberOfBarks: 0 } } });
  wrapper.update();

  expect(wrapper.text()).toContain('Rufus has barked 0 time(s)');

  mockSubscription.next({ data: { dog: { id: 1, name: 'Rufus', numberOfBarks: 1 } } });
  wrapper.update();

  expect(wrapper.text()).toContain('Rufus has barked 1 time(s)');
});
```

The subscription can be closed by calling `.complete` if necessary for the test.

#### Errors

You can also test error states by calling `.error` on the `mockSubscription` and passing errors as described in [Error States](#error-states):
```typescript
mockSubscription.error(new Error('GraphQL Network Error'))
```

#### Multiple subscriptions

A mock subscription will only be associated with a single invocation of a query. If a component is subscribing to the same query multiple times, then a separate mock subscription should be used for each one.

```typescript
const subscriptions: IMockSubscription[] = [];

mockClient.setRequestHandler(
  SUBSCRIBE_DOG_DOCUMENT,
  () => {
    const subscription = createMockSubscription();
    subscriptions.push(subscription);
    return subscription;
  });

...

subscriptions.forEach((s) => s.next({ data: { dog: { id: 1, name: 'Rufus', numberOfBarks: 1 } } }));
```

### Specifying Apollo client options

The `createMockClient` method can be provided with the same constructor arguments that `ApolloClient` accepts which are used when instantiating the mock Apollo client.

For example, to specify the cache (and fragment matcher) that should be used:
```typescript
const cache = new InMemoryCache({
  fragmentMatcher: myCustomFragmentMatcher,
});

const mockClient = createMockClient({ cache });
```

Note: it is not possible to specify the `link` to use as this is how Mock Apollo Client injects its behaviour.

### Fragments

If your queries or mutations use fragments, you must inject a cache object when creating the mock client which has been provided the fragment matcher and configured to add typenames.

For example, when using the IntrospectionFragmentMatcher:

```typescript
import { IntrospectionFragmentMatcher, InMemoryCache } from 'apollo-cache-inmemory';
import { createMockClient } from 'mock-apollo-client';
import introspectionQueryResultData from './fragmentTypes.json';

const cache = new InMemoryCache({
  addTypename: true,
  fragmentMatcher: new IntrospectionFragmentMatcher({
    introspectionQueryResultData,
  }),
});

const mockClient = createMockClient({ cache });
```

You must then ensure that the query result includes the `__typename` field as it would when calling your actual GraphQL API. This is to ensure that the fragment matching works as expected:

```typescript
const query = gql`
  query Hardware {
    hardware {
      id
      ... on Memory {
        size
      }
      ... on Cpu {
        speed
      }
    }
  }
`;

const mockData = {
  hardware: {
    __typename: 'Memory',
    id: 2,
    size: '16gb',
  },
};

const requestHandler = jest.fn().mockResolvedValue({ data: mockData });
```
