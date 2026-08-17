# CORE JAVA

## General
  
- [ ] Features of Java
   
## JVM

- [ ] JDK architecture
- [ ] How java code is executed
- [ ] JVM Architecture
- [ ] Explain each JVM sections and its components role

## Garbage Collection & Memory Management

- [ ] Explain JVM memory structure (Heap, Stack, Metaspace)
- [ ] Heap vs Stack vs Metaspace
- [ ] Deep dive: Heap Memory (Eden, S0, S1, Tenured)
- [ ] Explain object life cycle
- [ ] What are the reference types (Strong, Soft, Weak, Phantom)
- [ ] What is Garbage collection
- [ ] What is GC Roots & Reachability?
- [ ] What is STW (Stop-The-World)?
- [ ] What is Mark & Sweep & Concurrent Mark & Sweep?
- [ ] List all GC events, when & why it happens (Minor, Major, Full GC)
- [ ] List all GC algorithms, Goal, Characteristics & JVM flags
- [ ] G1 vs Parallel GC
- [ ] Why G1 is preferred? (Fragmented GC & Region-based memory)
- [ ] What is memory leaks & when does it occur
- [ ] What is OutOfMemoryError & when does it occur
- [ ] Heap Dump vs Thread Dump
- [ ] Have you used any JVM dump / monitoring tools? (JVisualVM, JConsole, Eclipse MAT, JMC)
- [ ] How will you troubleshoot OutOfMemoryError in production (Heap Dump, Thread Dump, GC Logs, Tools)
- [ ] Have you done JVM tuning in real time?

## Error & Exception

- [ ] Exception vs Error vs Throwable
- [ ] Checked vs Unchecked Exception
- [ ] try_catch_finally flow
- [ ] Multi-catch (Handling multiple types)
- [ ] Order of exception hierarchy and catch order
- [ ] Return in try vs finally
- [ ] Exception propagation (Delegating to caller)
- [ ] Chained exceptions
- [ ] Suppressed exceptions
- [ ] Try-with-resources
- [ ] Custom exceptions (Exception vs RuntimeException)
- [ ] Exception handling with method overriding
- [ ] StackOverflowError vs OutOfMemoryError
- [ ] ConcurrentModificationException

## Keywords & Modifiers

- [ ] Call by Value vs Call by Reference in Java
- [ ] Access & Control Modifiers: private, static, final (variable, method, class)
- [ ] static - block, import, nested class
- [ ] synchronized
- [ ] volatile
- [ ] transient

## Strings

- [ ] Ways to create Strings in Java (Literals vs new String())
- [ ] String s1="abc" vs String s2=new String("abc"): Object creation & memory locations
- [ ] Stack vs Heap memory in Java
- [ ] String Pool & memory layout
- [ ] intern() method and String interning
- [ ] Immutability concepts: What is an immutable class?
- [ ] Why String is immutable
- [ ] Why String is final
- [ ] String hashCode caching & HashMap with String keys
- [ ] Password handling: String vs char[] (Security & memory considerations)
- [ ] Object equality: == vs equals() vs compareTo()
- [ ] Things to consider when overriding/using equals() & hashCode()
- [ ] String concatenation internals: Compile-time vs runtime concatenation
- [ ] Why excessive String concatenation hurts performance
- [ ] String vs StringBuilder vs StringBuffer (Mutable vs Immutable, Thread safety)
- [ ] Creating custom immutable classes & handling mutability (Getter/Setter rules, defensive copying)

## Collection Framework

- [ ] List vs Set vs Map vs Queue
- [ ] Decision Flowchart: How to select the right Collection for real-world scenarios
- [ ] Time Complexities of common collection operations
- [ ] ArrayList vs LinkedList (Internal workings, differences, and trade-offs)
- [ ] Default capacities: List (10), Map (16 buckets), Set (16 via internal HashMap)
- [ ] HashSet internal working
- [ ] HashMap vs HashSet (Difference and internal reliance)
- [ ] equals() vs hashCode() contract & hashing basics
- [ ] What is a Hash Collision & Collision resolution techniques
- [ ] HashMap internal working (DSA basics, indexing, load factor, resizing, treeification)
- [ ] HashMap vs LinkedHashMap vs TreeMap
- [ ] Understanding TreeMap in Java and Red-Black Trees
- [ ] Is HashMap thread-safe?
- [ ] Synchronized collections vs Concurrent collections
- [ ] ConcurrentHashMap: Internal locking mechanism, null key/value restrictions, and why it is preferred over Hashtable
- [ ] ArrayDeque vs Stack (Why ArrayDeque is preferred over Legacy Stack)
- [ ] PriorityQueue (Heap-based ordering & internal working)
- [ ] Iterator vs ListIterator vs Enumeration
- [ ] Fail-Fast vs Fail-Safe Iterators in Java
- [ ] Objects ordering: Comparable vs Comparator
- [ ] Immutable vs Unmodifiable collections (e.g., List.of() vs Collections.unmodifiableList())

## Features

### Java 8

- [ ] Lambda Expressions
- [ ] Stream API
- [ ] Functional Interfaces
- [ ] Method References
- [ ] Optional Class

### Java 17, 21

#### Java 17
- [ ] Sealed Classes and Interfaces
- [ ] Records
- [ ] Pattern Matching for `instanceof`
- [ ] Switch Expressions

#### Java 21
- [ ] Virtual Threads
- [ ] Pattern Matching for `switch`

