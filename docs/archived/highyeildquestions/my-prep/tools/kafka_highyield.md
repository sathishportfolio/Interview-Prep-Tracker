# KAFKA

## Kafka Fundamentals & Architecture

- **Kafka architecture. Brokers, topics, partitions, consumer groups, Zookeeper (deprecated)?**
- **KRaft mode. Zookeeper replacement. Benefits?**
- **Topic vs Partition. Data distribution? Replication?**
- **Leader vs Follower replicas. ISR (In-Sync Replicas)?**
- **Replication factor. Availability vs durability vs storage cost?**
- **Min in-sync replicas (min.insync.replicas). Durability guarantee?**
- **Broker failure handling. Leader election. Data consistency?**
- **Partition leadership election. Controller role?**
- **Committed offset. Consumer group position tracking?**
- **__consumer_offsets topic. Offset storage?**

## Producers

- **Producer architecture. Batching, compression, partitioning?**
- **Partitioner logic. Key-based vs round-robin distribution?**
- **Custom partitioner. Real-world use case?**
- **acks setting: 0 vs 1 vs all. Durability vs latency?**
- **Retries & backoff. Idempotent producer?**
- **Idempotent producer. Exactly-once semantics at producer level?**
- **Transactional producer. ACID guarantees across partitions?**
- **Compression algorithms: snappy vs lz4 vs gzip vs zstd. Trade-offs?**
- **Buffer memory management. max.block.ms timeout?**
- **Batch size tuning. Throughput vs latency?**
- **Linger.ms. Waiting for batching?**
- **Send callback handling. Asynchronous vs synchronous?**
- **Schema registry integration. Avro serialization?**

## Consumers

- **Consumer group. Parallel processing, scalability?**
- **Rebalancing. Eager vs cooperative rebalancing?**
- **Group coordinator. Rebalancing orchestration?**
- **Consumer lag. Monitoring metric?**
- **Offset management. auto.offset.reset behavior?**
- **earliest vs latest vs none offset reset. Recovery scenarios?**
- **enable.auto.commit. Manual vs automatic commit?**
- **Commit offset timing. Performance vs consistency?**
- **Seek & reset. Moving consumer offset?**
- **Consumer retention. How long can consumer fall behind?**
- **Pause & resume. Flow control?**
- **Consumer threads. Single-threaded consumer pattern?**
- **Thread safety. Consumer not thread-safe. Scaling pattern?**
- **Heartbeat mechanism. session.timeout.ms, heartbeat.interval.ms?**
- **Max poll interval. Processing time limit?**
- **Fetch size tuning. Large message handling?**

## Topics & Partitions

- **Partition count. Throughput vs complexity trade-off?**
- **Changing partition count. Rebalancing impact?**
- **Partition assignment strategy. Range vs Round-robin vs Sticky vs Cooperative Sticky?**
- **Sticky assignment. Minimizing partition movement?**
- **Retention policy: time vs size vs compact. Cleanup policies?**
- **Log compaction. Snapshot semantics for state topics?**
- **Segment management. Disk I/O optimization?**
- **Message ordering. Guarantees per partition, not topic?**
- **Exactly-once delivery. Producer + consumer idempotence?**

## Reliability & Durability

- **min.insync.replicas impact. Unclean leader election?**
- **Acknowledgments for durability. acks=all latency cost?**
- **Durability vs Latency trade-off. Tuning for use case?**
- **Message ordering guarantees. Single partition requirement?**
- **Exactly-once semantics (EOS). Producer idempotence + consumer offset atomicity?**
- **Transactional reads. Reading uncommitted messages?**
- **Isolation levels: read_uncommitted vs read_committed?**
- **Exactly-once in stream processing. Transactions with state stores?**

## Performance & Optimization

