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
*ConfigApi* | [**configGet**](docs/ConfigApi.md#configget) | **GET** /config/ | 
*ConfigApi* | [**configOrganizationIdEnvironmentTargetsTargetKeyDelete**](docs/ConfigApi.md#configorganizationidenvironmenttargetstargetkeydelete) | **DELETE** /config/{organizationId}/{environment}/targets/{targetKey} | 
*ConfigApi* | [**configOrganizationIdEnvironmentTargetsTargetKeyGet**](docs/ConfigApi.md#configorganizationidenvironmenttargetstargetkeyget) | **GET** /config/{organizationId}/{environment}/targets/{targetKey} | 
*ConfigApi* | [**configOrganizationIdEnvironmentTargetsTargetKeyPut**](docs/ConfigApi.md#configorganizationidenvironmenttargetstargetkeyput) | **PUT** /config/{organizationId}/{environment}/targets/{targetKey} | 
*ConfigApi* | [**configSingleGet**](docs/ConfigApi.md#configsingleget) | **GET** /config/single | 
*DefaultApi* | [**rootGet**](docs/DefaultApi.md#rootget) | **GET** / | 
*PlanApi* | [**planGet**](docs/PlanApi.md#planget) | **GET** /plan/ | 
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
 - [AssertionAnyOf](docs/AssertionAnyOf.md)
 - [AssertionAnyOf1](docs/AssertionAnyOf1.md)
 - [AssertionAnyOf2](docs/AssertionAnyOf2.md)
 - [AssertionAnyOfAllOfPredicate](docs/AssertionAnyOfAllOfPredicate.md)
 - [AssertionAnyOfAllOfPredicateAnyOf](docs/AssertionAnyOfAllOfPredicateAnyOf.md)
 - [Assertions](docs/Assertions.md)
 - [BinaryPredicate](docs/BinaryPredicate.md)
 - [BinaryPredicate1](docs/BinaryPredicate1.md)
 - [BinaryPredicateOperator](docs/BinaryPredicateOperator.md)
 - [ConfigGet200Response](docs/ConfigGet200Response.md)
 - [ConfigOrganizationIdEnvironmentTargetsTargetKeyGet200Response](docs/ConfigOrganizationIdEnvironmentTargetsTargetKeyGet200Response.md)
 - [ConfigOrganizationIdEnvironmentTargetsTargetKeyGet200ResponseData](docs/ConfigOrganizationIdEnvironmentTargetsTargetKeyGet200ResponseData.md)
 - [ConfigOrganizationIdEnvironmentTargetsTargetKeyPut200Response](docs/ConfigOrganizationIdEnvironmentTargetsTargetKeyPut200Response.md)
 - [ConfigOrganizationIdEnvironmentTargetsTargetKeyPut200ResponseData](docs/ConfigOrganizationIdEnvironmentTargetsTargetKeyPut200ResponseData.md)
 - [ConfigOrganizationIdEnvironmentTargetsTargetKeyPutRequest](docs/ConfigOrganizationIdEnvironmentTargetsTargetKeyPutRequest.md)
 - [Edge](docs/Edge.md)
 - [Endpoint](docs/Endpoint.md)
 - [EndpointBase](docs/EndpointBase.md)
 - [EndpointHeadersValue](docs/EndpointHeadersValue.md)
 - [EndpointHeadersValueAnyOf](docs/EndpointHeadersValueAnyOf.md)
 - [EndpointHeadersValueAnyOfSecret](docs/EndpointHeadersValueAnyOfSecret.md)
 - [Frequency](docs/Frequency.md)
 - [HttpMethod](docs/HttpMethod.md)
 - [JSONAssertion](docs/JSONAssertion.md)
 - [JSONAssertionPredicate](docs/JSONAssertionPredicate.md)
 - [Node](docs/Node.md)
 - [PlanGet200Response](docs/PlanGet200Response.md)
 - [PlanPost201Response](docs/PlanPost201Response.md)
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


<a id="documentation-for-authorization"></a>
## Documentation For Authorization

Endpoints do not require authorization.

