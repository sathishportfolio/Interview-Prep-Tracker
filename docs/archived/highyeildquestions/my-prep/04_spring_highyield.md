# SPRING ECOSYSTEM

## Spring Core & DI

- [ ] **Explain Spring IoC container lifecycle. Bean creation flow end-to-end?**
- [ ] **Singleton vs Prototype vs Request vs Session scope. Production implications?**
- [ ] **@Autowired vs @Inject vs constructor injection. Which & why?**
- [ ] **Circular dependency in beans. What happens? How to fix?**
- [ ] **@Lazy annotation. When use? Performance implications?**
- [ ] **BeanPostProcessor & BeanFactoryPostProcessor. Real-world use cases?**
- [ ] **ApplicationContext vs BeanFactory. When each?**
- [ ] **@Configuration vs @Component. Difference in bean creation?**
- [ ] **Bean initialization: @PostConstruct vs InitializingBean vs init-method. Which preferred?**
- [ ] **Bean destruction: @PreDestroy vs DisposableBean vs destroy-method. Cleanup order?**

## Spring MVC & Web

- [ ] **Explain DispatcherServlet request flow end-to-end.**
- [ ] **HandlerMapping vs HandlerAdapter. Roles?**
- [ ] **@RequestMapping vs @GetMapping vs @PostMapping. Differences?**
- [ ] **@RequestParam vs @PathVariable vs @RequestBody. When each?**
- [ ] **@ControllerAdvice vs @RestControllerAdvice. Exception handling difference?**
- [ ] **@ExceptionHandler vs global error handling. Order of execution?**
- [ ] **Interceptor vs Filter. Difference? Which for authentication?**
- [ ] **CORS configuration. How does preflight work? Spring setup?**
- [ ] **Content negotiation in Spring. How does it work?**
- [ ] **View Resolution. What happens behind ViewResolver?**

## Spring Data & Persistence

### JPA & Hibernate
- [ ] **Entity lifecycle: New → Managed → Detached → Removed. State transitions?**
- [ ] **@Transactional propagation: REQUIRED vs REQUIRES_NEW vs NESTED. Implications?**
- [ ] **Lazy loading vs Eager loading. N+1 query problem? How to fix?**
- [ ] **@OneToMany vs @ManyToOne vs @ManyToMany. Cascade types when?**
- [ ] **orphanRemoval vs cascadeType.REMOVE. Difference?**
- [ ] **Session cache vs L2 cache. What's cached? Performance gain?**
- [ ] **@Transactional rollback behavior. Checked vs Unchecked exceptions?**
- [ ] **Hibernate proxy objects. Why LazyInitializationException occurs?**
- [ ] **@Query with native SQL vs JPQL. When each?**
- [ ] **Criteria API vs QueryDSL vs JPA. Performance difference?**
- [ ] **Optimistic locking vs Pessimistic locking. @Version behavior?**
- [ ] **Hibernate dialect. Why needed? Custom implementation?**

### Spring Data JPA
- [ ] **@Repository vs @Service. Separation of concerns?**
- [ ] **CrudRepository vs JpaRepository vs PagingAndSortingRepository?**
- [ ] **Custom repository implementation. How to add business logic to repo layer?**
- [ ] **@Query derivation. Complex queries—when override?**
- [ ] **Projections in Spring Data. Performance benefit?**
- [ ] **Specifications for dynamic queries. Real-world use case?**
- [ ] **Batch operations in Spring Data. Performance vs single inserts?**
- [ ] **Auditing with @CreatedBy, @LastModifiedDate. How it works?**

### Spring Data MongoDB
- [ ] **Document storage vs Relational. When MongoDB over SQL?**
- [ ] **@Document vs @Collection. Difference?**
- [ ] **MongoTemplate vs MongoRepository. When each?**
- [ ] **Aggregation pipeline in Spring Data. Performance?**
- [ ] **Indexing in MongoDB. Performance tuning?**

## Spring Boot

- [ ] **Spring Boot auto-configuration. How does it work? @EnableAutoConfiguration?**
- [ ] **application.properties vs application.yml. Precedence?**
- [ ] **Embedded server (Tomcat/Netty). Pros vs standalone WAR?**
- [ ] **Actuator endpoints. Security implications? /health, /metrics usage?**
- [ ] **Custom Actuator endpoints. How to create?**
- [ ] **Starter dependencies. What's under the hood?**
- [ ] **Profile-specific configuration. application-{profile}.properties logic?**
- [ ] **Conditional beans: @ConditionalOnProperty, @ConditionalOnClass. Real use case?**
- [ ] **CommandLineRunner vs ApplicationRunner. Startup logic?**
- [ ] **Spring Boot testing: @SpringBootTest vs @WebMvcTest vs @DataJpaTest?**

## Spring Security

