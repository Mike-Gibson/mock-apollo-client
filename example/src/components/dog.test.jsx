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
