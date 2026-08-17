# ELASTICSEARCH

## Elasticsearch Fundamentals & Architecture

- **Elasticsearch architecture. Nodes, shards, replicas, clusters?**
- **Shard. Primary vs Replica shards. Data distribution?**
- **Node roles: master, data, ingest. Responsibilities?**
- **Master-eligible nodes. Quorum & split-brain prevention?**
- **Minimum master nodes. Quorum formula?**
- **Dedicated master nodes. Cluster stability?**
- **Data nodes. Storage & computation?**
- **Ingest nodes. Pipeline processing before indexing?**
- **Coordinating nodes. Request routing?**
- **Index lifecycle. Hot → Warm → Cold tiers?**
- **ILM (Index Lifecycle Management). Automation?**

## Indexing & Documents

- **Index. Collection of documents with similar structure?**
- **Document. JSON object with unique ID?**
- **Mapping. Field type definitions and analyzers?**
- **Dynamic mapping. Auto-detection vs explicit mapping?**
- **Field types: text, keyword, numeric, date, geo, nested, object?**
- **Analyzer. Tokenization, lowercasing, stemming?**
- **Analyzer components: Tokenizer, TokenFilter, CharFilter?**
- **Custom analyzer. Real-world use case?**
- **Keyword vs Text field. When each?**
- **Nested vs Object type. Querying relationships?**
- **Source field. Disabling _source for storage optimization?**
- **doc_values. Aggregations, sorting, filtering optimization?**
- **Inverted index. Full-text search mechanism?**
- **Term dictionary. Index structure?**
- **Posting list. Document IDs with term occurrences?**

## Mapping & Field Types

- **Explicit mapping. Pre-defining index structure?**
- **Templates. Index naming patterns with shared mapping?**
- **Component template. Reusable mapping fragments?**
- **Composable templates. Multi-level template composition?**
- **Field aliases. Query transparency?**
- **Copy-to. Combining fields for search?**
- **Normalizer. Keyword field analysis?**
- **Similarity. Scoring algorithm (BM25)?**
- **Boost. Field-level relevance tuning?**
- **Index option. Storing term frequencies, positions?**

## Query DSL & Search

- **Query vs Filter context. Scoring vs boolean logic?**
- **Match query. Full-text search with tokenization?**
- **Match phrase. Proximity matching with position awareness?**
- **Match phrase prefix. Type-ahead search?**
- **Term query. Exact keyword matching?**
- **Wildcard, prefix, regex queries. Pattern matching?**
- **Range query. Numeric, date ranges?**
- **Bool query. AND, OR, NOT logic with combination?**
- **Must, should, filter clauses. Scoring impact?**
- **Minimum should match. Partial matching requirement?**
- **Constant score. Avoiding scoring for performance?**
- **Dis-max query. Multi-field search with field weighting?**
- **Multi-match query. Searching across multiple fields?**
- **Cross-field search. Combining field values?**
- **Boosting query. Demoting documents conditionally?**
- **Pinned query. Guaranteed result positioning?**
- **Fuzzy query. Typo tolerance, Levenshtein distance?**
- **Exists, missing filters. Null value handling?**
- **Geo queries: geo-distance, geo-bounding-box. Location search?**
- **Aggregations: terms, date-histogram, stats, percentiles?**
- **Nested queries. Querying nested documents?**
- **Inner hits. Returning nested matching documents?**
- **Explain API. Query scoring breakdown?**

## Relevance & Scoring

- **BM25. TF-IDF relevance algorithm?**
- **Scoring. Field length normalization, term frequency?**
- **Boost. Query-time vs index-time boosting?**
- **Function score query. Custom scoring logic?**
- **Script scoring. Lucene expression scoring?**
- **Field boosting. Multi-field search weighting?**
- **Phrase boost. Penalizing non-phrases?**
- **Decay functions. Distance-based score decay?**
- **Rescore query. Two-phase ranking for performance?**

## Aggregations

- **Bucket aggregations: terms, date-histogram, histogram, range?**
- **Metrics aggregations: avg, sum, min, max, percentiles, cardinality?**
- **Sub-aggregations. Nested bucket aggregations?**
- **Composite aggregation. Pagination of buckets?**
- **Top hits. Returning documents per bucket?**
- **Significant terms. Finding statistically significant terms?**
- **Filter aggregation. Conditional aggregation buckets?**
- **Sampler aggregation. Subset aggregations for large datasets?**

## Performance & Optimization

