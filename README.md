# Mock Apollo Client

Helps unit test components which use the Apollo Client.

> **Note**: This library is currently only compatible with Apollo Client 2.
>
> Track version 3 support in [#11](https://github.com/Mike-Gibson/mock-apollo-client/issues/11).

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
npm install --save-dev mock-apollo-client
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
      if (loading) return 'Loading...';
      if (error) return 'Error!';

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

### Client directives

#### Using client resolvers

If a query contains `@client` directives, `mock-apollo-client` by default expects that the cache or client side resolvers will be used. This matches the default behaviour of Apollo client when resolvers are specified.

So for example, when there is a query such as

```graphql
query CurrentUser {
  currentUser {
    id
    name
    authToken @client
  }
}
```
when a request handler is configured for the query using `setRequestHandler`, `mock-apollo-client` expects it will receive the query for `id` and `name` only during the execution of the query.

Code for this scenario might look as follows:

```typescript
// production code

const GET_CURRENT_USER = gql`
  query CurrentUser {
    currentUser {
      id
      name
      authToken @client
    }
  }`;

const resolvers = {
  Query: {
    authToken: () => sessionStorage.getItem('authToken'),
  },
};

const client = new ApolloClient({
  ...
  resolvers,
});

// Then at some point, client.query({ query: GET_CURRENT_USER }) would be called.
```

```typescript
// Test code (using client resolvers)

const mockClient = createMockClient({ resolvers });

const handler = () => Promise.resolve({ data: { currentUser: { id: 1, name: 'Bob' } } });
mockClient.setRequestHandler(GET_CURRENT_USER, handler);

sessionStorage.setItem('authToken', 'abcd');
```

The mock client above would then behave similarly to how it would in production, where client resolvers are used, which in this example looks up a value from `sessionStorage`.

Instead of setting values in `sessionStorage`, spies could be configured on the resolvers and the responses could be mocked. For example:

```typescript
// Test code (using client resolvers and jest spies)

const mockClient = createMockClient({ resolvers });

const handler = () => Promise.resolve({ data: { currentUser: { id: 1, name: 'Bob' } } });

jest
  .spyOn(resolvers.Query, 'authToken')
  .mockReturnValue('abcd');

mockClient.setRequestHandler(GET_CURRENT_USER, handler);
```

#### Without client resolvers

If client side resolvers are not defined, Apollo client does not remove fields marked with `@client` directives and passes them down to the `mock-apollo-client` link. This means that similar test set up code above without specifying resolvers will not work:

```typescript
// Invalid test code (without client resolvers)

const mockClient = createMockClient(); // resolvers not specified

const handler = () => Promise.resolve({
  data: { currentUser: { id: 1, name: 'Bob', authToken: 'abc' } },
});

mockClient.setRequestHandler(GET_CURRENT_USER, handler);
```

Instead, while calling `setRequestHandler`, we must specify `includeClientDirectives` as follows:

```typescript
// Test code (without client resolvers)

const mockClient = createMockClient(); // resolvers not specified

const handler = () => Promise.resolve({
  data: { currentUser: { id: 1, name: 'Bob', authToken: 'abc' } },
});

mockClient.setRequestHandler(GET_CURRENT_USER, handler, { includeClientDirectives: true });
```

This ensures `mock-apollo-client` finds the correct handler when the query is executed.
