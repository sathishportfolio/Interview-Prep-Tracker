# ANGULAR

## Angular Core & Fundamentals

- [ ] **Angular architecture. Components, Services, Modules, DI container?**
- [ ] **Module bootstrap process. Root module to app initialization?**
- [ ] **NgModule vs Standalone components. When each? Migration strategy?**
- [ ] **Lazy loading modules. Route-based code splitting?**
- [ ] **Feature modules vs Shared modules. Organization patterns?**
- [ ] **Barrel exports. Import path simplification?**
- [ ] **Dependency Injection. Hierarchical injector? Provider scopes?**
- [ ] **@Injectable() with providedIn. Tree-shaking benefit?**
- [ ] **InjectionToken for type-safe DI. Real-world use case?**
- [ ] **Lifecycle hooks: constructor vs ngOnInit vs ngAfterViewInit. Execution order?**
- [ ] **AfterViewInit for @ViewChild access. Why not in ngOnInit?**
- [ ] **ngOnDestroy. Memory leak prevention?**
- [ ] **ChangeDetectionStrategy.OnPush. When use? Performance impact?**
- [ ] **Change detection cycle. Why manual detectChanges() sometimes needed?**
- [ ] **ExpressionChangedAfterCheckError. Cause? Debug strategy?**

## Components & Templates

- [ ] **Component decorator. selector, template, templateUrl, styles, styleUrls?**
- [ ] **Template binding: interpolation, property binding, event binding, two-way binding?**
- [ ] **[property]="value" vs {{value}}. DOM property vs Angular binding?**
- [ ] **(event)="handler()" vs @HostListener. When each?**
- [ ] **Banana-in-a-box [()]. Two-way binding mechanics?**
- [ ] **$event object. Native DOM event vs Angular synthetic event?**
- [ ] **@Input vs @Output. Parent-child communication?**
- [ ] **@Input setter & getter. Complex input handling?**
- [ ] **@Output EventEmitter. Emit custom events?**
- [ ] **@ViewChild vs @ViewChildren. Timing issues?**
- [ ] **@ContentChild vs @ContentChildren. Projected content access?**
- [ ] **ng-template. Conditional rendering without DOM?**
- [ ] **ng-container. Structural directive wrapper?**
- [ ] **TemplateRef & ViewContainerRef. Dynamic component creation?**

## Data Binding & Reactivity

- [ ] **Event emitter memory leak. Subscription cleanup?**
- [ ] **Safe navigation operator (?.). null/undefined handling?**
- [ ] **Async pipe. AutoUnsubscribe? Change detection trigger?**
- [ ] **Trackby in *ngFor. Performance for large lists?**
- [ ] ***ngIf vs [hidden]. DOM removal vs CSS display?**
- [ ] ***ngSwitch. Multiple conditional rendering?**
- [ ] **String interpolation with filters. {{ value | currency }}.?**
- [ ] **Pipe chaining. Order matters?**
- [ ] **Pure vs Impure pipes. Execution frequency?**
- [ ] **Custom pipe creation. Real-world example?**
- [ ] **ngModel two-way binding. When problematic?**

## Directives

- [ ] **Structural directives: *ngIf, *ngFor, *ngSwitch. Syntax?**
- [ ] **Attribute directives. @HostBinding, @HostListener?**
- [ ] **Custom directive creation. Real use case?**
- [ ] **Directive scope. ElementRef, Renderer2?**
- [ ] **Renderer2 vs direct DOM manipulation. Why prefer Renderer2?**
- [ ] **@Directive selector specificity. Matching priority?**

## Reactive Forms

