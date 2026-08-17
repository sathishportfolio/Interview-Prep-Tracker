# REDIS

## Redis Fundamentals & Architecture

- **Redis data structure. In-memory key-value store?**
- **Single-threaded model. Concurrency handling?**
- **Key expiry. TTL & EXPIRE mechanisms?**
- **Database selection. Multiple logical databases?**
- **Connection management. Connections & pipelining?**
- **Memory management. Eviction policies?**
- **Persistence. RDB vs AOF?**
- **Replication. Master-slave architecture?**
- **Clustering. Sharded distributed Redis?**
- **Sentinel. High availability & automatic failover?**

## Data Types & Operations

- **String type. Basic key-value, integers, floats?**
- **Hash type. Object storage with fields?**
- **List type. Ordered collection, queue/stack operations?**
- **Set type. Unordered unique collection?**
- **Sorted set type. Ordered by score?**
- **Stream type. Time-series message log?**
- **Bitmap operations. Bit-level operations?**
- **HyperLogLog. Cardinality estimation?**
- **Geospatial indexes. Location-based queries?**
- **Type conversion. Converting between types?**

## String Operations

- **SET, GET, GETSET. Basic operations?**
- **MGET, MSET. Bulk operations?**
- **SETEX, PSETEX. Setting with expiry?**
- **INCR, DECR. Atomic increment/decrement?**
- **INCRBY, DECRBY. Increment by value?**
- **APPEND. String concatenation?**
- **STRLEN. String length?**
- **GETRANGE, SETRANGE. Substring operations?**
- **Bit operations: SETBIT, GETBIT, BITCOUNT, BITOP?**

## Hash Operations

- **HSET, HGET, HDEL. Field operations?**
- **HMGET, HMSET. Bulk field operations?**
- **HGETALL. Fetching entire hash?**
- **HEXISTS. Field existence check?**
- **HLEN. Number of fields?**
- **HKEYS, HVALS. Getting keys or values?**
- **HINCRBY, HINCRBYFLOAT. Incrementing field values?**
- **HSCAN. Iterating fields?**

## List Operations

- **LPUSH, RPUSH, LPOP, RPOP. Queue operations?**
- **LLEN. List length?**
- **LRANGE. Fetching range of elements?**
- **LINDEX. Accessing by index?**
- **LSET. Setting element by index?**
- **LTRIM. Trimming list?**
- **BLPOP, BRPOP. Blocking pop operations?**
- **BRPOPLPUSH. Atomic pop and push?**
- **RPOPLPUSH. Moving element between lists?**
- **LINSERT. Inserting before/after element?**

## Set Operations

- **SADD, SREM, SMEMBERS. Basic operations?**
- **SCARD. Set cardinality?**
- **SISMEMBER, SMISMEMBER. Membership check?**
- **SINTER, SUNION, SDIFF. Set operations?**
- **SINTERSTORE, SUNIONSTORE, SDIFFSTORE. Storing results?**
- **SPOP, SRANDMEMBER. Random element operations?**
- **SMOVE. Moving element between sets?**
- **SSCAN. Iterating set members?**

## Sorted Set Operations

- **ZADD, ZREM. Adding/removing members?**
- **ZCARD. Cardinality?**
- **ZCOUNT. Count by score range?**
- **ZRANGE, ZREVRANGE. Range queries?**
- **ZRANGEBYSCORE, ZREVRANGEBYSCORE. Score range queries?**
- **ZRANK, ZREVRANK. Rank of member?**
- **ZSCORE. Member score?**
- **ZINCRBY. Incrementing score?**
- **ZINTERSTORE, ZUNIONSTORE. Set operations with weights?**
- **ZPOPMIN, ZPOPMAX. Removing min/max score members?**
- **BZPOPMIN, BZPOPMAX. Blocking pop min/max?**
- **ZSCAN. Iterating members?**

## Stream Operations

