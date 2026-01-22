## griffin-hub-sdk@1.0.0

This generator creates TypeScript/JavaScript client that utilizes [axios](https://github.com/axios/axios). The generated Node module can be used in the following environments:

Environment
* Node.js
* Webpack
* Browserify

Language level
* ES5 - you must have a Promises/A+ library installed
* ES6

Module system
* CommonJS
* ES6 module system

It can be used in both TypeScript and JavaScript. In TypeScript, the definition will be automatically resolved via `package.json`. ([Reference](https://www.typescriptlang.org/docs/handbook/declaration-files/consumption.html))

### Building

To build and compile the typescript sources to javascript use:
```
npm install
npm run build
```

### Publishing

First build the package then run `npm publish`

### Consuming

navigate to the folder of your consuming project and run one of the following commands.

_published:_

```
npm install griffin-hub-sdk@1.0.0 --save
```

_unPublished (not recommended):_

```
npm install PATH_TO_GENERATED_PACKAGE --save
```

### Documentation for API Endpoints

All URIs are relative to *http://localhost:3000*

Class | Method | HTTP request | Description
------------ | ------------- | ------------- | -------------
*AgentsApi* | [**agentsGet**](docs/AgentsApi.md#agentsget) | **GET** /agents/ | 
*AgentsApi* | [**agentsIdDelete**](docs/AgentsApi.md#agentsiddelete) | **DELETE** /agents/{id} | 
*AgentsApi* | [**agentsIdHeartbeatPost**](docs/AgentsApi.md#agentsidheartbeatpost) | **POST** /agents/{id}/heartbeat | 
*AgentsApi* | [**agentsLocationsGet**](docs/AgentsApi.md#agentslocationsget) | **GET** /agents/locations | 
*AgentsApi* | [**agentsRegisterPost**](docs/AgentsApi.md#agentsregisterpost) | **POST** /agents/register | 
*DefaultApi* | [**rootGet**](docs/DefaultApi.md#rootget) | **GET** / | 
*PlanApi* | [**planByNameGet**](docs/PlanApi.md#planbynameget) | **GET** /plan/by-name | 
*PlanApi* | [**planGet**](docs/PlanApi.md#planget) | **GET** /plan/ | 
*PlanApi* | [**planIdDelete**](docs/PlanApi.md#planiddelete) | **DELETE** /plan/{id} | 
*PlanApi* | [**planIdPut**](docs/PlanApi.md#planidput) | **PUT** /plan/{id} | 
*PlanApi* | [**planPost**](docs/PlanApi.md#planpost) | **POST** /plan/ | 
*RunsApi* | [**runsGet**](docs/RunsApi.md#runsget) | **GET** /runs/ | 
*RunsApi* | [**runsIdGet**](docs/RunsApi.md#runsidget) | **GET** /runs/{id} | 
*RunsApi* | [**runsIdPatch**](docs/RunsApi.md#runsidpatch) | **PATCH** /runs/{id} | 
*RunsApi* | [**runsTriggerPlanIdPost**](docs/RunsApi.md#runstriggerplanidpost) | **POST** /runs/trigger/{planId} | 


### Documentation For Models

 - [AgentsGet200Response](docs/AgentsGet200Response.md)
 - [AgentsGet200ResponseDataInner](docs/AgentsGet200ResponseDataInner.md)
 - [AgentsIdHeartbeatPost200Response](docs/AgentsIdHeartbeatPost200Response.md)
 - [AgentsIdHeartbeatPost404Response](docs/AgentsIdHeartbeatPost404Response.md)
 - [AgentsLocationsGet200Response](docs/AgentsLocationsGet200Response.md)
 - [AgentsRegisterPost200Response](docs/AgentsRegisterPost200Response.md)
 - [AgentsRegisterPostRequest](docs/AgentsRegisterPostRequest.md)
 - [Assertion](docs/Assertion.md)
 - [Assertion1](docs/Assertion1.md)
 - [Assertion1AnyOf](docs/Assertion1AnyOf.md)
 - [Assertions](docs/Assertions.md)
 - [Assertions1](docs/Assertions1.md)
 - [BinaryPredicate](docs/BinaryPredicate.md)
 - [BinaryPredicate1](docs/BinaryPredicate1.md)
 - [BinaryPredicateOperator](docs/BinaryPredicateOperator.md)
 - [Edge](docs/Edge.md)
 - [Edge1](docs/Edge1.md)
 - [Endpoint](docs/Endpoint.md)
 - [Endpoint1](docs/Endpoint1.md)
 - [Frequency](docs/Frequency.md)
 - [Frequency1](docs/Frequency1.md)
 - [HttpMethod](docs/HttpMethod.md)
 - [JSONAssertion](docs/JSONAssertion.md)
 - [JSONAssertion1Predicate](docs/JSONAssertion1Predicate.md)
 - [Node](docs/Node.md)
 - [Node1](docs/Node1.md)
 - [PlanGet200Response](docs/PlanGet200Response.md)
 - [PlanPost201Response](docs/PlanPost201Response.md)
 - [PlanPostRequest](docs/PlanPostRequest.md)
 - [PlanPostRequestEdgesInner](docs/PlanPostRequestEdgesInner.md)
 - [PlanPostRequestFrequency](docs/PlanPostRequestFrequency.md)
 - [PlanPostRequestNodesInner](docs/PlanPostRequestNodesInner.md)
 - [PlanPostRequestNodesInnerAnyOf](docs/PlanPostRequestNodesInnerAnyOf.md)
 - [PlanPostRequestNodesInnerAnyOf1](docs/PlanPostRequestNodesInnerAnyOf1.md)
 - [PlanPostRequestNodesInnerAnyOf2](docs/PlanPostRequestNodesInnerAnyOf2.md)
 - [PlanPostRequestNodesInnerAnyOf2AssertionsInner](docs/PlanPostRequestNodesInnerAnyOf2AssertionsInner.md)
 - [PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOf](docs/PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOf.md)
 - [PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOf1](docs/PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOf1.md)
 - [PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOf2](docs/PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOf2.md)
 - [PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOfAllOfAccessor](docs/PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOfAllOfAccessor.md)
 - [PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOfAllOfPredicate](docs/PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOfAllOfPredicate.md)
 - [PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOfAllOfPredicateAnyOf](docs/PlanPostRequestNodesInnerAnyOf2AssertionsInnerAnyOfAllOfPredicateAnyOf.md)
 - [PlanPostRequestNodesInnerAnyOfHeadersValue](docs/PlanPostRequestNodesInnerAnyOfHeadersValue.md)
 - [PlanPostRequestNodesInnerAnyOfHeadersValueAnyOf](docs/PlanPostRequestNodesInnerAnyOfHeadersValueAnyOf.md)
 - [PlanPostRequestNodesInnerAnyOfHeadersValueAnyOfSecret](docs/PlanPostRequestNodesInnerAnyOfHeadersValueAnyOfSecret.md)
 - [PlanPostRequestNodesInnerAnyOfPath](docs/PlanPostRequestNodesInnerAnyOfPath.md)
 - [PlanPostRequestNodesInnerAnyOfPathAnyOf](docs/PlanPostRequestNodesInnerAnyOfPathAnyOf.md)
 - [PlanPostRequestNodesInnerAnyOfPathAnyOfVariable](docs/PlanPostRequestNodesInnerAnyOfPathAnyOfVariable.md)
 - [ResponseFormat](docs/ResponseFormat.md)
 - [RunsGet200Response](docs/RunsGet200Response.md)
 - [RunsGet200ResponseDataInner](docs/RunsGet200ResponseDataInner.md)
 - [RunsIdGet200Response](docs/RunsIdGet200Response.md)
 - [RunsIdGet200ResponseData](docs/RunsIdGet200ResponseData.md)
 - [RunsIdPatchRequest](docs/RunsIdPatchRequest.md)
 - [RunsTriggerPlanIdPostRequest](docs/RunsTriggerPlanIdPostRequest.md)
 - [TestPlanV1](docs/TestPlanV1.md)
 - [UnaryPredicate](docs/UnaryPredicate.md)
 - [Wait](docs/Wait.md)
 - [Wait1](docs/Wait1.md)


<a id="documentation-for-authorization"></a>
## Documentation For Authorization

Endpoints do not require authorization.

