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
- [ ] Can we force GC?
- [ ] What is memory leaks & when does it occur
- [ ] What is OutOfMemoryError & when does it occur
- [ ] Heap Dump vs Thread Dump
- [ ] Have you used any JVM dump / monitoring tools? (JVisualVM, JConsole, Eclipse MAT, JMC)
- [ ] How will you troubleshoot OutOfMemoryError in production (Heap Dump, Thread Dump, GC Logs, Tools)
- [ ] Have you done JVM tuning in real time?

## Error & Exception

- [ ] Exception Diagram (Throwable hierarchy)
- [ ] Exception vs Error vs Throwable
- [ ] Checked vs Unchecked Exception
- [ ] FileNotFoundException type
- [ ] try_catch_finally flow
- [ ] Multi-catch (Handling multiple types)
- [ ] Order of exception hierarchy and catch order
- [ ] Return in try vs finally
- [ ] Can we stop finally block from executing?
- [ ] Exception propagation (Delegating to caller)
- [ ] Stack unwinding
- [ ] throw vs throws
- [ ] Chained exceptions
- [ ] Suppressed exceptions
- [ ] Try-with-resources
- [ ] Custom exceptions (Exception vs RuntimeException)
- [ ] Exception handling with method overriding
- [ ] StackOverflowError vs OutOfMemoryError
- [ ] ConcurrentModificationException
- [ ] Design patterns in exception handling
- [ ] Exception handling best practices
- [ ] How to handle custom exceptions in Spring Boot
- [ ] @ExceptionHandler vs @ControllerAdvice
- [ ] Transaction rollback and exceptions
- [ ] Exception handling in CompletableFuture

## Keywords & Modifiers

- [ ] Why no pointers in Java
- [ ] Call by Value vs Call by Reference in Java
- [ ] Can we overload main method in Java?
- [ ] Access & Control Modifiers: private, static, final (variable, method, class)
- [ ] static - block, import, nested class
- [ ] default methods (Interface evolution)
- [ ] synchronized
- [ ] volatile
- [ ] transient
- [ ] Final vs Finally vs Finalize
- [ ] When finalize method is called

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
- [ ] String utility methods & common operations (replace vs replaceAll, getBytes vs toCharArray)
- [ ] split vs splice vs StringTokenizer
- [ ] String concatenation internals: Compile-time vs runtime concatenation
- [ ] Why excessive String concatenation hurts performance
- [ ] String vs StringBuilder vs StringBuffer (Mutable vs Immutable, Thread safety)
- [ ] Creating custom immutable classes & handling mutability (Getter/Setter rules, defensive copying)
- [ ] Can we have an immutable constructor?
- [ ] substring() changes across Java versions
- [ ] Compact Strings (Java 9+)
- [ ] G1 String Deduplication
- [ ] Reverse String / Palindrome / Anagram (Coding problems)
- [ ] Split CSV string using Stream API and print (Coding problem)

## Collection Framework

- [ ] What are Collections? (Java Collections Framework vs java.util vs Collections utility class)
- [ ] Collections Hierarchy & Collection Diagram
- [ ] List vs Set vs Map vs Queue
- [ ] Decision Flowchart: How to select the right Collection for real-world scenarios
- [ ] Time Complexities of common collection operations

- [ ] Difference between Array and Collection
- [ ] Difference between Set and List
- [ ] ArrayList vs LinkedList (Internal workings, differences, and trade-offs)
- [ ] Default capacities: List (10), Map (16 buckets), Set (16 via internal HashMap)
- [ ] Creating a custom ArrayList to disallow duplicates
- [ ] How to remove duplicates from a List without using a Set

- [ ] HashSet internal working
- [ ] HashMap vs HashSet (Difference and internal reliance)
- [ ] Which one is faster: Set or HashMap? (Performance comparison & internal explanation)
- [ ] Tricky: How Set allows duplicate custom objects if equals() and hashCode() are not overridden