- **XADD. Adding message to stream?**
- **XLEN. Stream length?**
- **XRANGE, XREVRANGE. Reading range?**
- **XREAD. Reading messages sequentially?**
- **XGROUP CREATE. Consumer group creation?**
- **XREADGROUP. Reading in consumer group?**
- **XACK. Message acknowledgment?**
- **XPENDING. Pending message info?**
- **XCLAIM. Claiming pending messages?**
- **XDEL. Deleting message?**
- **XTRIM. Trimming stream size?**

## Key Expiry & TTL

- **EXPIRE, EXPIREAT. Setting expiry?**
- **PEXPIRE, PEXPIREAT. Millisecond expiry?**
- **TTL, PTTL. Checking remaining TTL?**
- **PERSIST. Removing expiry?**
- **Expiry accuracy. Millisecond accuracy?**
- **Background eviction. Periodic cleanup?**
- **Expiry notification. Key space notifications?**

## Eviction Policies

- **noeviction. No eviction, error on memory full?**
- **allkeys-lru. LRU eviction on all keys?**
- **volatile-lru. LRU eviction on keys with expiry?**
- **allkeys-lfu. LFU eviction on all keys?**
- **volatile-lfu. LFU eviction on keys with expiry?**
- **allkeys-random. Random eviction on all keys?**
- **volatile-random. Random eviction on keys with expiry?**
- **volatile-ttl. Evicting keys closest to expiry?**
- **Memory threshold. maxmemory setting?**
- **Eviction sampling. Approximate LRU/LFU?**

## Persistence

- **RDB (Snapshot). Point-in-time backup?**
- **SAVE, BGSAVE. Synchronous vs background save?**
- **RDB format. Binary format for snapshots?**
- **AOF (Append-Only File). Command logging?**
- **AOF rewrite. Compacting AOF file?**
- **BGREWRITEAOF. Background AOF rewrite?**
- **Fsync policy: always, everysec, no. Durability vs performance?**
- **Hybrid persistence. Combining RDB and AOF?**
- **Loading persistence. Restoring from RDB/AOF?**
- **Backup strategy. Point-in-time recovery?**
- **Disaster recovery. RTO & RPO planning?**

## Transactions & Scripting

- **MULTI, EXEC, DISCARD. Transaction block?**
- **WATCH, UNWATCH. Optimistic locking?**
- **Transaction atomicity. All-or-nothing execution?**
- **Lua scripting. Server-side script execution?**
- **EVAL, EVALSHA. Script evaluation?**
- **Script atomicity. Lua script isolation?**
- **Script caching. Script hash caching?**
- **SCRIPT LOAD. Pre-loading scripts?**
- **SCRIPT EXISTS, SCRIPT FLUSH. Script management?**
- **Blocking commands in scripts. Potential deadlock?**

## Replication & HA

- **Master-slave replication. One-way data sync?**
- **Replication offset. Tracking data consistency?**
- **Partial resync. Recovering from temporary disconnect?**
- **Full resync. Complete data transfer?**
- **Replication lag. Master-slave consistency?**
- **Read replicas. Scaling read operations?**
- **Write operations. Master only?**
- **Sentinel. High availability monitoring?**
- **Sentinel configuration. Monitoring master?**
- **Failover trigger. Automatic master election?**
- **Quorum. Number of sentinels for consensus?**
- **Sentinel notification. Client redirect on failover?**

## Clustering

- **Redis Cluster. Distributed key storage?**
- **Cluster sharding. Hash slot distribution?**
- **Node mapping. Hash slot to node?**
- **Cluster nodes. Master and replica nodes?**
- **Replica migration. Auto-rebalancing?**
- **Cluster topology. Node discovery?**
- **Cluster gossip protocol. Communication mechanism?**
- **Redirects: MOVED, ASK. Client navigation?**
- **Key distribution. CRC16 hash?**
- **Multi-key operations. Crossing slot boundaries?**
- **Cluster failover. Automatic replica promotion?**
- **Cluster rebalancing. Manual slot migration?**
- **Scaling cluster. Adding/removing nodes?**