- **Throughput optimization. Batching, compression, partition count?**
- **Latency optimization. acks, linger.ms, batch.size trade-offs?**
- **Memory usage tuning. buffer.memory, fetch.max.bytes?**
- **CPU optimization. Compression algorithms, serialization?**
- **Disk I/O optimization. Segment size, flush intervals?**
- **Network optimization. Compression, batch size, partition count?**
- **Consumer lag monitoring. Alerting thresholds?**
- **Broker performance tuning. num.network.threads, num.io.threads?**
- **JVM tuning for Kafka. Heap size, GC settings?**
- **Log cleanup performance. log.cleanup.policy impact?**

## Monitoring & Operations

- **JMX metrics. Producer, consumer, broker metrics?**
- **Lag monitoring. Consumer lag per partition?**
- **Broker metrics. ISR shrinkage, under-replicated partitions?**
- **Alerting strategy. Critical metrics?**
- **Log analysis. Error patterns in Kafka logs?**
- **Cluster health checks. Leader elections, controller issues?**
- **Capacity planning. Disk space, network, CPU forecasting?**
- **Rolling updates. Zero-downtime broker upgrades?**
- **Scaling brokers. Adding brokers, leadership distribution?**
- **Decommissioning brokers. Data migration?**

## Kafka Streams

- **Stream vs KStream vs KTable vs GlobalKTable?**
- **Stateless operations: map, filter, branch?**
- **Stateful operations: aggregate, reduce. State store?**
- **Windowing: tumbling, hopping, session, grace period?**
- **Join operations: KStream-KStream, KStream-KTable, KTable-KTable?**
- **Interactive queries. Querying state stores?**
- **Exactly-once processing. Transactional state store updates?**
- **Stream topology. Parallelism vs DAG structure?**
- **Processor API vs DSL. When each?**
- **Custom processors. Stateful processors?**
- **Reprocessing. Resetting application state?**
- **Changelog topics. Restore from failure?**

## Schema & Data Governance

- **Confluent Schema Registry. Schema versioning, compatibility?**
- **Compatibility modes: backward, forward, full, transitive?**
- **Avro schema evolution. Breaking changes?**
- **Subject naming strategies. TopicNameStrategy vs RecordNameStrategy?**
- **Schema validation at producer level. Enforcement?**
- **Default values in schema. Evolution strategy?**
- **Protobuf vs Avro vs JSON Schema. When each?**
- **Data lineage. Schema-driven data governance?**

## Multi-Tenancy & Security

- **Multi-tenancy patterns. Shared cluster vs dedicated clusters?**
- **Topic isolation. RBAC (Role-Based Access Control)?**
- **SASL authentication. PLAIN vs SCRAM vs OAUTHBEARER?**
- **mTLS encryption. Broker-to-broker, client-to-broker?**
- **Authorization. ACL (Access Control List) management?**
- **Inter-broker communication security. security.protocol?**
- **Audit logging. Who accessed what topic?**
- **Data encryption at rest. Transparent data encryption?**
- **Key management service (KMS) integration?**

## Disaster Recovery & HA

- **Backup strategy. Broker failure recovery?**
- **Replication quorum. Fault tolerance formula?**
- **Unclean leader election. Data loss vs availability trade-off?**
- **Controller failure. Recovery mechanism?**
- **Cluster failover. Multi-region setup?**
- **Data replication cross-region. Mirroring tools?**
- **MirrorMaker. Topic replication to secondary cluster?**
- **RTO & RPO. Recovery objectives for production?**
- **Chaos engineering. Failure simulation?**

## Integration Patterns

- **CDC (Change Data Capture). Capturing database changes to Kafka?**
- **Debezium connectors. Real-time data sync?**
- **Kafka Connect. Connector framework, transformations?**
- **Source connectors. Data ingestion into Kafka?**
- **Sink connectors. Kafka to external systems?**
- **Exactly-once delivery connectors. Idempotent sinks?**
- **SMTs (Single Message Transforms). Data transformation?**
- **Distributed connect cluster. Scaling, high availability?**

## Scenario Based