- [ ] equals() vs hashCode() contract & hashing basics
- [ ] What is a Hash Collision & Collision resolution techniques
- [ ] HashMap internal working (DSA basics, indexing, load factor, resizing, treeification)
- [ ] Common HashMap methods (including checking if a HashMap contains a specific value)
- [ ] HashMap vs LinkedHashMap vs TreeMap
- [ ] Understanding TreeMap in Java and Red-Black Trees

- [ ] HashMap vs Hashtable (Differences & internal working)
- [ ] Is HashMap thread-safe?
- [ ] Synchronized collections vs Concurrent collections
- [ ] ConcurrentHashMap: Internal locking mechanism, null key/value restrictions, and why it is preferred over Hashtable

- [ ] ArrayDeque vs Stack (Why ArrayDeque is preferred over Legacy Stack)
- [ ] PriorityQueue (Heap-based ordering & internal working)

- [ ] Iterator vs ListIterator vs Enumeration
- [ ] Fail-Fast vs Fail-Safe Iterators in Java

- [ ] Objects ordering: Comparable vs Comparator
- [ ] compareTo() method usage and implementation
- [ ] Sorting objects based on attributes (e.g., ID, Name) using Comparable and Comparator
- [ ] Creating custom Comparators using lambda expressions & utility methods

- [ ] Collections class static utility methods
- [ ] Immutable vs Unmodifiable collections (e.g., List.of() vs Collections.unmodifiableList())

- [ ] Collections vs Streams (Differences, performance, and memory usage)
- [ ] Working with Streams on Collections

## Features

### Java 8

- [ ] Lambda Expressions
- [ ] Stream API
- [ ] Functional Interfaces
- [ ] Method References
- [ ] Default and Static Methods
- [ ] Optional Class
- [ ] New Date and Time API
- [ ] Base64 Encoding and Decoding


### Java 17, 21, 25

#### Java 17
- [ ] Sealed Classes and Interfaces
- [ ] Records
- [ ] Pattern Matching for `instanceof`
- [ ] Switch Expressions
- [ ] Text Blocks
- [ ] Helpful NullPointerExceptions

#### Java 21
- [ ] Virtual Threads
- [ ] Pattern Matching for `switch`
- [ ] Record Patterns
- [ ] Sequenced Collections Framework
- [ ] Generational ZGC
- [ ] UTF-8 by Default

#### Java 25
- [ ] Unnamed Variables and Patterns
- [ ] Stream Gatherers
- [ ] Compact Object Headers
- [ ] Foreign Function and Memory API
- [ ] Scoped Values
- [ ] Markdown Documentation Comments
- [ ] Implicitly Declared Classes and Instance Main Methods


## Multithreading

### Multithreading Fundamentals & Concepts
- [ ] What is Multithreading & Concurrency?
- [ ] What is the need for threads in Java?
- [ ] Process vs Thread (Process-based vs Thread-based Multitasking)
- [ ] Concurrency vs Parallelism

### Thread Creation & Execution
- [ ] Ways to create a thread: Thread class, Runnable interface, Callable interface
- [ ] Create a thread using Thread
- [ ] Create a thread using Runnable
- [ ] Create a thread using Callable
- [ ] How to run a thread: start() vs run()
- [ ] What happens when calling start() twice on the same thread?
- [ ] Runnable vs Callable

### Thread Lifecycle & Control Methods
- [ ] Thread Lifecycle & States (Thread.State)
- [ ] Thread Priority & Thread Naming
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
- [ ] Optimistic vs Pessimistic Locking

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
- [ ] Print Odd-Even using two threads
- [ ] Print 1 to 100 using three threads
- [ ] Design Producer-Consumer Pattern
- [ ] ReentrantLock example
- [ ] ExecutorService example
- [ ] CountDownLatch example
- [ ] Semaphore example
- [ ] CompletableFuture example
- [ ] ConcurrentHashMap example
- [ ] Design a Thread-Safe Cache
- [ ] Design a Connection Pool
- [ ] Explain a Multithreading issue solved in production