- [ ] **ReactiveFormsModule. Form builders, FormControl, FormGroup, FormArray?**
- [ ] **FormControl vs FormGroup. Nested structures?**
- [ ] **FormBuilder convenience. Shorthand syntax?**
- [ ] **FormArray for dynamic fields. Adding/removing controls?**
- [ ] **Validators: required, minlength, pattern, custom validators?**
- [ ] **Cross-field validation. Custom validator spanning multiple fields?**
- [ ] **Async validators. Server-side validation (username existence)?**
- [ ] **Status changes: VALID, INVALID, PENDING. Status tracking?**
- [ ] **Value changes Observable. Subscription memory leaks?**
- [ ] **markAsTouched, markAsDirty. Form state tracking?**
- [ ] **setValue vs patchValue. Partial updates?**
- [ ] **Disabled form controls. Excluded from form value?**
- [ ] **Form value synchronization. Manual vs auto?**
- [ ] **Form reset. Clearing vs resetting validators?**
- [ ] **Dynamic form creation. Runtime control generation?**

## Template-Driven Forms

- [ ] **ngForm & ngModelGroup. Two-way binding?**
- [ ] **Form validation with template directives. required, minlength, pattern?**
- [ ] **ngModel binding. When to avoid?**
- [ ] **Template-driven vs Reactive forms. Trade-offs?**

## Services & DI

- [ ] **Service singleton pattern. Provided at root vs component level?**
- [ ] **@Injectable() decorator. providedIn: 'root' tree-shaking?**
- [ ] **Hierarchical injection. Child component provider override?**
- [ ] **Multi-provider. Array of services?**
- [ ] **useClass, useValue, useFactory, useExisting providers?**
- [ ] **Factory function for complex initialization?**
- [ ] **NgZone. Running outside Angular zone for performance?**
- [ ] **ApplicationInitializer. Bootstrap-time initialization?**
- [ ] **APP_INITIALIZER. Async data loading before app start?**

## RxJS & Observables

- [ ] **Observable creation. of(), from(), interval(), Subject?**
- [ ] **Cold observables vs Hot observables. Subscription behavior?**
- [ ] **Subject vs BehaviorSubject vs ReplaySubject. Use cases?**
- [ ] **Subscription management. Memory leaks from unreleased subscriptions?**
- [ ] **Unsubscribe pattern. takeUntil, async pipe alternatives?**
- [ ] **Operators: map, filter, switchMap, mergeMap, concatMap, exhaustMap?**
- [ ] **switchMap vs mergeMap vs concatMap. Concurrency & ordering?**
- [ ] **exhaustMap for button clicks. Ignore while processing?**
- [ ] **shareReplay operator. Preventing duplicate subscriptions?**
- [ ] **share vs shareReplay. When refcount matters?**
- [ ] **tap operator. Side effects without transformation?**
- [ ] **catchError operator. Error recovery?**
- [ ] **retry operator. Exponential backoff with delay?**
- [ ] **debounceTime vs throttleTime. User input optimization?**
- [ ] **distinctUntilChanged. Duplicate prevention?**
- [ ] **combineLatest vs merge vs zip. Multi-stream combination?**
- [ ] **forkJoin for parallel requests. All must complete?**
- [ ] **Higher-order observables. Flattening operators?**
- [ ] **Observable vs Promise. When each?**
- [ ] **Async pipe with Observable. Auto-unsubscribe on destroy?**
- [ ] **RxJS memory leak scenarios. Detection & prevention?**

## HTTP & Interceptors

- [ ] **HttpClientModule. Dependency injection?**
- [ ] **HttpClient methods: get, post, put, delete. Request/response types?**
- [ ] **Type-safe HTTP responses. Generic response types?**
- [ ] **HttpInterceptor. Request/response modification?**
- [ ] **Interceptor order. Multiple interceptors chaining?**
- [ ] **Error interceptor. Global error handling?**
- [ ] **JWT token interceptor. Authorization header injection?**
- [ ] **Request timeout interceptor. timeout operator?**
- [ ] **CORS configuration. Preflight requests?**
- [ ] **Error handling in HTTP calls. HttpErrorResponse?**
- [ ] **Retry logic. HTTP requests retry on failure?**
- [ ] **Request cancellation. Unsubscribe vs AbortController?**
- [ ] **Response caching. HTTP caching vs application caching?**

