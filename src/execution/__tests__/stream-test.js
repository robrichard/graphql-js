import { expect } from 'chai';
import { describe, it } from 'mocha';

import isAsyncIterable from '../../jsutils/isAsyncIterable';
import { parse } from '../../language/parser';

import { GraphQLID, GraphQLString } from '../../type/scalars';
import { GraphQLSchema } from '../../type/schema';
import { GraphQLObjectType, GraphQLList } from '../../type/definition';

import { execute } from '../execute';

const friendType = new GraphQLObjectType({
  fields: {
    id: { type: GraphQLID },
    name: { type: GraphQLString },
  },
  name: 'Friend',
});

const friends = [
  { name: 'Luke', id: 1 },
  { name: 'Han', id: 2 },
  { name: 'Leia', id: 3 },
];

const query = new GraphQLObjectType({
  fields: {
    scalarList: {
      type: new GraphQLList(GraphQLString),
      resolve: () => ['apple', 'banana', 'coconut'],
    },
    asyncList: {
      type: new GraphQLList(friendType),
      resolve: () => friends.map((f) => Promise.resolve(f)),
    },
    asyncListError: {
      type: new GraphQLList(friendType),
      resolve: () =>
        friends.map((f, i) => {
          if (i === 1) {
            return Promise.reject(new Error('bad'));
          }
          return Promise.resolve(f);
        }),
    },
    asyncIterableList: {
      type: new GraphQLList(friendType),
      async *resolve() {
        for (const friend of friends) {
          yield friend;
        }
      },
    },
    asyncIterableError: {
      type: new GraphQLList(friendType),
      async *resolve() {
        yield friends[0];
        throw new Error('bad');
      },
    },
    asyncIterableListDelayedClose: {
      type: new GraphQLList(friendType),
      async *resolve() {
        for (const friend of friends) {
          yield friend;
        }
        await new Promise((r) => setTimeout(r, 1));
      },
    },
  },
  name: 'Query',
});

async function complete(document, options) {
  const schema = new GraphQLSchema({
    query,
    experimentalDefer: true,
    experimentalStream: options?.experimentalStream ?? true,
  });

  const result = await execute({
    schema,
    document,
    rootValue: {},
  });

  if (isAsyncIterable(result)) {
    const results = [];
    for await (const patch of result) {
      results.push(patch);
    }
    return results;
  }
  return result;
}

