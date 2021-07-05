README
========

For an overview of DynamoDB Local please refer to the documentation at http://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Tools.DynamoDBLocal.html


Release Notes
-----------------------------
2021-05-03 (1.16.0)

 * Improve the performance of DynamoDbLocal by reducing buffer size to 1KB from 16MB which reduces overall heap memory usage
 * Add a CORS header to DynamoDB local API responses in the case of error responses, which solves the issue of returning generic ResourceNotFoundException for all errors
 * Add support for AWS SDK for Java 2.0
 * Fix wording of the exception messages shown when incorrect attribute definitions are passed in the create table command
2021-02-08 (1.15.0)

  * Add support for PartiQL Select, Update, Insert, Delete Statements
  * Add support for batch reads and writes using PartiQL
  * Add support for transactional reads or writes using PartiQL
  * Fix the shardIterator format to keep the streamArn as part one and serial number as part two to sync with DynamoDB Streams
  * Update the Jackson library dependency from 2.6 to 2.10
  * Fix the error structure difference for message key name in TransactionCanceledException
  * Suppress “Logging initialized” log message shown at server startup

2020-12-21 (1.13.6)

  * Fix the XSS security issue in the DynamoDB JavaScript shell by sanitizing the input and output data
  * Add the log4j-core library dependency with the version update from 2.8 to 2.13.3
  * Fix the describe-stream CLI for the option, —exclusive-start-shard-id, to return basic streaminfo instead of RESOURCE_NOT_FOUND, if the requested shard-id does not match
  * Fix GSI input to not mutate while creating a table with billing mode set to PAY_PER_REQUEST
  * Update the Jetty library dependency version to 9.4.18.v20190429

2020-10-13 (1.13.5)

  * Align error message with Amazon DynamoDB service for empty sets attributes, empty value attributes, and when invalid BETWEEN condition operator range is given
  * Update log4j-api library dependency version to 2.13.3
  * Remove dependency on log4j-core 2.6.2
  * Provide support for multi-arch docker images with arm64 and amd64 architectures

2020-09-14 (1.13.4)

  * Fixes an issue where the “begins_with” conditional function was not working correctly with Binary types for Java versions 9 and later.

2020-08-24 (1.13.3)

  * Fix issues in the begins_with function in key conditions for binary range keys in the Query API.

2020-07-22 (1.13.2)

  * Fix notarization issue caused by running DynamoDB local on macOS Catalina.
  * Bug fix to return only the requested item attributes when a global secondary index is queried with specific attributes.

2020-05-29 (1.13.1)

  * Bugfix to throw validation error when gsi is queried with non projected attribute
  * Bugfix to throw validation error when gsi with projection type other than ALL is queried with option Select as ALL_ATTRIBUTES

2020-05-20 (1.13.0)

  * Support up to 25 unique items and 4 MB of data per TransactWriteItems and TransactGetItems request
  * Support empty values for non-key String and Binary attributes
  * Fix warning log messages when DB is reinitialized
  * Fix error messaging for inconsistent type validations
  * Add shutdownNow API for DynamoDB Local embedded mode
  * Update AWS SDK for Java to version 1.11.780

2020-01-16 (1.12.0)

  * Bugfixes
  * Notarization for running on MacOS Catalina

2019-02-06 (1.11.477)

  * Bugfixes

2019-02-04 (1.11.475)

  * Add on-demand implementation
  * Add support for 20 GSIs (up from 5)
  * Add transaction API implementation
  * Update AWS SDK for Java to version 1.11.475

2017-04-13 (1.11.119)

  * Add TTL implementation
  * Update AWS SDK for Java to version 1.11.119

2017-01-24 (1.11.86)

  * Implement waiters() method in LocalDynamoDBClient
  * Update AWS SDK for Java to version 1.11.86
  * Enable WARN logging for SQLite

2016-05-17_1.0

  * Bug fix for Query validation preventing primary key attributes in query filter expressions

Running DynamoDB Local
---------------------------------------------------------------

java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar [options]

For more information on available options, run with the -help option:

  java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -help
