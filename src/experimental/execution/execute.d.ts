import { Maybe } from '../../jsutils/Maybe';
import { PromiseOrValue } from '../../jsutils/PromiseOrValue';

import { ExecutionArgs, ExecutionResult } from '../../execution/execute';

import { DocumentNode } from '../../language/ast';
import { GraphQLSchema } from '../../type/schema';
import {
  GraphQLFieldResolver,
  GraphQLTypeResolver,
} from '../../type/definition';

/**
 * Experimental version of execute that supports returning AsyncIterable results
 */
export function execute(args: ExecutionArgs): PromiseOrValue<ExecutionResult>;
export function execute(
  schema: GraphQLSchema,
  document: DocumentNode,
  rootValue?: any,
  contextValue?: any,
  variableValues?: Maybe<{ [key: string]: any }>,
  operationName?: Maybe<string>,
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>,
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>,
): PromiseOrValue<ExecutionResult>;
