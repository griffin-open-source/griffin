# PlanApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**planByNameGet**](#planbynameget) | **GET** /plan/by-name | |
|[**planGet**](#planget) | **GET** /plan/ | |
|[**planIdDelete**](#planiddelete) | **DELETE** /plan/{id} | |
|[**planIdPut**](#planidput) | **PUT** /plan/{id} | |
|[**planPost**](#planpost) | **POST** /plan/ | |

# **planByNameGet**
> PlanPost201Response planByNameGet()


### Example

```typescript
import {
    PlanApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new PlanApi(configuration);

let projectId: string; // (default to undefined)
let environment: string; // (default to undefined)
let name: string; // (default to undefined)

const { status, data } = await apiInstance.planByNameGet(
    projectId,
    environment,
    name
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **projectId** | [**string**] |  | defaults to undefined|
| **environment** | [**string**] |  | defaults to undefined|
| **name** | [**string**] |  | defaults to undefined|


### Return type

**PlanPost201Response**

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

# **planGet**
> PlanGet200Response planGet()


### Example

```typescript
import {
    PlanApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new PlanApi(configuration);

let projectId: string; // (optional) (default to undefined)
let environment: string; // (optional) (default to undefined)
let limit: number; // (optional) (default to undefined)
let offset: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.planGet(
    projectId,
    environment,
    limit,
    offset
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **projectId** | [**string**] |  | (optional) defaults to undefined|
| **environment** | [**string**] |  | (optional) defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to undefined|
| **offset** | [**number**] |  | (optional) defaults to undefined|


### Return type

**PlanGet200Response**

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

# **planIdDelete**
> planIdDelete()


### Example

```typescript
import {
    PlanApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new PlanApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.planIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|


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

# **planIdPut**
> PlanPost201Response planIdPut(planPostRequest)


### Example

```typescript
import {
    PlanApi,
    Configuration,
    PlanPostRequest
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new PlanApi(configuration);

let id: string; // (default to undefined)
let planPostRequest: PlanPostRequest; //

const { status, data } = await apiInstance.planIdPut(
    id,
    planPostRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **planPostRequest** | **PlanPostRequest**|  | |
| **id** | [**string**] |  | defaults to undefined|


### Return type

**PlanPost201Response**

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

# **planPost**
> PlanPost201Response planPost(planPostRequest)


### Example

```typescript
import {
    PlanApi,
    Configuration,
    PlanPostRequest
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new PlanApi(configuration);

let planPostRequest: PlanPostRequest; //

const { status, data } = await apiInstance.planPost(
    planPostRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **planPostRequest** | **PlanPostRequest**|  | |


### Return type

**PlanPost201Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Default Response |  -  |
|**400** | Default Response |  -  |
|**401** | Default Response |  -  |
|**403** | Default Response |  -  |
|**404** | Default Response |  -  |
|**500** | Default Response |  -  |
|**502** | Default Response |  -  |
|**503** | Default Response |  -  |
|**504** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

