import type { PromiseOrValue } from '../jsutils/PromiseOrValue';

import type { Source } from '../language/source';
import { parse } from '../language/parser';

import { validate } from '../validation/validate';

import type {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../type/definition';
import type { GraphQLSchema } from '../type/schema';
import { validateSchema } from '../type/validate';

import type { GraphQLArgs } from '../graphql';

import type { ExecutionResult } from '../execution/execute';

import { execute } from './execution/execute';

/**
 * Experimental version of the graphql function that supports
 * returning AsyncIterable results
 */
declare function graphql(GraphQLArgs, ..._: []): Promise<ExecutionResult>;
/* eslint-disable no-redeclare */
declare function graphql(
  schema: GraphQLSchema,
  source: Source | string,
  rootValue?: mixed,
  contextValue?: mixed,
  variableValues?: ?{ +[variable: string]: mixed, ... },
  operationName?: ?string,
  fieldResolver?: ?GraphQLFieldResolver<any, any>,
  typeResolver?: ?GraphQLTypeResolver<any, any>,
): Promise<ExecutionResult>;
export function graphql(
  argsOrSchema,
  source,
  rootValue,
  contextValue,
  variableValues,
  operationName,
  fieldResolver,
  typeResolver,
) {
  /* eslint-enable no-redeclare */
  // Always return a Promise for a consistent API.
  return new Promise((resolve) =>
    resolve(
      // Extract arguments from object args if provided.
      arguments.length === 1
        ? graphqlImpl(argsOrSchema)
        : graphqlImpl({
            schema: argsOrSchema,
            source,
            rootValue,
            contextValue,
            variableValues,
            operationName,
            fieldResolver,
            typeResolver,
          }),
    ),
  );
}

function graphqlImpl(args: GraphQLArgs): PromiseOrValue<ExecutionResult> {
  const {
    schema,
    source,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  } = args;

  // Validate Schema
  const schemaValidationErrors = validateSchema(schema);
  if (schemaValidationErrors.length > 0) {
    return { errors: schemaValidationErrors };
  }

  // Parse
  let document;
  try {
    document = parse(source);
  } catch (syntaxError) {
    return { errors: [syntaxError] };
  }

  // Validate
  const validationErrors = validate(schema, document);
  if (validationErrors.length > 0) {
    return { errors: validationErrors };
  }

  // Execute
  return execute({
    schema,
    document,
    rootValue,
    contextValue,
    variableValues,
    operationName,
    fieldResolver,
    typeResolver,
  });
}
