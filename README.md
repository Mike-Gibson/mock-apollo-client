# Mock Apollo Client

Helps unit test components which use the Apollo Client.

## Versions

| Version | Compatibility                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| 0.x     | Apollo client 2. README for 0.x [here](https://github.com/Mike-Gibson/mock-apollo-client/tree/release/0.x). |
| 1.x     | Apollo client 3. README for 1.x [here](https://github.com/Mike-Gibson/mock-apollo-client/tree/release/1.x). |
| 2.x     | Apollo client 4. (this README)                                                                              |

## Motivation

When using the `@apollo/client` library, I ran into issues trying to unit test React components which called GraphQL queries and mutations.

The Apollo client library includes a `MockedProvider` component which allows query and mutation results to be mocked, but didn't offer enough control within unit tests. The Apollo client documentation for testing can be found [here](https://www.apollographql.com/docs/react/development-testing/testing/).

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

The examples below use `React`, `Jest` and `React Testing Library`, but `mock-apollo-client` is standalone and can used with any libraries and test frameworks.

The examples have been adapted from the official Apollo testing docs where possible.

### Simple Query Example

Consider the file below, which contains a single GraphQL query and a component which is responsible for rendering the result of the query:

```jsx
// dog.jsx

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

export const GET_DOG_QUERY = gql`
  query getDog($name: String) {
    dog(name: $name) {
      id
      name
      breed
    }
  }
`;

export const Dog = ({ name }) => {
  const { loading, error, data } = useQuery(GET_DOG_QUERY, {
    variables: { name },
  });
  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error.message}</p>;

  return (
    <p>
      {data.dog.name} is a {data.dog.breed}
    </p>
  );
};
```

To unit test this component using `mock-apollo-client`, the test file could look like the following:

```jsx
// dog.test.jsx
import '@testing-library/jest-dom';
import { ApolloProvider } from '@apollo/client/react';
import { render, screen } from '@testing-library/react';
import { createMockClient } from 'mock-apollo-client';

import { GET_DOG_QUERY, Dog } from './dog';

it('renders the dog name and breed', async () => {
  const mockClient = createMockClient();

  mockClient.setRequestHandler(GET_DOG_QUERY, () =>
    Promise.resolve({
      data: { dog: { id: 1, name: 'Rufus', breed: 'Poodle' } },
    }),
  );

  render(
    <ApolloProvider client={mockClient}>
      <Dog name="Rufus" />
    </ApolloProvider>,
  );

  expect(await screen.findByText('Rufus is a Poodle')).toBeInTheDocument();
});
```

This test file does the following:

1. Instantiates a new mock Apollo client
1. Calls `setRequestHandler` on the mock Apollo client instance to set a function to be called when Apollo client executes the Dog query
1. Passes the mock Apollo client instance to the ApolloProvider when rendering the component

### Asserting query variables

The method `setRequestHandler` is passed a function to call when Apollo client executes a given query and it is called with the variables for that query, so it is easy to assert the component is behaving as expected using a spy library.

```javascript
const queryHandler = jest.fn().mockResolvedValue({
  data: { dog: { id: 1, name: 'Rufus', breed: 'Poodle' } },
});

mockApolloClient.setRequestHandler(GET_DOG_QUERY, queryHandler);

// ....

it('executes the query with the correct variables', () => {
  expect(queryHandler).toHaveBeenCalledTimes(1);
  expect(queryHandler).toHaveBeenCalledWith({ name: 'Rufus' });
});
```

### Loading states

A request handler returns a promise, so testing for loading state just requires that the promise returned is not resolved or rejected.

### Error states

To simulate a network error, the request handler should return a rejected promise. i.e.

```javascript
mockApolloClient.setRequestHandler(GET_DOG_QUERY, () =>
  Promise.reject(new Error('Network Error')),
);
```

To simulate GraphQL errors, the request handler should return a Promise which resolves with an `errors` field. i.e.

```javascript
mockApolloClient.setRequestHandler(GET_DOG_QUERY, () =>
  Promise.resolve({ errors: [{ message: 'GraphQL Error' }] }),
);
```

### Mutations

Mutations can be tested the same way that queries are, by using `setRequestHandler` and specifying a request handler for the mutation query.

### Subscriptions

Subscriptions can be tested, but require a different setup as they receive a stream of data.
Consider the file below, which contains a single subscription and a component which is responsible for rendering the updated data:

```jsx
// dogSubscription.jsx

import { gql } from '@apollo/client';
import { useSubscription } from '@apollo/client/react';

export const DOG_SUBSCRIPTION = gql`
  subscription subscribeDog($name: String) {
    dog(name: $name) {
      id
      name
      numberOfBarks
    }
  }
`;

export const DogSubscription = ({ name }) => {
  const { loading, error, data } = useSubscription(DOG_SUBSCRIPTION, {
    variables: { name },
  });
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

```jsx
// dogSubscription.test.jsx

import '@testing-library/jest-dom';
import { act } from 'react';
import { ApolloProvider } from '@apollo/client/react';
import { render, screen } from '@testing-library/react';
import { createMockClient, createMockSubscription } from 'mock-apollo-client';

import { DOG_SUBSCRIPTION, DogSubscription } from './dogSubscription';

it('renders the dog details', async () => {
  const mockClient = createMockClient();
  const mockSubscription = createMockSubscription();

  mockClient.setRequestHandler(DOG_SUBSCRIPTION, () => mockSubscription);

  render(
    <ApolloProvider client={mockClient}>
      <DogSubscription name="Rufus" />
    </ApolloProvider>,
  );

  act(() => {
    mockSubscription.next({
      data: { dog: { id: 1, name: 'Rufus', numberOfBarks: 0 } },
    });
  });

  expect(
    await screen.findByText('Rufus has barked 0 time(s)'),
  ).toBeInTheDocument();

  act(() => {
    mockSubscription.next({
      data: { dog: { id: 1, name: 'Rufus', numberOfBarks: 1 } },
    });
  });

  expect(
    await screen.findByText('Rufus has barked 1 time(s)'),
  ).toBeInTheDocument();
});
```

The subscription can be closed by calling `.complete` if necessary for the test.

#### Errors

You can also test error states by calling `.error` on the `mockSubscription` and passing errors as described in [Error States](#error-states):

```javascript
mockSubscription.error(new Error('Network Error'));
```

#### Multiple subscriptions

A mock subscription will only be associated with a single invocation of a query. If a component is subscribing to the same query multiple times, then a separate mock subscription should be used for each one.

```javascript
const subscriptions = [];

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

### Specifying mock Apollo client options

#### Apollo client options

The `createMockClient` method can be provided with the same constructor arguments that `ApolloClient` accepts which are used when instantiating the mock Apollo client.

For example, to specify the cache (and possible types for fragment matching) that should be used:

```javascript
const cache = new InMemoryCache({
  possibleTypes: myPossibleTypes,
});

const mockClient = createMockClient({ cache });
```

Note: it is not possible to specify the `link` to use as this is how `mock-apollo-client` injects its request handling behaviour.

#### Mock client options

Additionally, you can specify the following options which control the behaviour of the mock Apollo client:

| Option                         | Description                                                                                         | Default                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------- |
| `supressMissingHandlerWarning` | Controls whether a warning is logged when a request handler for an executed operation is not found. | `false` (Warning will be logged) |

### Fragments

If queries or mutations use fragments against union or interface types, you must inject a cache object when creating the mock client which has been provided with `possibleTypes`, and also include the correct `__typename` field when mocking the response.

For example:

```javascript
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

### Removing a handler

It's possible to remove a previously registered handler for a query using `removeRequestHandler`.

For example:

```javascript
mockApolloClient.removeRequestHandler(GET_DOG_QUERY);
```
