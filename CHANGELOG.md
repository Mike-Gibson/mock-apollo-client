# [1.3.1](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v1.3.1) (2024-04-11)

### Fixes

* Fix issue - missingHandlerPolicy not passed to a MockLink when creating a client [#60](https://github.com/Mike-Gibson/mock-apollo-client/pull/60)

# [1.3.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v1.3.0) (2024-04-10)

### Features

* Add new `missingHandlerPolicy` configuration option [#55](https://github.com/Mike-Gibson/mock-apollo-client/pull/55)

### Chores

* Update dev dependencies [#59](https://github.com/Mike-Gibson/mock-apollo-client/pull/59)

# [1.2.1](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v1.2.1) (2022-08-13)

### Fixes

* Fix issue - Cannot find type definition file for ‘zen-observable' with Apollo client >= 3.5.0 [#47](https://github.com/Mike-Gibson/mock-apollo-client/issues/47)

# [1.2.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v1.2.0) (2021-08-10)

### Features

* Handle fragments [#31](https://github.com/Mike-Gibson/mock-apollo-client/issues/31)

# [1.1.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v1.1.0) (2021-04-10)

### Features

* Support subscriptions [#26](https://github.com/Mike-Gibson/mock-apollo-client/pull/26)

# [1.0.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v1.0.0) (2020-08-20)

### Features

* **[Breaking Change]** Support `@apollo/client` v3 (drops support for `apollo-client` v2) [#16](https://github.com/Mike-Gibson/mock-apollo-client/pull/16)

  If targeting Apollo Client 2, continue using the latest 0.x version.

  Apollo Client 3 no longer passes `@client` directives down to links, so `mock-apollo-client` can no longer support queries which consist entirely of `@client` directives. `mock-apollo-client` will log a warning if a query handler is registered for a query which only contains `@client` directives.

### Documentation

* Updated Readme to reflect update to Apollo Client 3
* Updated Readme examples to use hooks

# [0.7.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v0.7.0) (2021-04-27)

### Features

* Support subscriptions [#28](https://github.com/Mike-Gibson/mock-apollo-client/issues/28)

# [0.6.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v0.6.0) (2021-04-01)

### Features

* Handle fragments [#24](https://github.com/Mike-Gibson/mock-apollo-client/issues/24)

# [0.5.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v0.5.0) (2020-12-07)

### Features

* Strip `@connection` directive from identifiers [#20](https://github.com/Mike-Gibson/mock-apollo-client/pull/20)

# [0.4.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v0.4.0) (2020-05-12)

### Features

* Improved handling when queries contain `@client` directives [#13](https://github.com/Mike-Gibson/mock-apollo-client/pull/13)

# [0.3.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v0.3.0) (2020-03-25)

### Features

* Allow Apollo client constructor options to be passed to `createMockClient`

### Documentation

* Fixed typo in Readme [#1](https://github.com/Mike-Gibson/mock-apollo-client/pull/1)

# [0.2.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v0.2.0) (2019-08-07)

### Features

* Updated peer dependencies to be compatible with `apollo-client` 2.6

# [0.1.0](https://github.com/Mike-Gibson/mock-apollo-client/releases/tag/v0.1.0) (2019-04-19)

### Features

* **[Breaking Change]** New API using `setRequestHandler`. See Readme for usage.

### Documentation

* Updated documentation

# [0.0.1](https://github.com/Mike-Gibson/mock-apollo-client/tree/v0.0.1) (2019-03-03)

### Features

* First version of mock apollo client
