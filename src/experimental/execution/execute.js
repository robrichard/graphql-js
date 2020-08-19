import type { PromiseOrValue } from '../../jsutils/PromiseOrValue';

import { executeImpl } from '../../execution/execute';
import type { ExecutionResult, ExecutionArgs } from '../../execution/execute';

import type { DocumentNode } from '../../language/ast';

import type { GraphQLSchema } from '../../type/schema';
import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../../type/definition';

/**
 * Experimental version of execute that supports returning AsyncIterable results
 */
declare function execute(
  ExecutionArgs,
  ..._: []
): PromiseOrValue<ExecutionResult>;
/* eslint-disable no-redeclare */
declare function execute(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{ +[variable: string]: mixed, ... },
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
  typeResolver?: ?GraphQLTypeResolver<any, any>,
): PromiseOrValue<ExecutionResult>;
export function execute(
  argsOrSchema,
  document,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
) {
  /* eslint-enable no-redeclare */
  // Extract arguments from object args if provided.
  return arguments.length === 1
    ? executeImpl(argsOrSchema)
    : executeImpl({
        schema: argsOrSchema,
        document,
        rootValue,
        contextValue,
        variableValues,
        operationName,
        fieldResolver,
        typeResolver,
      });
}
