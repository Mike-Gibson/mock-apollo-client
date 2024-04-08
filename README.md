# Mock Apollo Client

Helps unit test components which use the Apollo Client.

## Versions

Version 0.x of this library is compatible with Apollo client 2.
View the README for 0.x [here](https://github.com/Mike-Gibson/mock-apollo-client/tree/release/0.x).

Version 1.x of this library is compatible with Apollo client 3 (this README)

## Motivation

Whilst using the impressive `@apollo/client` library, I ran into issues while trying to unit test components which used the GraphQL `Query` and `Mutation` components. The Apollo client library includes a `MockedProvider` component which allows query and mutation results to be mocked, but didn't offer enough control within unit tests. The Apollo client documentation for testing can be found [here](https://www.apollographql.com/docs/react/development-testing/testing/).

Specifically, some of the issues I faced were:

- Unable to assert queries/mutations were called with the expected variables
- Unable to assert how many times a specific query was called
- Unable to change the query/mutation result after the `MockedProvider` was initialised
- Unable to easily control the query/mutation loading state

The `mock-apollo-client` library helps with the above issues, by allowing more control within unit tests.

## Installation

```bash
npm install --save-dev mock-apollo-client
```

## Usage

The examples below use `React`, `enzyme` and `Jest`, but `mock-apollo-client` is standalone and can used with any libraries and test frameworks.

The examples have been adapted from the official Apollo testing docs and are written in TypeScript.

### Simple Query Example

Consider the file below, which contains a single GraphQL query and a component which is responsible for rendering the result of the query:

```tsx
// dog.tsx

import { gql, useQuery } from '@apollo/client';
import React from 'react';

export const GET_DOG_QUERY = gql`
  query getDog($name: String) {
    dog(name: $name) {
      id
      name
      breed
    }
  }
`;

export const Dog: React.FunctionComponent<{ name: string }> = ({ name }) => {
  const { loading, error, data } = useQuery(
    GET_DOG_QUERY,
    { variables: { name } }
  );
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error!</p>;

  return (
    <p>
      {data.dog.name} is a {data.dog.breed}
    </p>
  );
};
```

To unit test this component using `mock-apollo-client`, the test file could look like the following:

```tsx
// dog.test.tsx

import { ApolloProvider } from '@apollo/client';
import { mount, ReactWrapper } from 'enzyme';
import { createMockClient } from 'mock-apollo-client';
import * as React from 'react';

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

The method `setRequestHandler` is passed a function to call when Apollo client executes a given query and it is called with the variables for that query, so it is easy to assert the component is behaving as expected using a spy library.

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
  () => Promise.resolve({ errors: [{ message: 'GraphQL Error' }] }));
```

### Mutations

Mutations can be tested the same way that queries are, by using `setRequestHandler` and specifying a request handler for the mutation query.

### Subscriptions

Subscriptions can be tested, but require a different setup as they receive a stream of data.
Consider the file below, which contains a single subscription and a component which is responsible for rendering the updated data:
```tsx
// dogSubscription.tsx

import { gql, useSubscription } from '@apollo/client';
import React from 'react';

export const SUBSCRIBE_DOG_DOCUMENT = gql`
  subscription subscribeDog($name: String) {
    dog(name: $name) {
      id
      name
      numberOfBarks
    }
  }
`;

export const DogSubscription: React.FunctionComponent<{ name: string }> = ({ name }) => {
  const { loading, error, data } = useSubscription(
    SUBSCRIBE_DOG_DOCUMENT,
    { variables: { name } }
  );
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error!</p>;

  return (
    <p>
      {data.dog.name} has barked {data.dog.numberOfBarks} time(s)
    </p>
  );
};
```

To unit test this component using `mock-apollo-client`, the test file could look like the following:

```tsx
// dogSubscription.test.tsx

import { ApolloProvider } from '@apollo/client';
import { mount, ReactWrapper } from 'enzyme';
import { createMockClient, createMockSubscription, IMockSubscription } from 'mock-apollo-client';
import { act } from 'react-dom/test-utils';
import * as React from 'react';

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
  act(() => {
    mockSubscription.next({ data: { dog: { id: 1, name: 'Rufus', numberOfBarks: 0 } } });
  });

  expect(wrapper.text()).toContain('Rufus has barked 0 time(s)');

  act(() => {
    mockSubscription.next({ data: { dog: { id: 1, name: 'Rufus', numberOfBarks: 1 } } });
  });

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

For example, to specify the cache (and possible types for fragment matching) that should be used:
```typescript
const cache = new InMemoryCache({
  possibleTypes: myPossibleTypes,
});

const mockClient = createMockClient({ cache });
```

Additionally, you can specify a `missingHandlerPolicy` to define the behavior of the mock client when a request handler for a particular operation is not found.

The `missingHandlerPolicy` accepts one of three string values:
- `'throw-error'`: The client throws an error when it encounters a missing handler.
- `'warn-and-return-error'`: The client logs a warning message in the console and returns an error.
- `'return-error'`: The client returns an error without any warning message.

Here's an example of how you can set the `missingHandlerPolicy`:

```typescript
const mockClient = createMockClient({ missingHandlerPolicy: 'warn-and-return-error' });
```

In this example, if a request handler for a given operation is not found, the client will log a warning message to the console and then return an error.

Note: it is not possible to specify the `link` to use as this is how `mock-apollo-client` injects its behaviour.

### Fragments

If your queries or mutations use fragments against union or interface types, you must inject a cache object when creating the mock client which has been provided with `possibleTypes`, and also include the correct `__typename` field when mocking the response.

For example:

```typescript
import { InMemoryCache } from '@apollo/client';
import { createMockClient } from 'mock-apollo-client';

const cache = new InMemoryCache({
  possibleTypes: {
    Hardware: ['Memory', 'Cpu'],
  },
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
