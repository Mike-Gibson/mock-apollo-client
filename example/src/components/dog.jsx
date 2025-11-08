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