- [ ] **Authentication vs Authorization. Spring Security architecture?**
- [ ] **SecurityContextHolder & Authentication object. When populated?**
- [ ] **UserDetailsService vs UserDetails. Custom implementation?**
- [ ] **PasswordEncoder. Why BCrypt? Salting mechanism?**
- [ ] **OAuth2 flow: Authorization Code vs Client Credentials vs Implicit. When each?**
- [ ] **JWT vs Session-based authentication. Trade-offs?**
- [ ] **CSRF protection mechanism. How does Spring prevent it?**
- [ ] **CORS in Spring Security. Configuration precedence?**
- [ ] **SecurityFilterChain order. Custom filters—where to add?**
- [ ] **@PreAuthorize vs @Secured vs @RolesAllowed. Difference?**
- [ ] **Method-level security. How AOP implements it?**
- [ ] **OAuth2 resource server. Token validation flow?**
- [ ] **Refresh token rotation. Expiry strategy?**
- [ ] **HttpSession vs JWT in distributed systems. Sticky sessions?**

## Spring AOP & Transactions

### AOP
- [ ] **Aspects, Joinpoints, Pointcuts, Advice. Terminology?**
- [ ] **@Aspect vs XML configuration. Which preferred?**
- [ ] **Advice types: @Before, @After, @Around, @AfterReturning, @AfterThrowing. When each?**
- [ ] **Pointcut expressions. Complex matching scenarios?**
- [ ] **Proxy creation: JDK dynamic vs CGLIB. When each?**
- [ ] **Weaving: compile-time vs load-time vs runtime. Spring uses which?**
- [ ] **AOP performance cost. Optimizations?**

### Transactions
- [ ] **@Transactional on class vs method. Inheritance behavior?**
- [ ] **Propagation levels: REQUIRED vs REQUIRES_NEW vs NESTED. Real scenarios?**
- [ ] **Isolation levels: READ_UNCOMMITTED vs READ_COMMITTED vs REPEATABLE_READ vs SERIALIZABLE?**
- [ ] **TransactionManager vs PlatformTransactionManager. Abstraction?**
- [ ] **Declarative vs Programmatic transactions. Trade-offs?**
- [ ] **@Transactional(readOnly=true) optimization?**
- [ ] **Distributed transactions: Two-phase commit? Saga pattern?**
- [ ] **Transaction boundary problems. Service layer placement?**
- [ ] **Rollback behavior: when does it happen? Custom rules?**

## Spring Cloud

### Service Discovery & Load Balancing
- [ ] **Eureka server vs client. Registration flow?**
- [ ] **Service discovery in production. Heartbeat & eviction?**
- [ ] **Client-side vs Server-side load balancing. Spring implementation?**
- [ ] **Ribbon & LoadBalancer. Difference? Latest recommendation?**
- [ ] **Service registration & discovery challenges. Consistency issues?**

### API Gateway & Routing
- [ ] **Spring Cloud Gateway vs Zuul. Difference? Why Gateway now?**
- [ ] **Route predicates vs filters. When each?**
- [ ] **Rate limiting & throttling at gateway. Algorithms?**
- [ ] **Path rewriting. Configuration?**
- [ ] **Global exception handling in gateway. Propagation to clients?**

### Config Management
- [ ] **Spring Cloud Config Server. Centralized configuration management?**
- [ ] **Profile-specific config resolution. Precedence rules?**
- [ ] **Config refresh: @RefreshScope vs manual restart?**
- [ ] **Encryption in config server. Production security?**
- [ ] **Config versioning & rollback strategy?**

### Circuit Breaker & Resilience
- [ ] **Circuit breaker states: CLOSED vs OPEN vs HALF_OPEN. Transitions?**
- [ ] **Resilience4j vs Spring Retry. When each?**
- [ ] **@CircuitBreaker behavior. Fallback mechanism?**
- [ ] **Bulkhead pattern. Thread pool isolation?**
- [ ] **Timeout configuration. Integration with circuit breaker?**
- [ ] **Retry strategies: exponential backoff, jitter. Configuration?**

### Distributed Tracing
- [ ] **Spring Cloud Sleuth + Zipkin. Trace propagation?**
- [ ] **Trace ID vs Span ID. Correlation across services?**
- [ ] **Baggage propagation. Custom fields?**
- [ ] **Sampling strategy. Performance implications?**

### Event-Driven Architecture
- [ ] **Spring Cloud Stream. Message binding abstraction?**
- [ ] **Kafka vs RabbitMQ bindings. When each?**
- [ ] **Consumer groups in Stream. Scalability?**
- [ ] **Dead-letter queue handling?**
- [ ] **Error handling in async messaging. Retry vs DLQ?**

## Spring Testing

- [ ] **@SpringBootTest vs @WebMvcTest vs @DataJpaTest vs @RestClientTest?**
- [ ] **MockMvc for testing controllers. Request building & assertions?**
- [ ] **@MockBean vs @SpyBean. Difference?**
- [ ] **TestContainers for integration testing. Database setup?**
- [ ] **@DirtiesContext. When use? Performance implication?**
- [ ] **Parameterized tests with @ParameterizedTest.**
- [ ] **Test transaction behavior. Rollback after test?**
- [ ] **Performance testing framework integration?**

