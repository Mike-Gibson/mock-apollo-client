import { DocumentNode, SelectionNode } from 'graphql';
import { visit, FieldNode } from 'graphql';

// In Apollo client 4, the utility functions:
//   removeClientSetsFromDocument, and
//   removeConnectionDirectiveFromDocument
// have been removed with no replacement, but this functionality is still needed for
// mock apollo client, in order to able to normalise a provided query in anticipation of
// matching an executed query.
// They have been implemented below, but the implementation may be incomplete, or
// not match the exact behaviour in Apollo client, which could lead to handlers incorrectly
// not being executed.

export const removeClientSetsFromDocument = (
  document: DocumentNode,
): DocumentNode | null => {
  let hasNonClientField = false;

  const withoutClientFields = visit(document, {
    Field: {
      enter(node: FieldNode) {
        if (hasDirective(node, 'client')) {
          return null;
        }
        if (!node.selectionSet?.selections.length) {
          hasNonClientField = true;
        }
        return node;
      },
    },
  });

  if (!hasNonClientField) {
    return null;
  }

  return withoutClientFields;
};

export const removeConnectionDirectiveFromDocument = (
  document: DocumentNode,
): DocumentNode => {
  return visit(document, {
    Field: {
      enter(node: FieldNode) {
        if (!node.directives || !hasDirective(node, 'connection')) {
          return node;
        }

        return {
          ...node,
          directives: node.directives.filter(
            (d) => d.name.value !== 'connection',
          ),
        };
      },
    },
  });
};

export const stripTypenames = (document: DocumentNode): DocumentNode | null =>
  visit(document, {
    Field: {
      enter: (node) => (node.name.value === '__typename' ? null : undefined),
    },
  });

const hasDirective = (node: FieldNode | SelectionNode, name: string) =>
  node.directives?.some((d) => d.name.value === name);
