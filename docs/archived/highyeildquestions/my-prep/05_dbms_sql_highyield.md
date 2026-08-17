# DBMS & SQL

## DBMS Fundamentals

- [ ] **ACID properties. Explain each. Real-world implication when one fails?**
- [ ] **Atomicity failures. What breaks? Recovery mechanism?**
- [ ] **Consistency definition. Constraints enforcement? Application vs database level?**
- [ ] **Isolation levels: READ_UNCOMMITTED vs READ_COMMITTED vs REPEATABLE_READ vs SERIALIZABLE. Real scenarios?**
- [ ] **Durability guarantee. Write-ahead logging? fsync cost?**
- [ ] **CAP theorem. Trade-offs in distributed databases?**
- [ ] **RDBMS vs NoSQL. When each? Data consistency trade-offs?**

## Database Architecture

- [ ] **Storage engine. InnoDB vs MyISAM. MySQL default? Differences?**
- [ ] **Buffer pool. Size tuning? Cache hit ratio monitoring?**
- [ ] **Log-structured merge trees vs B-trees. When each?**
- [ ] **Page size & I/O optimization. Default 16KB in MySQL?**
- [ ] **WAL (Write-Ahead Logging). Performance implications?**
- [ ] **Checkpoint mechanism. Recovery time?**
- [ ] **Tablespace management. File organization?**

## Indexes & Query Optimization

- [ ] **Index types: B-tree vs Hash vs Full-text vs Spatial. When each?**
- [ ] **Composite index. Column order matters? Why?**
- [ ] **Primary key vs Unique index vs Foreign key. Indexing implications?**
- [ ] **Index selectivity. Low selectivity—why avoid indexing?**
- [ ] **Covering index. Performance benefit? Trade-off?**
- [ ] **Index fragmentation. OPTIMIZE TABLE cost?**
- [ ] **Query plan analysis with EXPLAIN. Key fields interpretation?**
- [ ] **Query execution plan. Why different for same query?**
- [ ] **Index hints: USE INDEX, FORCE INDEX, IGNORE INDEX. When override optimizer?**
- [ ] **Prefix index. Storage vs search trade-off?**
- [ ] **Reverse index usage. Like '%string' problem?**
- [ ] **Index cardinality. Histogram statistics?**
- [ ] **Multi-column index selectivity. Which column first?**

## Query Performance & Optimization

- [ ] **N+1 query problem. Detection? Prevention?**
- [ ] **Subquery vs JOIN. Performance difference?**
- [ ] **INNER JOIN vs LEFT JOIN vs RIGHT JOIN. Query planner cost?**
- [ ] **Self-join scenarios. Performance implications?**
- [ ] **UNION vs UNION ALL. When UNION necessary?**
- [ ] **GROUP BY optimization. Index usage?**
- [ ] **HAVING vs WHERE. Execution order?**
- [ ] **LIMIT OFFSET performance degradation. Pagination strategy at scale?**
- [ ] **Aggregate functions: COUNT(*) vs COUNT(column). Performance?**
- [ ] **Distinct performance cost?**
- [ ] **IN vs EXISTS vs JOIN. Query optimizer choice?**
- [ ] **Correlated subqueries. Performance issue?**
- [ ] **View materialization. Performance optimization?**

## Transactions & Concurrency

- [ ] **Transaction isolation implementation. MVCC (Multi-Version Concurrency Control)?**
- [ ] **Dirty read, non-repeatable read, phantom read. Isolation level prevents each?**
- [ ] **Lock types: shared vs exclusive. Deadlock causes?**
- [ ] **Row-level vs Table-level locking. InnoDB behavior?**
- [ ] **Deadlock detection & resolution. Victim selection?**
- [ ] **Deadlock example: transaction A waits for B, B waits for A. How detect?**
- [ ] **Lock wait timeout. Configuration?**
- [ ] **Gap locks & next-key locks. Phantom read prevention?**
- [ ] **Optimistic vs Pessimistic locking. Row versioning?**
- [ ] **Transaction log (binlog). Replication?**
- [ ] **Two-phase commit. Distributed transactions?**
- [ ] **Savepoints. Partial rollback?**

## Data Modeling & Design

- [ ] **Normalization: 1NF vs 2NF vs 3NF vs BCNF. Real-world trade-offs?**
- [ ] **Denormalization benefits & costs. When acceptable?**
- [ ] **Entity-relationship diagram. Cardinality representation?**
- [ ] **One-to-one vs One-to-many vs Many-to-many. Schema design?**
- [ ] **Foreign key constraints. Referential integrity?**
- [ ] **Surrogate vs Natural keys. When each?**
- [ ] **Composite primary keys. Advantages & disadvantages?**
- [ ] **Data type selection: INT vs BIGINT vs DECIMAL vs VARCHAR. Storage & performance?**
- [ ] **NULL handling. Storage cost? Index behavior?**
- [ ] **ENUM vs lookup table. Trade-offs?**
- [ ] **JSON columns in MySQL. Indexing? When over relational?**
- [ ] **Schema versioning. Migration strategy?**

## Backup & Recovery

