# GRAPHQL

## GraphQL Fundamentals & Architecture

- **GraphQL vs REST. Advantages & trade-offs?**
- **Schema-driven API. Type system benefits?**
- **Query language. Declarative data fetching?**
- **Strongly typed schema. Type validation?**
- **Introspection. Self-documenting API?**
- **GraphQL server architecture. Resolver, datasource layers?**
- **Single endpoint vs multiple. Complexity management?**
- **HTTP protocol. POST requests, query submission?**

## Schema Design

- **Type definition. Object types, fields, scalar types?**
- **Scalar types: Int, String, Boolean, Float, ID, custom scalars?**
- **Object types. Nested type relationships?**
- **Input types. Mutation argument structure?**
- **Interface type. Shared field structure?**
- **Union type. Multiple possible return types?**
- **Enum type. Restricted value set?**
- **Directive. Schema & query-time customization?**
- **Null vs Non-null types (!). Type safety?**
- **List types. Array field handling?**
- **Schema documentation. Field descriptions?**
- **Schema stitching. Combining multiple schemas?**
- **Apollo Federation. Distributed schema management?**
- **Schema composition. Merging subgraph schemas?**

## Queries & Mutations

- **Query. Read-only data fetching?**
- **Field selection. Client-specified response structure?**
- **Nested field queries. Traversing object graphs?**
- **Aliases. Renaming fields in response?**
- **Fragments. Reusable field selections?**
- **Named fragments. Sharing across queries?**
- **Inline fragments. Conditional field selection on unions/interfaces?**
- **Variables. Parameterized query templates?**
- **Query operation. Multiple queries in single request?**
- **Mutation. Data modification operation?**
- **Mutation ordering. Sequential execution?**
- **Mutation response. Returning modified data?**
- **Multiple mutations. Atomic execution?**

## Resolvers & Data Loading

- **Resolver function. Field computation logic?**
- **Resolver arguments. args, context, info parameters?**
- **Root resolver. Top-level query/mutation entry?**
- **Nested resolver. Querying related data?**
- **Default resolver. Auto-resolution from parent object?**
- **N+1 query problem in GraphQL. Batch loading?**
- **DataLoader. Batching & caching in resolvers?**
- **Batching strategy. Reducing database queries?**
- **Caching strategy. In-memory vs distributed?**
- **Lazy resolution. Only fetching requested fields?**
- **Directive resolver. Custom directive logic?**

## Performance & Optimization

- **Query cost analysis. Preventing expensive queries?**
- **Query depth limiting. Preventing deeply nested queries?**
- **Query complexity calculation. Custom scoring?**
- **Rate limiting. Throttling client requests?**
- **Timeout configuration. Long-running query prevention?**
- **Batch size limits. Array field limitations?**
- **Fragment caching. Client-side caching?**
- **APQ (Automatic Persisted Queries). Query string optimization?**
- **Persistent queries. Pre-approved queries only?**
- **Network optimization. Selecting minimal fields?**
- **Compression. Gzip response compression?**
- **Pagination. Cursor vs offset-based?**
- **Relay cursor pagination. Standard pagination pattern?**
- **Offset-based pagination. Limitations at scale?**

## Subscriptions & Real-Time

- **Subscription. Server push to client?**
- **WebSocket protocol. Persistent connection?**
- **Subscription resolver. Event streaming?**
- **PubSub mechanism. Event publishing & subscribing?**
- **Message queue integration. Kafka, RabbitMQ backed pubsub?**
- **Filtering subscriptions. Server-side filtering?**
- **Unsubscribe. Cleanup on client disconnect?**
- **Backpressure. Managing subscription data flow?**
- **Reconnection logic. Client recovery from disconnect?**
- **Heartbeat. Connection keep-alive?**

## Type System & Validation

- **Input validation. Type system validation?**
- **Custom scalars. Serialization & deserialization?**
- **Scalar serialization. Converting values to wire format?**
- **Scalar parsing. Parsing input values?**
- **Enum validation. Restricted value sets?**
- **List validation. Array element validation?**
- **Input object validation. Nested input structure?**
- **Directive validation. @deprecated, custom directives?**
- **Validation rules. GraphQL spec compliance?**
- **Custom validation. Domain-specific rules?**

## Authorization & Security