## Routing & Navigation

- [ ] **RouterModule & Routes configuration. Path matching?**
- [ ] **Router.navigate vs Router.navigateByUrl. Difference?**
- [ ] **Route parameters: path params vs query params?**
- [ ] **ParamMap vs QueryParamMap. Subscription vs snapshot?**
- [ ] **Lazy loading routes. loadChildren. Code splitting?**
- [ ] **Route guards: CanActivate, CanActivateChild, CanDeactivate. Protection?**
- [ ] **CanDeactivate for unsaved changes warning. UX consideration?**
- [ ] **Resolve guard. Pre-loading data before component creation?**
- [ ] **Router events. NavigationStart, NavigationEnd, NavigationError?**
- [ ] **RouteReuseStrategy. Caching component state across routes?**
- [ ] **Wildcard route. 404 handling?**
- [ ] **Router preloading strategy. PreloadAllModules vs custom?**
- [ ] **AuthGuard implementation. Protected routes?**
- [ ] **Redirect routes. redirectTo parameter?**
- [ ] **Router state. ActivatedRoute vs ActivatedRouteSnapshot?**

## State Management

### NgRx
- [ ] **Redux pattern in Angular. Actions, Reducers, Effects, Selectors?**
- [ ] **Action creators. Typed actions?**
- [ ] **Reducer pure functions. State immutability?**
- [ ] **Effects for side effects. ofType operator for action filtering?**
- [ ] **mergeMap vs switchMap vs concatMap in effects. Concurrency handling?**
- [ ] **Selectors. Memoization? createSelector?**
- [ ] **Feature store. Store composition?**
- [ ] **Store devtools. Time-travel debugging?**
- [ ] **Entity adapter. Normalized state management?**
- [ ] **Facade service. Abstraction over store?**

### Alternative State Management
- [ ] **Akita vs NgRx. When simpler approach?**
- [ ] **RxJS only state management. BehaviorSubject pattern?**
- [ ] **State management with signals (Angular 16+)?**

## Change Detection & Performance

- [ ] **OnPush change detection strategy. Performance optimization?**
- [ ] **Default change detection. Checking all components on events?**
- [ ] **Angular Zone. Running outside zone for performance?**
- [ ] **ChangeDetectorRef.detectChanges(). Manual change detection?**
- [ ] **ChangeDetectorRef.detach(). Disable change detection?**
- [ ] **ExpressionChangedAfterCheckError. Debugging?**
- [ ] **Micro-tasks & macro-tasks. Zone.js interaction?**
- [ ] **Performance profiling. Chrome DevTools Angular plugin?**
- [ ] **Virtual scrolling. Large lists performance?**
- [ ] **Unidirectional data flow. Predictability?**
- [ ] **Memory profiling in Angular apps. Heap dumps?**
- [ ] **Component reuse. trackBy in loops?**

## Forms Validation & Custom Validators

- [ ] **Built-in validators: Validators.required, Validators.minLength?**
- [ ] **Async validator: AsyncValidators.uniqueUsername()?**
- [ ] **Custom validator function. ValidationError object?**
- [ ] **Cross-field validation. Validator on FormGroup?**
- [ ] **Conditional validation. Enable/disable validators dynamically?**
- [ ] **Validator composition. Multiple validators on single control?**
- [ ] **Error message display. Error object structure?**
- [ ] **Touched, dirty, pristine states. Form state tracking?**
- [ ] **Form reset. Clearing errors?**

## Testing

