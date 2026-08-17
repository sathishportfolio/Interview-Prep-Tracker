# OOP

## General

- [!] What is OOP and why it matters
- [!] Characteristics of an OOP

## 4 Pillars of OOP 

- [x] Explain with examples

### Encapsulation

- [x] Definition
- [x] How is it achieved
- [!] What are all the benefits 
- [x] Explain State Control by encapsulation using one example
- [x] Access modifiers

### Abstraction

- [x] Definition
- [x] How is it achieved
- [x] Abstract class vs methods
- [!] Interface vs Abstract class
- [c] Method in interface vs Abstract
- [x] How will you choose Interface or Abstract class
- [!] When do you layer an interface on top of the abstract class
    *   Validation using Template Method Pattern 
- [x] default & static methods in java 8
- [!] static, final and private methods
- [!] Explain how abstraction promotes loose coupling and reducing tight coupling
- [x] Explain loose coupling with dependency injection using payment processor and notification system

### Inheritance

- [x] Definition
- [x] Parent child analogy
- [x] What relationship does inheritance form 
- [x] Why do we need Inheritance & One Major Drawback
- [!] Types 
- [x] Diamond problem
- [x] How multiple inheritance resolved in java
    *   Explain 
- [x] Two interfaces have the same default method. How do you resolve it?
- [x] What is another way of using inheritance is called?
- [!] Another way of using inheritance based on what condition? What relationship does it form?

### Polymorphism

- [x] Definition
    *   same interface but different implementation
- [x] Static — Compile-time — method overloading vs Dynamic — Runtime — overriding
- [x] overloading vs overriding
- [x] What are the rules for method overriding?
    *   Same Method Signature
    *   Inheritance Required
    *   Compatible Return Type (same or covariant)
    *   Equal or Broadened Access
    *   Non-Overridable Methods ( private, static, or final )
- [c] What are the rules regarding checked and unchecked exceptions in method overriding?
    *   Checked Exceptions
        +   Cannot declare broader or new checked exceptions
        +   Can declare narrower checked exceptions
        +   Can declare fewer or no checked exceptions
        +   Parent declares no checked exceptions
    *   Unchecked Exceptions
        +   No restrictions
        +   Flexibility
- [x] when is method overriding vs method hiding applicable


## Relationship

### Association

- [ ] Definition

### Aggregation

- [ ] Definition

### Composition

- [ ] Definition
- [ ] What relationship does Composition form 
- [ ] Inheritance vs Composition
- [ ] How will you choose Inheritance or Composition
- [ ] Explain benefit of Composition over Inheritance with a use case
    *   Department class getListOfEmployees where Employee class extended as PermanantEmployees / ContractEmployees also can be accomodated


### Cohesion

- [x] Definition — What, When, Where, Why & How


### Coupling

- [x] Definition — What, When, Where, Why & How

## Misc

- [x] Constructor vs Method
- [ ] Constructor Chaining (this() vs super())
- [x] this vs super
- [x] Functional Interface
- [x] Marker Interface
- [x] Final Class vs Final Method vs Final Variable

## Nested Classes

- [ ] Definition
- [ ] Types — What, When, Where, Why & How

## SOLID

- [!] Explain with examples


## GOF

- [x] Definition
- [x] All categories — List down types for each
- [ ] Example implementation for,
    *   Creational
        +   Singleton
        +   Factory
        +   Builder
    *   Structural
        +   Adapter
        +   Facade
        +   Proxy
    *   Behavioural
        +   Observer
        +   Strategy
        +   Template Method (Example — validation using interface & abstract)

## Scenario Based

- [x] Interface or Abstract Class, which would you choose for a payment system?
- [x] Inheritance or Composition, which is better and why?
- [x] How would you design a notification framework supporting Email, SMS, Push, WhatsApp?
- [x] Explain Parent obj = new Child();. Which methods and variables are accessible?
- [ ] Explain Dynamic Method Dispatch internally.
- [x] Two interfaces have the same default method. How do you resolve it?
- [x] Why is programming to interfaces considered a best practice?
- [x] Refactor a tightly coupled design into a loosely coupled one.
- [ ] Design a plugin architecture using OOP principles.
- [!] A class has 15 constructor parameters. How would you redesign it?
- [ ] How would you model a payment gateway using abstraction and polymorphism?
- [!] Explain a real production example where composition helped more than inheritance.