- **Authorization vs Authentication. Permission enforcement?**
- **Field-level authorization. Per-field permission checks?**
- **Directive-based auth. @auth, @requiresRole directives?**
- **Resolver-level auth. Permission checks in resolver?**
- **Query-level auth. Entire query authorization?**
- **Role-based access control (RBAC). User role mapping?**
- **Attribute-based access control (ABAC). Complex policy rules?**
- **Data masking. Hiding sensitive fields?**
- **Row-level security. Record-level authorization?**
- **Mutation authorization. Who can modify data?**
- **Introspection protection. Disabling schema introspection?**
- **Preventing query introspection. Security through obscurity?**
- **JWT authentication. Token-based user identification?**
- **OAuth2 integration. Third-party authorization?**

## Error Handling

- **GraphQL errors. Error format specification?**
- **Error path. Location of error in query?**
- **Error extensions. Custom error metadata?**
- **Resolver error handling. try-catch in resolvers?**
- **Partial success. Returning data alongside errors?**
- **Error propagation. Bubbling errors up the tree?**
- **Field error vs request error. Error scope?**
- **Error logging. Debugging & monitoring?**
- **Custom error types. Domain-specific error handling?**
- **Null vs error distinction. Missing vs invalid field?**

## Federation & Microservices

- **Apollo Federation. Distributed schema architecture?**
- **Subgraph. Federated schema component?**
- **Apollo Gateway. Schema composition & routing?**
- **Entity type. Federated type reference?**
- **Reference resolver. Fetching entity by foreign key?**
- **Service mesh integration. Federation on microservices?**
- **Cross-service communication. Reference resolution?**
- **Type composition. Extending types across services?**
- **Field ownership. Type-service mapping?**
- **Managed federation. Apollo Studio managed federation?**
- **Self-managed federation. Custom gateway implementation?**
- **Versioning. Backward compatibility in federation?**

## Caching Strategies

- **HTTP caching. Cache-Control headers in GraphQL?**
- **Cache-Control directives. public, private, max-age?**
- **CDN caching. Public query caching?**
- **Field-level cache hints. @cacheControl directive?**
- **Query-level caching. Entire query caching?**
- **Redis caching. Distributed cache backend?**
- **Cache invalidation. Invalidating stale data?**
- **Partial cache hits. Merging cached & fresh data?**
- **Cache busting. Versioning queries?**

## Testing

- **Query testing. Testing GraphQL queries?**
- **Mutation testing. Testing data modifications?**
- **Resolver testing. Unit testing resolvers?**
- **Mock server. Testing without backend?**
- **GraphQL testing tools: Apollo Client Testing, jest-mock-graphql?**
- **Integration testing. End-to-end testing?**
- **Snapshot testing. Query response validation?**
- **E2E testing. Full stack testing?**

## Monitoring & Observability

- **Query monitoring. Tracking query performance?**
- **Resolver metrics. Per-field performance?**
- **Latency tracking. Query execution time?**
- **Error tracking. Error rate monitoring?**
- **Apollo Metrics. Built-in GraphQL metrics?**
- **APM integration. Tracing resolvers?**
- **Query sampling. Selective tracing?**
- **Performance budgeting. Query cost limits?**
- **Slow query detection. Identifying expensive queries?**
- **DataLoader metrics. Batch size tracking?**

## Advanced Features & Tools

- **Directives. Schema & query customization?**
- **@deprecated. Marking obsolete fields?**
- **@skip & @include. Conditional field inclusion?**
- **Custom directives. Domain-specific directives?**
- **Directive composition. Combining directives?**
- **Apollo Client. GraphQL client library?**
- **Client caching. Apollo Client cache management?**
- **Optimistic UI. Optimistic updates in client?**
- **Query optimization. Apollo Client query optimization?**
- **Relay. Facebook's GraphQL client framework?**
- **Relay Modern. Current Relay implementation?**
- **Persisted queries. Query whitelisting?**

## Schema Evolution & Versioning

- **Backward compatibility. Breaking change prevention?**
- **Field deprecation. Phasing out fields?**
- **Type evolution. Adding new types?**
- **Argument evolution. Adding new arguments?**
- **Default values. Providing defaults for new arguments?**
- **Type migration. Moving from one type to another?**
- **Schema versioning. Supporting multiple schema versions?**
- **Changelog. Tracking schema changes?**

## Common Patterns & Anti-Patterns

- **Overfetching prevention. Clients fetch what they need?**
- **Underfetching prevention. Single query for related data?**
- **God resolver. Breaking down complex resolvers?**
- **Circular dependencies. Query cycles?**
- **Mutation naming. Naming convention best practice?**
- **Batch mutation. Handling multiple mutations?**
- **Global object ID. Using relay global object ID?**
- **Batching N+1. Using DataLoader?**
- **Resolver bloat. Logic organization?**

## Scenario Based