describe('Execute: stream directive', () => {
  it('Should ignore @stream if experimental stream is not enabled', async () => {
    const document = parse('{ scalarList @stream(initialCount: 0) }');
    const result = await complete(document, { experimentalStream: false });

    expect(result).to.deep.equal({
      data: { scalarList: ['apple', 'banana', 'coconut'] },
    });
  });
  it('Can still query list field when experimental stream is enabled', async () => {
    const document = parse('{ scalarList }');
    const result = await complete(document);

    expect(result).to.deep.equal({
      data: { scalarList: ['apple', 'banana', 'coconut'] },
    });
  });
  it('Can stream a list field', async () => {
    const document = parse('{ scalarList @stream(initialCount: 0) }');
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          scalarList: [],
        },
        hasNext: true,
      },
      {
        data: 'apple',
        path: ['scalarList', 0],
        hasNext: true,
      },
      {
        data: 'banana',
        path: ['scalarList', 1],
        hasNext: true,
      },
      {
        data: 'coconut',
        path: ['scalarList', 2],
        hasNext: false,
      },
    ]);
  });
  it('Returns label from stream directive', async () => {
    const document = parse(
      '{ scalarList @stream(initialCount: 1, label: "scalar-stream") }',
    );
    const result = await complete(document);

    expect(result).to.deep.equal([
      {
        data: {
          scalarList: ['apple'],
        },
        hasNext: true,
      },
      {
        data: 'banana',
        path: ['scalarList', 1],
        label: 'scalar-stream',
        hasNext: true,
      },
      {
        data: 'coconut',
        path: ['scalarList', 2],
        label: 'scalar-stream',
        hasNext: false,
      },
    ]);
  });
  it('Can disable @stream using if argument', async () => {
    const document = parse(
      '{ scalarList @stream(initialCount: 0, if: false) }',
    );
    const result = await complete(document);

    expect(result).to.deep.equal({
      data: { scalarList: ['apple', 'banana', 'coconut'] },
    });
  });
  it('Can stream a field that returns a list of promises', async () => {
    const document = parse(`
      query { 
        asyncList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncList: [
            {
              name: 'Luke',
              id: '1',
            },
            {
              name: 'Han',
              id: '2',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          id: '3',
        },
        path: ['asyncList', 2],
        hasNext: false,
      },
    ]);
  });
  it('Handles rejections in a field that returns a list of promises before initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncListError @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        errors: [
          {
            message: 'bad',
            locations: [
              {
                line: 3,
                column: 9,
              },
            ],
            path: ['asyncListError', 1],
          },
        ],
        data: {
          asyncListError: [
            {
              name: 'Luke',
              id: '1',
            },
            null,
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          id: '3',
        },
        path: ['asyncListError', 2],
        hasNext: false,
      },
    ]);
  });
  it('Handles rejections in a field that returns a list of promises after initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncListError @stream(initialCount: 1) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncListError: [
            {
              name: 'Luke',
              id: '1',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: null,
        path: ['asyncListError', 1],
        errors: [
          {
            message: 'bad',
            locations: [
              {
                line: 3,
                column: 9,
              },
            ],
            path: ['asyncListError', 1],
          },
        ],
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          id: '3',
        },
        path: ['asyncListError', 2],
        hasNext: false,
      },
    ]);
  });
  it('Can stream a field that returns an async iterable', async () => {
    const document = parse(`
      query { 
        asyncIterableList @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncIterableList: [
            {
              name: 'Luke',
              id: '1',
            },
            {
              name: 'Han',
              id: '2',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
          id: '3',
        },
        path: ['asyncIterableList', 2],
        hasNext: true,
      },
      {
        hasNext: false,
      },
    ]);
  });
  it('Handles error thrown in async iterable before initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncIterableError @stream(initialCount: 2) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal({
      errors: [
        {
          message: 'bad',
          locations: [
            {
              line: 3,
              column: 9,
            },
          ],
          path: ['asyncIterableError', 1],
        },
      ],
      data: {
        asyncIterableError: [
          {
            name: 'Luke',
            id: '1',
          },
          null,
        ],
      },
    });
  });
  it('Handles error thrown in async iterable after initialCount is reached', async () => {
    const document = parse(`
      query { 
        asyncIterableError @stream(initialCount: 1) {
          name
          id
        }
      }
    `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncIterableError: [
            {
              name: 'Luke',
              id: '1',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: null,
        path: ['asyncIterableError', 1],
        errors: [
          {
            message: 'bad',
            locations: [
              {
                line: 3,
                column: 9,
              },
            ],
            path: ['asyncIterableError', 1],
          },
        ],
        hasNext: false,
      },
    ]);
  });
  it('Can @defer fields that are resolved after async iterable is complete', async () => {
    const document = parse(`
    query { 
      asyncIterableList @stream(initialCount: 1, label:"stream-label") {
        ...NameFragment @defer(label: "DeferName") @defer(label: "DeferName")
        id
      }
    }
    fragment NameFragment on Friend {
      name
    }
  `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncIterableList: [
            {
              id: '1',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Luke',
        },
        path: ['asyncIterableList', 0],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          id: '2',
        },
        path: ['asyncIterableList', 1],
        label: 'stream-label',
        hasNext: true,
      },
      {
        data: {
          id: '3',
        },
        path: ['asyncIterableList', 2],
        label: 'stream-label',
        hasNext: true,
      },
      {
        data: {
          name: 'Han',
        },
        path: ['asyncIterableList', 1],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
        },
        path: ['asyncIterableList', 2],
        label: 'DeferName',
        hasNext: false,
      },
    ]);
  });
  it('Can @defer fields that are resolved before async iterable is complete', async () => {
    const document = parse(`
    query { 
      asyncIterableListDelayedClose @stream(initialCount: 1, label:"stream-label") {
        ...NameFragment @defer(label: "DeferName") @defer(label: "DeferName")
        id
      }
    }
    fragment NameFragment on Friend {
      name
    }
  `);
    const result = await complete(document);
    expect(result).to.deep.equal([
      {
        data: {
          asyncIterableListDelayedClose: [
            {
              id: '1',
            },
          ],
        },
        hasNext: true,
      },
      {
        data: {
          name: 'Luke',
        },
        path: ['asyncIterableListDelayedClose', 0],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          id: '2',
        },
        path: ['asyncIterableListDelayedClose', 1],
        label: 'stream-label',
        hasNext: true,
      },
      {
        data: {
          id: '3',
        },
        path: ['asyncIterableListDelayedClose', 2],
        label: 'stream-label',
        hasNext: true,
      },
      {
        data: {
          name: 'Han',
        },
        path: ['asyncIterableListDelayedClose', 1],
        label: 'DeferName',
        hasNext: true,
      },
      {
        data: {
          name: 'Leia',
        },
        path: ['asyncIterableListDelayedClose', 2],
        label: 'DeferName',
        hasNext: true,
      },
      {
        hasNext: false,
      },
    ]);
  });
});
