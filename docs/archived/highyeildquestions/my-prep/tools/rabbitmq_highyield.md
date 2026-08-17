# RABBITMQ

## RabbitMQ Fundamentals & Architecture

- **RabbitMQ architecture. Exchanges, queues, bindings, connections, channels?**
- **Message broker role. Decoupling producers from consumers?**
- **AMQP protocol. RabbitMQ AMQP 0-9-1 implementation?**
- **Connections vs Channels. Resource multiplexing?**
- **Virtual hosts. Logical isolation, multi-tenancy?**
- **Vhost permission model. User access control?**

## Exchanges & Routing

- **Exchange types: Direct, Fanout, Topic, Headers. Routing logic?**
- **Direct exchange. Exact key matching?**
- **Fanout exchange. Broadcasting to all bound queues?**
- **Topic exchange. Pattern-based routing with wildcards (* and #)?**
- **Headers exchange. Routing on message headers?**
- **Exchange-to-exchange binding. Nested routing?**
- **Durable vs non-durable exchange. Persistence?**
- **Binding key vs routing key. Matching mechanism?**
- **Binding arguments. Additional routing criteria?**

## Queues & Messages

- **Queue. Message storage and ordering?**
- **FIFO ordering. Message ordering guarantee?**
- **Queue declaration. Durable queues, arguments?**
- **Queue TTL. Expiry of unused queues?**
- **Message TTL. Expiry of messages in queue?**
- **Max length. Queue size limits, overflow policies?**
- **Dead letter exchange (DLX). Handling rejected messages?**
- **Dead letter routing key. DLQ message routing?**
- **Priority queues. Message priority ordering?**
- **Lazy queues. Memory vs disk trade-off?**
- **Master location. Queue affinity, node persistence?**

## Message Publishing & Consuming

- **Publishing. Sending messages to exchange?**
- **Message properties. Routing key, content type, headers?**
- **Mandatory flag. Ensuring message routing?**
- **Immediate flag (deprecated). Deprecated in AMQP 0-9-1?**
- **Publisher confirms. Acknowledgment of message acceptance?**
- **Consuming. Subscribing to queue messages?**
- **QoS (Quality of Service). Prefetch count, fair dispatch?**
- **Basic.consume vs Basic.get. Subscription vs polling?**
- **Consumer tag. Identifying consumers?**
- **Exclusive consumer. Single subscriber guarantee?**

## Reliability & Durability

- **Durable queues. Persistence after broker restart?**
- **Durable exchanges. Exchange metadata persistence?**
- **Message persistence. Persistent vs transient messages?**
- **Publisher confirms. Guaranteeing message acceptance?**
- **Negative acknowledgment (NACK). Message rejection?**
- **Requeue flag. Returning message to queue?**
- **Manual acknowledgment. ACK timing control?**
- **Auto acknowledgment. Automatic message ACK?**
- **ACK on message processing. Error handling?**
- **Negative ACK timeout. Long-running operations?**
- **Multiple ACKs. Acknowledging multiple messages?**

## Reliability Patterns

- **Acknowledgment pattern. Ensuring delivery?**
- **Dead letter queue (DLQ). Handling failed messages?**
- **DLX with retry. Exponential backoff?**
- **Circuit breaker pattern. Failing fast on downstream issues?**
- **Poison pill message. Unprocessable message handling?**
- **Idempotent consumer. Handling duplicate messages?**
- **Message deduplication. Deduplication ID tracking?**
- **Transactional publishing. Multi-message atomic publish?**
- **Transactional consuming. Atomic ACK with state update?**

## Clustering & HA

- **Cluster. Multiple broker nodes sharing data?**
- **Node discovery. Cluster node joining?**
- **Disk nodes vs RAM nodes. Metadata storage?**
- **Quorum queues. Consensus-based replication?**
- **Classic mirrored queues (deprecated). Legacy HA?**
- **Quorum queue replicas. Replication factor?**
- **Quorum configuration. min.isr setting?**
- **Promotion (classic queues). Converting to mirrored?**
- **Failover. Automatic broker failure recovery?**
- **Manual intervention. Forcing leader election?**
- **Rolling restart. Zero-downtime upgrades?**

## Performance & Optimization

- **Throughput optimization. Batching, async publishing?**
- **Latency optimization. Prefetch count, queue depth?**
- **Memory optimization. Lazy queues, max length?**
- **CPU optimization. Channel efficiency?**
- **Disk I/O optimization. Flush batch size?**
- **Network optimization. Frame size, compression?**
- **Connection pooling. Reusing connections?**
- **Channel pooling. Multiple channels per connection?**
- **Publisher side throttling. Backpressure handling?**
- **Prefetch count tuning. Fair dispatch optimization?**
- **Message size optimization. Compression vs network bandwidth?**

## Monitoring & Operations

- **Management UI. Broker dashboard?**
- **rabbitmqctl. Command-line administration?**
- **Queue depth monitoring. Message backlog?**
- **Consumer monitoring. Active consumers, message rate?**
- **Memory usage monitoring. Threshold alerts?**
- **Disk space monitoring. Queue overflow prevention?**
- **Connection monitoring. Active connections?**
- **Message rate metrics. Publish/consume rates?**
- **Health checks. Liveness & readiness probes?**
- **Log analysis. Error patterns?**
- **Prometheus integration. Metrics collection?**
- **Alerting. Critical thresholds?**

## Advanced Features

- **Priority queues. Message priority levels?**
- **Message TTL. Per-message vs queue-level?**
- **Queue TTL. Unused queue cleanup?**
- **Lazy queues. Memory efficiency for large queues?**
- **Stream queues. Replay-able message stream?**
- **Offset tracking. Consumer position in stream?**
- **Stream consumer groups. Parallel stream consumption?**
- **Plugin architecture. Custom extensions?**
- **MQTT plugin. IoT device support?**
- **STOMP plugin. Message queue protocol support?**
- **RabbitMQ modules. AMQP 1.0, HTTP API?**

## Message Routing Patterns

- **Work queue pattern. Distributed task processing?**
- **Publish-subscribe pattern. Broadcasting messages?**
- **RPC pattern. Request-reply with correlation?**
- **Correlation ID. Matching replies to requests?**
- **Reply-to queue. Setting response destination?**
- **Routing with headers. Complex routing logic?**
- **Competing consumers. Load balancing across workers?**
- **Message demultiplexing. Splitting aggregated messages?**

## Security

- **Authentication. Username/password, certificates?**
- **Authorization. Permission model, per-user limits?**
- **User roles. Admin, management, policymaker?**
- **Virtual host permissions. User vhost access?**
- **Resource permissions. Queue/exchange permissions?**
- **SSL/TLS. Encrypted connections?**
- **Certificate validation. mTLS setup?**
- **Credentials rotation. Password policy?**
- **Audit logging. Access logging?**
- **SASL mechanisms. PLAIN, EXTERNAL?**

## RabbitMQ in Production

- **Deployment options. Docker, Kubernetes, cloud?**
- **Kubernetes operator. RabbitMQ on K8s?**
- **Persistent volumes. Queue data persistence?**
- **StatefulSet. Ordered pod creation?**
- **Service discovery. Pod-to-pod communication?**
- **Readiness probe. Health check for pod scheduling?**
- **Liveness probe. Pod restart on failure?**
- **Network policies. Pod communication restrictions?**
- **Resource limits. CPU, memory constraints?**
- **Backup strategy. Definitions export/import?**
- **Disaster recovery. Queue recreation from backup?**
- **High availability setup. Multiple replicas?**

## Troubleshooting & Edge Cases

- **Memory alarm. Broker refusing publishes?**
- **Disk alarm. Queue write failure?**
- **Queue accumulation. Consumer lag?**
- **Message ordering. Partition tolerance?**
- **Duplicate messages. At-least-once delivery?**
- **Lost messages. Acknowledgment issues?**
- **Connection leaks. Unclosed connections?**
- **Channel leaks. Unclosed channels?**
- **Broker hang. Deadlock diagnosis?**
- **Network partition. Cluster split-brain?**
- **Queue evacuation. Emergency shutdown?**

## Integration Patterns

- **Spring AMQP. RabbitTemplate, listener containers?**
- **Spring annotation-driven listeners. @RabbitListener?**
- **Error handling. ErrorHandler implementation?**
- **Retry template. Retry with backoff?**
- **Message converter. JSON serialization?**
- **Header mapping. Custom header handling?**
- **Logging interceptor. Debugging message flow?**

## Scenario Based