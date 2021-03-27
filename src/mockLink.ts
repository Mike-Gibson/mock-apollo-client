import { ApolloLink, DocumentNode, Observable, Operation, FetchResult } from 'apollo-link';
import { removeClientSetsFromDocument, removeConnectionDirectiveFromDocument } from 'apollo-utilities';
import { SelectionNode } from 'graphql';
import { print } from 'graphql/language/printer';
import { visit } from 'graphql/language/visitor';
import { RequestHandler, RequestHandlerResponse } from './mockClient';

export class MockLink extends ApolloLink {
  private requestHandlers: Record<string, RequestHandler> = {};

  setRequestHandler(requestQuery: DocumentNode, handler: RequestHandler): void {
    const key = requestToKey(requestQuery);

    if (this.requestHandlers[key]) {
      throw new Error(`Request handler already defined for query: ${format(requestQuery)}`);
    }

    this.requestHandlers[key] = handler;
  }

  request(operation: Operation) {
    const key = requestToKey(operation.query);

    const handler = this.requestHandlers[key];

    if (!handler) {
      throw new Error(`Request handler not defined for query: ${format(operation.query)}`);
    }

    let resultPromise: Promise<RequestHandlerResponse<any>> | undefined = undefined;

    try {
      resultPromise = handler(operation.variables);
    } catch (error) {
      throw new Error(`Unexpected error whilst calling request handler: ${error.message}`);
    }

    if (!isPromise(resultPromise)) {
      throw new Error(`Request handler must return a promise. Received '${typeof resultPromise}'.`);
    }

    return new Observable<FetchResult>(observer => {
      resultPromise!
        .then((result) => {
          observer.next(result);
          observer.complete();
        })
        .catch((error) => {
          observer.error(error);
        });
      return () => { };
    });
  }
}

const normalise = (requestQuery: DocumentNode): DocumentNode => {
  let stripped = removeClientSetsFromDocument(requestQuery);

  stripped = stripped !== null
    ? removeConnectionDirectiveFromDocument(stripped)
    : null;

  stripped = stripped !== null
    ? stripTypenames(stripped)
    : null;

  return stripped === null
    ? requestQuery
    : stripped;
};

const stripTypenames = (document: DocumentNode): DocumentNode | null => {
  const removeTypenameFields = (selections: readonly SelectionNode[]): SelectionNode[] => {
    const stripped = selections.reduce<SelectionNode[]>(
      (acc, current) => {
        let selectionToAdd: SelectionNode | null = current;

        if (current.kind === 'Field' || current.kind === 'FragmentSpread') {
          if (current.name.value === '__typename') {
            selectionToAdd = null;
          }
        }

        if (current.kind === 'InlineFragment') {
          const strippedSelections = removeTypenameFields(current.selectionSet.selections);
          selectionToAdd = {
            ...current,
            selectionSet: {
              ...current.selectionSet,
              selections: strippedSelections,
            },
          };
        }

        if (selectionToAdd !== null) {
          acc.push(selectionToAdd);
        }

        return acc;
      },
      []);

    return stripped;
  };

  return visit(
    document,
    {
      SelectionSet: {
        enter: (node) => {
          if (!node.selections || node.selections.length === 0) {
            return;
          }

          const strippedSelections = removeTypenameFields(node.selections);

          return {
            ...node,
            selections: strippedSelections,
          };
        },
      },
    });
}

const requestToKey = (query: DocumentNode): string => {
  const normalised = normalise(query);
  const queryString = print(normalised);
  const requestKey = { query: queryString };
  return JSON.stringify(requestKey);
}

const format = (query: DocumentNode | null): string =>
  query
    ? print(query)
    : 'null';

const isPromise = (maybePromise: any): maybePromise is Promise<any> =>
  maybePromise && typeof (maybePromise as any).then === 'function';
