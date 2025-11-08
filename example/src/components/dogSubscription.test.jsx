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