- **Shard count optimization. Too many vs too few shards?**
- **Replica count. Availability vs storage cost?**
- **Refresh interval. Segment merging, search latency vs indexing throughput?**
- **Flush interval. fsync cost, durability timing?**
- **Merge policy. Segment optimization?**
- **Index codec. Compression algorithm (deflate, lz4, zstd)?**
- **Query optimization. Avoiding expensive queries?**
- **Readonly index. Optimizing for read-only shards?**
- **Frozen tier. Searchable snapshots for cold data?**
- **Cache warming. Pre-loading frequently accessed data?**
- **Filter cache. Bitset caching for filters?**
- **Query cache. Caching entire query results?**
- **Fielddata cache. Memory usage for sorting, aggregations?**
- **Fielddata circuit breaker. Preventing OOM?**
- **Heap size tuning. 50% rule, GC impact?**
- **JVM GC optimization. G1GC vs CMS?**
- **Bulk API. Batch indexing for throughput?**
- **Bulk size tuning. Memory vs throughput?**
- **Indexing parallelism. Number of bulk requests?**

## Cluster Management

- **Cluster state. Node discovery, shard allocation?**
- **Shard allocation awareness. Zone awareness, rack awareness?**
- **Hot-warm architecture. Separating hot and warm nodes?**
- **Hot-warm-cold architecture. Data tiering?**
- **Searchable snapshots. Cold tier optimization?**
- **Shard allocation filtering. Node attribute filtering?**
- **Forced awareness. Forcing redundancy across zones?**
- **Disk threshold watermarks. Disk space limits?**
- **Flood stage. Preventing disk full?**
- **Unassigned shards. Causes and recovery?**
- **Cluster rebalancing. Shard movement cost?**
- **Rolling restart. Zero-downtime upgrades?**
- **Blue-green deployment. Testing cluster upgrade?**

## Snapshots & Backups

- **Snapshot repository. Backup storage location?**
- **Repository types: S3, GCS, Azure, Shared filesystem?**
- **Snapshot creation. Full vs incremental?**
- **Snapshot retention. Automated cleanup policies?**
- **Restore operation. Restoring indexes, mappings, settings?**
- **Partial restore. Selective recovery?**
- **Backup automation. Scheduled snapshots?**
- **Disaster recovery. RTO & RPO planning?**
- **Cross-cluster replication. Secondary cluster backup?**

## Monitoring & Observability

- **Cluster health API. Green, yellow, red states?**
- **Index stats. Indexing rate, search rate, merge activity?**
- **Node stats. Memory, CPU, disk usage?**
- **JVM monitoring. Heap usage, GC pauses?**
- **Slow query log. Identifying expensive queries?**
- **Index slow log. Identifying slow indexing?**
- **Metrics monitoring. Prometheus integration?**
- **APM integration. Tracing search operations?**
- **Alerting. Critical metrics to monitor?**
- **Diagnostic bundle. Cluster health snapshots?**

## Security & Access Control

- **Authentication. Native realms, LDAP, SAML, OIDC?**
- **Authorization. Role-based access, document-level security?**
- **Document-level security (DLS). Query-time filtering?**
- **Field-level security (FLS). Field masking per role?**
- **API keys. Authentication for applications?**
- **Token authentication. JWT, SAML tokens?**
- **SSL/TLS. Encryption in transit?**
- **Encryption at rest. Node-level encryption?**
- **Audit logging. Security event tracking?**

## Elasticsearch in Production

- **Cluster sizing. Node count, hardware specifications?**
- **Capacity planning. Growth forecasting, disk space?**
- **Index naming. Date-based indexing for log analytics?**
- **Log analysis. ELK stack (Elasticsearch, Logstash, Kibana)?**
- **Alerting. Elastic alerting framework?**
- **Beats. Lightweight data collectors for metrics?**
- **Logstash. Log shipping and transformation?**
- **Kibana. Visualization and exploration?**

## Advanced Features

- **Cross-cluster search (CCS). Searching multiple clusters?**
- **Cross-cluster replication (CCR). Replication without snapshots?**
- **Machine learning. Anomaly detection, forecasting?**
- **Anomaly detection. Identifying unusual patterns?**
- **Forecasting. Time-series prediction?**
- **Canvas. Custom dashboards beyond Kibana?**
- **Alerting. Complex alerting rules?**
- **Rules. Scheduled rules for automation?**
- **Connectors. Integration with external systems?**

## Troubleshooting & Edge Cases

- **Split-brain scenario. Cluster partitioning?**
- **Shard allocation failures. Debugging reasons?**
- **Yellow cluster. Replica shard allocation issues?**
- **Red cluster. Primary shard loss. Recovery?**
- **Out of memory errors. Fielddata, query cache?**
- **Circuit breaker exceptions. Preventing OOM?**
- **Slow cluster performance. Diagnostic approach?**
- **Disk space running out. Emergency measures?**
- **Unrecoverable cluster. Force allocation, index recovery?**

## Scenario Based