## Performance & Optimization

- **Pipelining. Batching commands?**
- **Batch size optimization. Network efficiency?**
- **Connection pooling. Reusing connections?**
- **Memory optimization. Data structure efficiency?**
- **Memory analysis. MEMORY DOCTOR command?**
- **Key eviction. Cleaning up expired keys?**
- **Slow log. Identifying slow commands?**
- **INFO stats. Performance metrics?**
- **Throughput optimization. Command rate?**
- **Latency monitoring. Latency histogram?**
- **Lazy freeing. Background deletion?**
- **Jemalloc tuning. Memory allocator optimization?**

## Caching Patterns

- **Cache-aside pattern. Load on miss?**
- **Write-through pattern. Synchronous update?**
- **Write-behind pattern. Asynchronous update?**
- **Cache-control headers. HTTP caching?**
- **Stampede prevention. Avoiding thundering herd?**
- **Probabilistic early expiration. Preventing stampede?**
- **Cache warming. Pre-loading frequent data?**
- **Cache invalidation. Clearing stale data?**
- **TTL strategy. Balancing freshness vs load?**

## Monitoring & Operations

- **INFO command. Comprehensive stats?**
- **MONITOR. Monitoring client commands?**
- **SLOWLOG. Slow command tracking?**
- **CLIENT LIST. Active clients?**
- **LATENCY. Latency sampling?**
- **Memory stats. Memory usage breakdown?**
- **Key space stats. Database stats?**
- **Replication stats. Replication metrics?**
- **Cluster stats. Cluster health?**
- **Health checks. PING, health endpoints?**
- **Metrics export. Prometheus integration?**

## Security

- **ACL (Access Control List). User permission model?**
- **User creation. Default user modification?**
- **User categories: admin, developer, monitoring, default?**
- **Command permissions. ACL SETUSER commands?**
- **Key permissions. ACL patterns for keys?**
- **Authentication. Password + username?**
- **requirepass. Simple password auth?**
- **SSL/TLS. Encrypted connections?**
- **Certificate validation. Client certificates?**
- **Redis ACL categories. Command grouping?**
- **Audit logging. ACL LOG command?**

## Advanced Features

- **Pub/Sub pattern. Publish-subscribe messaging?**
- **PUBLISH, SUBSCRIBE. Topic-based messaging?**
- **Channel patterns. Pattern subscriptions?**
- **UNSUBSCRIBE, PSUBSCRIBE, PUNSUBSCRIBE. Subscription management?**
- **PUBSUB CHANNELS, PUBSUB NUMSUB. Introspection?**
- **Stream consumer groups. Alternative to pub/sub?**
- **Geo commands. Geospatial queries?**
- **GEOADD. Adding location data?**
- **GEODIST, GEOPOS. Location queries?**
- **GEORADIUS, GEOSEARCH. Radius search?**
- **BitField operations. Complex bit operations?**
- **Redis modules. Custom extensions?**

## Troubleshooting & Edge Cases

- **Memory pressure. OOM prevention?**
- **CPU spike. High CPU usage diagnosis?**
- **Replication lag. Catching up with master?**
- **Cluster split-brain. Partition tolerance?**
- **Key eviction storms. Cascading evictions?**
- **Slow commands. SLOWLOG analysis?**
- **Connection exhaustion. Too many connections?**
- **Fragmentation. Memory fragmentation?**
- **RDB corruption. Recovery from corruption?**
- **AOF corruption. Fixing AOF file?**

## Integration Patterns

- **Session storage. Session caching with TTL?**
- **Cache warmer. Loading initial cache?**
- **Rate limiting. Token bucket algorithm?**
- **Distributed locks. Using SET NX EX?**
- **Lock expiry. Preventing deadlocks?**
- **Retry with backoff. Exponential backoff using Redis?**
- **Circuit breaker pattern. Failure detection with Redis?**
- **Bloom filters. Cardinality estimation?**

## Scenario Based