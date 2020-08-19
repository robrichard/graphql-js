import { Maybe } from '../jsutils/Maybe';

import { Source } from '../language/source';
import { GraphQLSchema } from '../type/schema';
import { GraphQLFieldResolver, GraphQLTypeResolver } from '../type/definition';

import { GraphQLArgs } from '../graphql';

import { ExecutionResult } from '../execution/execute';

/**
 * Experimental version of the graphql function that supports
 * returning AsyncIterable results
 */
export function graphql(args: GraphQLArgs): Promise<ExecutionResult>;
export function graphql(
  schema: GraphQLSchema,
  source: Source | string,
  rootValue?: any,
  contextValue?: any,
  variableValues?: Maybe<{ [key: string]: any }>,
  operationName?: Maybe<string>,
  fieldResolver?: Maybe<GraphQLFieldResolver<any, any>>,
  typeResolver?: Maybe<GraphQLTypeResolver<any, any>>,
): Promise<ExecutionResult>;