- [ ] **TestBed setup. ComponentFixture?**
- [ ] **@Component as test helper. Minimal test component?**
- [ ] **fixture.detectChanges(). Manual change detection?**
- [ ] **fixture.debugElement. DOM element access?**
- [ ] **DebugElement vs HTMLElement. Angular vs native?**
- [ ] **ComponentFixture.whenStable(). Async operations?**
- [ ] **HttpTestingController. HTTP request mocking?**
- [ ] **MockService vs Spy. When each?**
- [ ] **@Input/@Output testing. Direct property vs event testing?**
- [ ] **Template testing. Click events, input changes?**
- [ ] **Directive testing. Host component pattern?**
- [ ] **Service testing. Dependency injection?**
- [ ] **Observable testing. marble testing with jasmine-marbles?**
- [ ] **fakeAsync & tick. Async time progression?**
- [ ] **async helper. Promise-based async testing?**
- [ ] **waitForAsync. Latest async helper (Angular 12+)?**
- [ ] **E2E testing with Cypress vs Protractor. Protractor deprecated?**
- [ ] **Component integration testing. Full feature testing?**
- [ ] **Code coverage. Target percentage?**

## TypeScript & Type Safety

- [ ] **Generic types in Angular. Generic components, services?**
- [ ] **Strict mode. strictNullChecks, strictFunctionTypes implications?**
- [ ] **Type guards. instanceof, in operator, user-defined type guards?**
- [ ] **Discriminated unions. Type narrowing?**
- [ ] **Utility types: Partial, Pick, Omit, Record, Readonly?**
- [ ] **keyof operator. Type-safe object keys?**
- [ ] **Conditional types. Advanced type logic?**
- [ ] **Type inference. Avoiding explicit type annotations?**
- [ ] **Interface vs Type alias. When each?**
- [ ] **Readonly properties. Immutability enforcement?**

## Signals & New Features (Angular 16+)

- [ ] **Signals primitive. Reactivity without Observables?**
- [ ] **computed() signals. Derived state?**
- [ ] **effect() for side effects. Auto-tracking dependencies?**
- [ ] **Signal vs Observable. When each?**
- [ ] **Input signal. @Input migration path?**
- [ ] **Output signal. @Output alternative?**
- [ ] **Signal-based change detection. Impact on performance?**
- [ ] **Standalone components. Module-less components?**
- [ ] **Functional bootstrapping. bootstrapApplication()?**
- [ ] **Functional route guards. providersIn route config?**

## Advanced Concepts

- [ ] **Custom elements (Web Components) in Angular?**
- [ ] **ElementRef vs TemplateRef vs ViewContainerRef. Component rendering?**
- [ ] **Projecting content. ng-content with selectors?**
- [ ] **Multi-slot content projection. Complex scenarios?**
- [ ] **Dynamic component creation. ComponentFactoryResolver (deprecated in Angular 13)?**
- [ ] **ComponentRef. Dynamic component lifecycle?**
- [ ] **ViewContainerRef.createComponent(). Manual insertion?**
- [ ] **Portal components. Material CDK?**
- [ ] **Custom animations. @angular/animations?**
- [ ] **Transition state machine. Animation triggers?**
- [ ] **Reusable animations. animation definitions?**
- [ ] **i18n localization. ngx-translate?**
- [ ] **Multi-language support. LOCALE_ID provider?**

## Performance Optimization

- [ ] **Bundle size analysis. webpack-bundle-analyzer?**
- [ ] **Tree shaking. providedIn: 'root' for unused services?**
- [ ] **Lazy loading. Code splitting by route?**
- [ ] **Preloading strategy. Custom preload logic?**
- [ ] **Image optimization. WebP, responsive images?**
- [ ] **Compression. gzip, brotli?**
- [ ] **Minification. Production build optimization?**
- [ ] **AOT compilation. Ahead-of-time vs Just-in-time?**
- [ ] **Differential loading. Polyfill distribution?**
- [ ] **Virtual scrolling for large lists. CDK ScrollingModule?**
- [ ] **Infinite scroll. Pagination vs scroll-to-load?**
- [ ] **Memoization in selectors. createSelector?**
- [ ] **OnPush change detection at scale. Impact on large apps?**
- [ ] **Web Workers. CPU-intensive operations?**
- [ ] **Service Workers. Offline support, caching?**
- [ ] **Caching strategies. Cache-first vs network-first?**