- [ ] **Full backup vs Incremental vs Differential. Storage vs recovery time?**
- [ ] **Point-in-time recovery. Binlog retention?**
- [ ] **Physical vs Logical backup. mysqldump vs xtrabackup?**
- [ ] **Backup consistency. Locking implications?**
- [ ] **Recovery time objective (RTO) vs Recovery point objective (RPO). Trade-offs?**
- [ ] **Binary logging. Row-based vs Statement-based vs Mixed. Replication impact?**
- [ ] **Crash recovery. InnoDB recovery process?**
- [ ] **Backup encryption. Security at rest?**

## Replication & HA

- [ ] **Master-slave replication. Data flow?**
- [ ] **Master-master replication. Conflict resolution?**
- [ ] **Semi-synchronous replication. Durability guarantee?**
- [ ] **Replication lag. Causes? Monitoring?**
- [ ] **Failover mechanism. Automatic vs Manual?**
- [ ] **Read replicas. Scaling read traffic?**
- [ ] **Replication filters. Row & statement filtering?**
- [ ] **GTID (Global Transaction ID). Replication reliability?**
- [ ] **Parallel replication. Performance gain?**
- [ ] **Replication breakage. Skipping errors?**

## MySQL Specific Concepts

- [ ] **InnoDB storage engine architecture. Buffer pool, undo log, redo log?**
- [ ] **Clustered index. Primary key as row identifier?**
- [ ] **Secondary index. Leaf nodes contain primary key?**
- [ ] **Redo log vs Undo log. Purpose?**
- [ ] **Doublewrite buffer. Crash safety?**
- [ ] **Innodb_flush_log_at_trx_commit. Durability vs performance?**
- [ ] **Adaptive hash index. Automatic optimization?**
- [ ] **Insert buffer (Change buffer). Performance benefit?**
- [ ] **Purge thread. Garbage collection of old versions?**
- [ ] **Lock monitor. Deadlock detection?**
- [ ] **MySQL 8.0 features. Window functions, JSON improvements, CTE?**
- [ ] **Instant DDL. Online schema changes?**

## Connection & Resource Management

- [ ] **Connection pooling. min/max size tuning?**
- [ ] **max_connections limit. Planning capacity?**
- [ ] **Connection timeout configuration?**
- [ ] **Idle connection cleanup?**
- [ ] **Thread pool plugin benefits?**
- [ ] **Query timeout. Statement execution time limit?**
- [ ] **max_allowed_packet. Large query/result handling?**

## Administration & Monitoring

- [ ] **Database monitoring. Key metrics?**
- [ ] **Slow query log. Threshold tuning? Analysis?**
- [ ] **Performance schema. Detailed instrumentation?**
- [ ] **SHOW PROCESSLIST. Active query monitoring?**
- [ ] **SHOW STATUS. Performance counters?**
- [ ] **InnoDB status. Lock & transaction monitoring?**
- [ ] **Disk I/O monitoring. iostat interpretation?**
- [ ] **CPU usage analysis. Query profiling?**
- [ ] **Memory usage tuning. Buffer pool, query cache?**
- [ ] **Storage space management. Tablespace growth?**
- [ ] **User privilege management. Principle of least privilege?**
- [ ] **Parameter tuning: innodb_buffer_pool_size, max_connections, query_cache_size?**

## Security

- [ ] **Authentication. User password policies?**
- [ ] **Authorization. Column & row-level security?**
- [ ] **SQL injection prevention. Prepared statements?**
- [ ] **Data encryption at rest. Encrypted tablespaces?**
- [ ] **Encryption in transit. SSL/TLS configuration?**
- [ ] **Audit logging. Who accessed what?**
- [ ] **Least privilege principle. Role-based access?**
- [ ] **Password hashing. Storage mechanism?**

## Advanced SQL

- [ ] **Window functions: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD. Real use cases?**
- [ ] **Common table expression (CTE). WITH clause. Recursive CTE?**
- [ ] **Derived tables vs CTE performance?**
- [ ] **CASE statements. Complex conditional logic?**
- [ ] **Stored procedures. When avoid? Performance?**
- [ ] **Triggers. Use cases & dangers?**
- [ ] **Views. Updatable views. Materialized view simulation?**
- [ ] **Cursor. Performance implications?**
- [ ] **Aggregate window functions. Cumulative sums?**

## JSON Handling

- [ ] **JSON columns in MySQL 5.7+. Data type?**
- [ ] **JSON functions: JSON_EXTRACT, JSON_SET, JSON_ARRAY_APPEND?**
- [ ] **JSON path syntax. Nested access?**
- [ ] **JSON indexing. Generated columns for performance?**
- [ ] **JSON vs Relational normalization. When JSON?**
- [ ] **JSON query performance optimization?**

## Partitioning & Sharding

- [ ] **Table partitioning. Range vs List vs Hash vs Key. Performance benefit?**
- [ ] **Partition pruning. Query optimization?**
- [ ] **Subpartitioning. Hierarchical partitioning?**
- [ ] **Maintenance operations on partitions. Backup?**
- [ ] **Horizontal sharding. Shard key selection?**
- [ ] **Shard-based query routing. Complexity?**
- [ ] **Hot shard problem. Mitigation?**
- [ ] **Cross-shard joins. Distributed query complexity?**
- [ ] **Shard rebalancing. Data migration?**

## Scenario Based