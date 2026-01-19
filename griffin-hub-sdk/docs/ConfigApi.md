# ConfigApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**configGet**](#configget) | **GET** /config/ | |
|[**configOrganizationIdEnvironmentTargetsTargetKeyDelete**](#configorganizationidenvironmenttargetstargetkeydelete) | **DELETE** /config/{organizationId}/{environment}/targets/{targetKey} | |
|[**configOrganizationIdEnvironmentTargetsTargetKeyGet**](#configorganizationidenvironmenttargetstargetkeyget) | **GET** /config/{organizationId}/{environment}/targets/{targetKey} | |
|[**configOrganizationIdEnvironmentTargetsTargetKeyPut**](#configorganizationidenvironmenttargetstargetkeyput) | **PUT** /config/{organizationId}/{environment}/targets/{targetKey} | |
|[**configSingleGet**](#configsingleget) | **GET** /config/single | |

# **configGet**
> ConfigGet200Response configGet()


### Example

```typescript
import {
    ConfigApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new ConfigApi(configuration);

let organizationId: string; // (optional) (default to undefined)
let environment: string; // (optional) (default to undefined)

const { status, data } = await apiInstance.configGet(
    organizationId,
    environment
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **organizationId** | [**string**] |  | (optional) defaults to undefined|
| **environment** | [**string**] |  | (optional) defaults to undefined|


### Return type

**ConfigGet200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Default Response |  -  |
|**400** | Default Response |  -  |
|**401** | Default Response |  -  |
|**403** | Default Response |  -  |
|**404** | Default Response |  -  |
|**500** | Default Response |  -  |
|**502** | Default Response |  -  |
|**503** | Default Response |  -  |
|**504** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **configOrganizationIdEnvironmentTargetsTargetKeyDelete**
> configOrganizationIdEnvironmentTargetsTargetKeyDelete()


### Example

```typescript
import {
    ConfigApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new ConfigApi(configuration);

let organizationId: string; // (default to undefined)
let environment: string; // (default to undefined)
let targetKey: string; // (default to undefined)

const { status, data } = await apiInstance.configOrganizationIdEnvironmentTargetsTargetKeyDelete(
    organizationId,
    environment,
    targetKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **organizationId** | [**string**] |  | defaults to undefined|
| **environment** | [**string**] |  | defaults to undefined|
| **targetKey** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**204** | Default Response |  -  |
|**400** | Default Response |  -  |
|**401** | Default Response |  -  |
|**403** | Default Response |  -  |
|**404** | Default Response |  -  |
|**500** | Default Response |  -  |
|**502** | Default Response |  -  |
|**503** | Default Response |  -  |
|**504** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **configOrganizationIdEnvironmentTargetsTargetKeyGet**
> ConfigOrganizationIdEnvironmentTargetsTargetKeyGet200Response configOrganizationIdEnvironmentTargetsTargetKeyGet()


### Example

```typescript
import {
    ConfigApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new ConfigApi(configuration);

let organizationId: string; // (default to undefined)
let environment: string; // (default to undefined)
let targetKey: string; // (default to undefined)

const { status, data } = await apiInstance.configOrganizationIdEnvironmentTargetsTargetKeyGet(
    organizationId,
    environment,
    targetKey
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **organizationId** | [**string**] |  | defaults to undefined|
| **environment** | [**string**] |  | defaults to undefined|
| **targetKey** | [**string**] |  | defaults to undefined|


### Return type

**ConfigOrganizationIdEnvironmentTargetsTargetKeyGet200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Default Response |  -  |
|**400** | Default Response |  -  |
|**401** | Default Response |  -  |
|**403** | Default Response |  -  |
|**404** | Default Response |  -  |
|**500** | Default Response |  -  |
|**502** | Default Response |  -  |
|**503** | Default Response |  -  |
|**504** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **configOrganizationIdEnvironmentTargetsTargetKeyPut**
> ConfigOrganizationIdEnvironmentTargetsTargetKeyPut200Response configOrganizationIdEnvironmentTargetsTargetKeyPut(configOrganizationIdEnvironmentTargetsTargetKeyPutRequest)


### Example

```typescript
import {
    ConfigApi,
    Configuration,
    ConfigOrganizationIdEnvironmentTargetsTargetKeyPutRequest
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new ConfigApi(configuration);

let organizationId: string; // (default to undefined)
let environment: string; // (default to undefined)
let targetKey: string; // (default to undefined)
let configOrganizationIdEnvironmentTargetsTargetKeyPutRequest: ConfigOrganizationIdEnvironmentTargetsTargetKeyPutRequest; //

const { status, data } = await apiInstance.configOrganizationIdEnvironmentTargetsTargetKeyPut(
    organizationId,
    environment,
    targetKey,
    configOrganizationIdEnvironmentTargetsTargetKeyPutRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **configOrganizationIdEnvironmentTargetsTargetKeyPutRequest** | **ConfigOrganizationIdEnvironmentTargetsTargetKeyPutRequest**|  | |
| **organizationId** | [**string**] |  | defaults to undefined|
| **environment** | [**string**] |  | defaults to undefined|
| **targetKey** | [**string**] |  | defaults to undefined|


### Return type

**ConfigOrganizationIdEnvironmentTargetsTargetKeyPut200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Default Response |  -  |
|**400** | Default Response |  -  |
|**401** | Default Response |  -  |
|**403** | Default Response |  -  |
|**404** | Default Response |  -  |
|**500** | Default Response |  -  |
|**502** | Default Response |  -  |
|**503** | Default Response |  -  |
|**504** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **configSingleGet**
> ConfigOrganizationIdEnvironmentTargetsTargetKeyPut200Response configSingleGet()


### Example

```typescript
import {
    ConfigApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new ConfigApi(configuration);

let organizationId: string; // (default to undefined)
let environment: string; // (default to undefined)

const { status, data } = await apiInstance.configSingleGet(
    organizationId,
    environment
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **organizationId** | [**string**] |  | defaults to undefined|
| **environment** | [**string**] |  | defaults to undefined|


### Return type

**ConfigOrganizationIdEnvironmentTargetsTargetKeyPut200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Default Response |  -  |
|**400** | Default Response |  -  |
|**401** | Default Response |  -  |
|**403** | Default Response |  -  |
|**404** | Default Response |  -  |
|**500** | Default Response |  -  |
|**502** | Default Response |  -  |
|**503** | Default Response |  -  |
|**504** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