## Multithreading

### Multithreading Fundamentals & Concepts
- [ ] What is Multithreading & Concurrency?
- [ ] What is the need for threads in Java?
- [ ] Concurrency vs Parallelism

### Thread Creation & Execution
- [ ] Ways to create a thread: Thread class, Runnable interface, Callable interface
- [ ] How to run a thread: start() vs run()
- [ ] What happens when calling start() twice on the same thread?
- [ ] Runnable vs Callable

### Thread Lifecycle & Control Methods
- [ ] Thread Lifecycle & States (Thread.State)
- [ ] Daemon Threads
- [ ] Basic Thread Methods: sleep(), join(), yield()

### Synchronization & Inter-Thread Communication
- [ ] What is Synchronization?
- [ ] Synchronization levels: Method level, Block level, Static vs Instance methods
- [ ] Object-level locking vs Class-level locking
- [ ] Inter-Thread Communication: wait(), notify(), notifyAll()
- [ ] sleep() vs wait()
- [ ] What is a Deadlock?
- [ ] Deadlock example & How to resolve/prevent deadlock

### Memory Model & Low-Level Concurrency
- [ ] volatile keyword
- [ ] volatile vs synchronized
- [ ] Lock-free Programming & CAS (Compare-And-Swap)
- [ ] AtomicInteger vs volatile
- [ ] AtomicInteger vs Synchronization

### Concurrency Utilities & Locking Framework
- [ ] High-Level Concurrency Utilities (java.util.concurrent)
- [ ] Explicit Locks: synchronized vs Lock / ReentrantLock
- [ ] Concurrent Collections: ConcurrentHashMap
- [ ] Synchronization Helpers: CountDownLatch, Semaphore

### Thread Pools & Asynchronous Execution
- [ ] Thread Pools & Executor Framework
- [ ] Why ExecutorService over raw threads?
- [ ] ExecutorService & Ways to create Executor Services
- [ ] How to check task completion: Callable, Future & Future.isDone()
- [ ] ThreadPoolExecutor vs ForkJoinPool
- [ ] ExecutorService vs ForkJoin Framework
- [ ] Parallel Streams
- [ ] Asynchronous Programming: CompletableFuture

### Concurrency Trade-Offs & Best Practices
- [ ] When to use synchronized vs Lock vs AtomicInteger vs volatile
- [ ] Trade-offs in Java Concurrency (synchronized vs Lock, wait/notify vs BlockingQueue, etc.)
- [ ] How to prevent Race Conditions in production

### Practical Coding & Design Challenges
- [ ] Design a Thread-Safe Singleton
- [ ] Design Producer-Consumer Pattern
- [ ] Design a Thread-Safe Cache
- [ ] Design a Connection Pool
- [ ] Explain a Multithreading issue solved in production

## I/O in Java

- [ ] Classic I/O (IO) vs New I/O (NIO) vs NIO.2
- [ ] Stream vs Channel
- [ ] FileChannel vs Streams
- [ ] Why is NIO Faster?
- [ ] Heap Buffer vs Direct Buffer
- [ ] What is FileChannel?
- [ ] What is a Memory-Mapped File?
- [ ] Files.copy() vs FileChannel.transferTo()
- [ ] How Would You Read a 10 GB File Efficiently?
- [ ] How Would You Monitor a Directory for File Changes?
- [ ] What Are Java I/O Best Practices in Production?

## Serialization

- [ ] What is Serialization?
- [ ] What is Deserialization?
- [ ] Why do we need Serialization?
- [ ] What is Serializable interface?
- [ ] How do you serialize and deserialize an object? (ObjectOutputStream / ObjectInputStream)
- [ ] What is transient variable?
- [ ] What is serialVersionUID?
- [ ] Custom serialization: How do writeObject() and readObject() work?
- [ ] What is readResolve()?
- [ ] How does Serialization break Singleton pattern?
- [ ] Difference between Serializable and Externalizable
- [ ] What are the disadvantages of Java Serialization?
- [ ] Why do modern applications prefer JSON/Protobuf/Kryo over Java Serialization?

## JDBC

- [ ] Explain JDBC Architecture
- [ ] JDBC workflow
- [ ] Types of JDBC drivers
- [ ] Statement vs PreparedStatement vs CallableStatement
- [ ] Why PreparedStatement prevents SQL Injection
- [ ] executeQuery() vs executeUpdate() vs execute()
- [ ] What is ResultSet?
- [ ] Types of ResultSet
- [ ] What is AutoCommit?
- [ ] Commit vs Rollback
- [ ] How transactions work
- [ ] Connection Pooling
- [ ] HikariCP
- [ ] Batch Processing
- [ ] Best practices for writing production-quality JDBC code

## Misc

- [ ] What are Generics?
- [ ] Why do we need Generics?
- [ ] Generic Class vs Generic Method
- [ ] Why can't Generics use primitives?
- [ ] Why can't we do new T()?
- [ ] Why can't Generic Arrays be created?
- [ ] Why is `List<Integer>` not a subtype of `List<Number>`?
- [ ] What are Bounded Type Parameters?
- [ ] Generic Wildcards
- [ ] `List<?>` vs `List<Object>`
- [ ] Wildcard Upper vs Lower Bounds (extends vs super)
- [ ] Explain PECS (Producer Extends, Consumer Super)
- [ ] What is Type Erasure?
- [ ] Bridge Methods

## Scenario Based