## I/O in Java

- [ ] Java I/O Architecture Overview
- [ ] I/O Inheritance Hierarchy Diagram
- [ ] Stream Classifications Based on Data Type
- [ ] Byte Stream vs Character Stream
- [ ] InputStream vs Reader
- [ ] OutputStream vs Writer
- [ ] Byte Stream Classes (FileInputStream, FileOutputStream)
- [ ] Character Stream Classes (FileReader, FileWriter)
- [ ] What is Buffering & Why is Buffering Faster?
- [ ] FileInputStream vs BufferedInputStream & FileOutputStream vs BufferedOutputStream
- [ ] FileReader vs BufferedReader
- [ ] BufferedReader vs Scanner
- [ ] read() vs readLine()
- [ ] Bridge Streams (InputStreamReader, OutputStreamWriter)
- [ ] flush() vs close()
- [ ] Best Practice to Read a File Example
- [ ] try-finally vs try-with-resources
- [ ] File vs Path
- [ ] File vs Files
- [ ] Paths.get() vs Path.of()
- [ ] createNewFile() vs mkdir()
- [ ] delete() vs deleteIfExists()
- [ ] Classic I/O (IO) vs New I/O (NIO) vs NIO.2
- [ ] Stream vs Channel
- [ ] FileChannel vs Streams
- [ ] Why is NIO Faster?
- [ ] Heap Buffer vs Direct Buffer
- [ ] Explain flip() in ByteBuffer
- [ ] Difference between flip(), clear(), and compact()
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
- [ ] Why is Serializable a Marker Interface?
- [ ] How do you serialize and deserialize an object? (ObjectOutputStream / ObjectInputStream)
- [ ] What is transient variable?
- [ ] Can static variables be serialized?
- [ ] What is serialVersionUID?
- [ ] What happens if serialVersionUID changes?
- [ ] What is NotSerializableException?
- [ ] What happens if an object contains another non-serializable object?
- [ ] Parent Serializable, Child not Serializable—what happens?
- [ ] Child Serializable, Parent not Serializable—what happens?
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
- [ ] DriverManager vs Connection
- [ ] Statement vs PreparedStatement vs CallableStatement
- [ ] Why PreparedStatement prevents SQL Injection
- [ ] executeQuery() vs executeUpdate() vs execute()
- [ ] What is ResultSet?
- [ ] Types of ResultSet
- [ ] What is AutoCommit?
- [ ] Commit vs Rollback
- [ ] Savepoint
- [ ] How transactions work
- [ ] SQLException
- [ ] Try-with-resources
- [ ] Connection Pooling
- [ ] HikariCP
- [ ] Batch Processing
- [ ] DatabaseMetaData vs ResultSetMetaData
- [ ] Best practices for writing production-quality JDBC code

## Misc

- [ ] What are Generics?
- [ ] Why do we need Generics?
- [ ] Real-world use of Generics in the Java Collections Framework
- [ ] Generic Class vs Generic Method
- [ ] Raw Type vs Generic Type
- [ ] Type Inference and Diamond Operator
- [ ] Why can't Generics use primitives?
- [ ] Why can't we do new T()?
- [ ] Why can't Generic Arrays be created?
- [ ] Why is `List<Integer>` not a subtype of `List<Number>`?
- [ ] What are Bounded Type Parameters?
- [ ] Multiple Bounds (T extends A & B)
- [ ] Generic Wildcards
- [ ] `List<?>` vs `List<Object>`
- [ ] Wildcard Upper vs Lower Bounds (extends vs super)
- [ ] Explain PECS (Producer Extends, Consumer Super)
- [ ] Generic Functional Interfaces
- [ ] What is Type Erasure?
- [ ] Bridge Methods
- [ ] Heap Pollution

## Scenario Based