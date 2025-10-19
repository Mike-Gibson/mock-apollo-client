import { gql } from '@apollo/client';
import { DocumentNode, print } from 'graphql';

import {
  removeClientSetsFromDocument,
  removeConnectionDirectiveFromDocument,
  stripTypenames,
} from './directiveUtils';

describe('removeClientSetsFromDocument', () => {
  it('should not alter the document if there are no @client directives', () => {
    const document = gql`
      query TestQuery {
        serverField
        nested {
          innerServerField
        }
      }
    `;

    const actual = removeClientSetsFromDocument(document);

    assertDocumentsAreEqual(actual, document);
  });

  it('should remove @client fields from a document', () => {
    const document = gql`
      query TestQuery {
        serverField
        clientField @client
        nested {
          innerServerField
          innerClientField @client
        }
      }
    `;

    const actual = removeClientSetsFromDocument(document);

    assertDocumentsAreEqual(
      actual,
      gql`
        query TestQuery {
          serverField
          nested {
            innerServerField
          }
        }
      `,
    );
  });

  it('should remove @client fields from a document including field with subfields', () => {
    const document = gql`
      query TestQuery {
        serverField
        clientField @client
        nested @client {
          innerClientField1
          innerClientField2
        }
      }
    `;

    const actual = removeClientSetsFromDocument(document);

    assertDocumentsAreEqual(
      actual,
      gql`
        query TestQuery {
          serverField
        }
      `,
    );
  });

  it('should return null if all fields are @client on a simple query', () => {
    const document = gql`
      query TestQuery {
        clientField @client
      }
    `;

    const actual = removeClientSetsFromDocument(document);

    expect(actual).toBeNull();
  });

  it('should return null if all fields are @client on a complex query', () => {
    const document = gql`
      query TestQuery {
        clientField @client
        nested {
          innerClientField @client
        }
      }
    `;

    const actual = removeClientSetsFromDocument(document);

    expect(actual).toBeNull();
  });
});

describe('removeConnectionDirectiveFromDocument', () => {
  it('should not alter the document if there is no @connection directive', () => {
    const document = gql`
      query TestQuery {
        items {
          id
          name
        }
      }
    `;

    const actual = removeConnectionDirectiveFromDocument(document);

    assertDocumentsAreEqual(actual, document);
  });

  it('should remove @connection directives from a document', () => {
    const document = gql`
      query TestQuery {
        items @connection(key: "foo") {
          id
          name
        }
      }
    `;

    const result = removeConnectionDirectiveFromDocument(document);

    assertDocumentsAreEqual(
      result,
      gql`
        query TestQuery {
          items {
            id
            name
          }
        }
      `,
    );
  });
});

describe('stripTypenames', () => {
  it('should remove all __typename fields from a document', () => {
    const document = gql`
      query TestQuery {
        items {
          __typename
          id
          name
          nested {
            __typename
            innerField
          }
        }
      }
    `;

    const result = stripTypenames(document);

    assertDocumentsAreEqual(
      result,
      gql`
        query TestQuery {
          items {
            id
            name
            nested {
              innerField
            }
          }
        }
      `,
    );
  });
});

const assertDocumentsAreEqual = (
  actual: DocumentNode | null,
  expected: DocumentNode,
) => {
  expect(actual).not.toBeNull();
  expect(print(actual!)).toBe(print(expected));
  expect(actual!).toMatchObject({
    kind: expected.kind,
    definitions: expected.definitions,
  });
};