## Security

- [ ] **XSS prevention. Sanitization with DomSanitizer?**
- [ ] **bypassSecurityTrustHtml. When use? Risks?**
- [ ] **Template injection. Safe vs unsafe?**
- [ ] **CSRF token handling. HttpInterceptor?**
- [ ] **Content Security Policy (CSP). Configuration?**
- [ ] **CORS. Proxy in development?**
- [ ] **Authentication token storage. LocalStorage vs SessionStorage vs Cookies?**
- [ ] **JWT token refresh. Automatic refresh mechanism?**
- [ ] **HttpOnly cookies. HttpInterceptor prevention?**
- [ ] **Dependency vulnerabilities. npm audit?**

## Server-Side Rendering (SSR)

- [ ] **Angular Universal. Server-side rendering benefits?**
- [ ] **Hydration. Server-sent HTML reuse in client?**
- [ ] **HTTP request handling on server. transferState?**
- [ ] **Relative paths. Server vs client URL differences?**
- [ ] **Zone.js on server. Event handling?**
- [ ] **Build process. npm run build:ssr?**
- [ ] **Performance metrics. First Contentful Paint (FCP) improvement?**
- [ ] **SEO benefits. Meta tags server-rendered?**

## Build & Deployment

- [ ] **Angular CLI. Code generation (ng generate)?**
- [ ] **ng build configuration. production vs development?**
- [ ] **Angular.json configuration. Build options?**
- [ ] **Environment files. environment.ts vs environment.prod.ts?**
- [ ] **Source maps. Debugging production builds?**
- [ ] **Budget limits. Bundle size thresholds?**
- [ ] **Docker containerization. Nginx reverse proxy?**
- [ ] **CI/CD pipeline integration. GitHub Actions, Jenkins?**
- [ ] **Progressive Web App (PWA). @angular/pwa?**
- [ ] **Service Worker configuration. Cache strategies?**
- [ ] **Update strategies. ng update for dependencies?**

## Monorepo & Scalability

- [ ] **Nx monorepo. Workspace management?**
- [ ] **Shared libraries. Code reuse across projects?**
- [ ] **Feature library organization. Barrel exports?**
- [ ] **Core library. Singleton services?**
- [ ] **Lint rules. Enforcing architecture?**
- [ ] **Scalability patterns for large teams. Micro front-ends?**

## Common Patterns & Anti-Patterns

- [ ] **Smart vs Dumb components. Container vs presentational?**
- [ ] **Facade service pattern. Simplifying component interaction with store?**
- [ ] **Observable subject pattern. Data flow between services?**
- [ ] **Unsubscribe patterns. Memory leak prevention?**
- [ ] **Memory leaks. Subscription cleanup?**
- [ ] **Changing input after initialization. ngOnChanges handling?**
- [ ] **Storing data in component. Stateful components pitfalls?**
- [ ] **Direct DOM manipulation. Why avoid?**
- [ ] **Logic in templates. Moving to component class?**
- [ ] **Heavy components. Breaking into smaller pieces?**
- [ ] **Circular dependencies. Module organization?**

## Debugging & Tools

- [ ] **Chrome DevTools Angular plugin. Component tree inspection?**
- [ ] **Augury extension. Component hierarchy, dependency graph?**
- [ ] **Angular DevTools. Profiling, performance analysis?**
- [ ] **Logging best practices. LoggerService?**
- [ ] **Error tracking. Sentry integration?**
- [ ] **Network tab. HTTP request inspection?**
- [ ] **Performance tab. Flame chart analysis?**
- [ ] **Source map debugging. Original TypeScript in browser?**
- [ ] **Breakpoints. Conditional breakpoints?**

## Scenario Based