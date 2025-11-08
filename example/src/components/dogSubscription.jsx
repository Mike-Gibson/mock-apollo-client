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