## Spring Validation & Data

- [ ] **@Valid vs @Validated. Difference?**
- [ ] **Custom validators. ConstraintValidator implementation?**
- [ ] **Validation groups. Conditional validation scenarios?**
- [ ] **@RequestParam binding. Type conversion & validation?**
- [ ] **Error handling in validation. BindingResult usage?**

## Spring Batch

- [ ] **Job vs Step architecture. ItemReader, ItemProcessor, ItemWriter?**
- [ ] **Chunk-oriented vs Tasklet processing. When each?**
- [ ] **JobRepository & Execution context. State management?**
- [ ] **Job scheduling with Spring Batch. Triggers?**
- [ ] **Error handling & recovery. Skip & retry policies?**
- [ ] **Scalability: parallel steps, multi-threaded steps?**
- [ ] **Job launcher. Restart behavior & idempotency?**

## Spring Integration

- [ ] **Integration with external systems. Message channels?**
- [ ] **Adapters vs Transformers vs Filters. Roles?**
- [ ] **Error handling in integration flows. Backoff strategy?**
- [ ] **Polling vs event-driven consumers?**

## Spring Kafka

- [ ] **KafkaTemplate for producer. Synchronous vs asynchronous sending?**
- [ ] **@KafkaListener for consumers. Consumer groups?**
- [ ] **Partition assignment. Scaling consumers?**
- [ ] **Rebalancing behavior. Seek & offset management?**
- [ ] **Error handling. DeadLetterPublishingRecoverer?**
- [ ] **Transaction semantics in Kafka. Exactly-once delivery?**
- [ ] **Compression & batching for performance?**

## Spring Data Redis

- [ ] **RedisTemplate vs StringRedisTemplate. When each?**
- [ ] **Spring cache abstraction: @Cacheable, @CachePut, @CacheEvict?**
- [ ] **Cache-aside vs write-through patterns?**
- [ ] **Cache invalidation strategies. TTL configuration?**
- [ ] **Redis serialization. Jackson vs Kryo?**
- [ ] **Session storage in Redis. @EnableRedisHttpSession?**
- [ ] **Distributed caching challenges. Cache consistency?**
- [ ] **Redis Streams with Spring. Consumer groups?**
- [ ] **Pub/Sub vs Streams. When each?**

## Spring WebFlux & Reactive

- [ ] **Reactive vs Traditional MVC. When WebFlux?**
- [ ] **Mono vs Flux. Lazy subscription?**
- [ ] **Backpressure handling. Performance optimization?**
- [ ] **Netty vs Tomcat. Event loop model?**
- [ ] **Reactive repository vs blocking. Migration challenges?**
- [ ] **Error handling in reactive chains. onError, onErrorResume?**
- [ ] **Testing reactive code. StepVerifier, virtual time?**
- [ ] **Reactive transaction management. Challenges?**
- [ ] **Thread safety in reactive. Schedulers?**

## Microservices Patterns

- [ ] **Service-to-service communication. REST vs gRPC vs message queue?**
- [ ] **Circuit breaker integration. Fallback strategies?**
- [ ] **Distributed tracing across services. Implementation?**
- [ ] **API versioning in microservices. Strategy?**
- [ ] **Saga pattern for distributed transactions. Choreography vs Orchestration?**
- [ ] **Database per service pattern. Data consistency challenges?**
- [ ] **API composition vs Query composition. Trade-offs?**
- [ ] **Event sourcing & CQRS in Spring. Implementation?**
- [ ] **Service mesh integration. Istio with Spring?**

## Spring Admin & Monitoring

- [ ] **Spring Boot Admin dashboard. Monitoring real-time metrics?**
- [ ] **Custom metrics with Micrometer. Publishing?**
- [ ] **Health indicators. Custom implementation?**
- [ ] **Alerting strategies. Thresholds & notifications?**
- [ ] **Log aggregation. ELK stack integration?**
- [ ] **APM tools integration. Datadog, New Relic?**

## Production & Performance

- [ ] **Connection pooling: HikariCP configuration. Size tuning?**
- [ ] **Thread pool sizing for async operations. Rejection policies?**
- [ ] **Caching strategy: local vs distributed. Eviction policies?**
- [ ] **Database query optimization. Index usage? Explain plan?**
- [ ] **Memory leak prevention in Spring apps. Common patterns?**
- [ ] **Graceful shutdown. Context cleanup order?**
- [ ] **Zero-downtime deployment. Blue-green vs canary?**
- [ ] **Load balancing at application level. Sticky sessions?**
- [ ] **Rate limiting & throttling. Token bucket algorithm?**
- [ ] **Security at scale. OAuth2 token caching? Refresh strategies?**

## Scenario Based