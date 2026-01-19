# RunsApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**runsGet**](#runsget) | **GET** /runs/ | |
|[**runsIdGet**](#runsidget) | **GET** /runs/{id} | |
|[**runsIdPatch**](#runsidpatch) | **PATCH** /runs/{id} | |
|[**runsTriggerPlanIdPost**](#runstriggerplanidpost) | **POST** /runs/trigger/{planId} | |

# **runsGet**
> RunsGet200Response runsGet()


### Example

```typescript
import {
    RunsApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new RunsApi(configuration);

let planId: string; // (optional) (default to undefined)
let status: 'pending' | 'running' | 'completed' | 'failed'; // (optional) (default to undefined)
let limit: number; // (optional) (default to undefined)
let offset: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.runsGet(
    planId,
    status,
    limit,
    offset
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **planId** | [**string**] |  | (optional) defaults to undefined|
| **status** | [**&#39;pending&#39; | &#39;running&#39; | &#39;completed&#39; | &#39;failed&#39;**]**Array<&#39;pending&#39; &#124; &#39;running&#39; &#124; &#39;completed&#39; &#124; &#39;failed&#39;>** |  | (optional) defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to undefined|
| **offset** | [**number**] |  | (optional) defaults to undefined|


### Return type

**RunsGet200Response**

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

# **runsIdGet**
> RunsIdGet200Response runsIdGet()


### Example

```typescript
import {
    RunsApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new RunsApi(configuration);

let id: string; // (default to undefined)

const { status, data } = await apiInstance.runsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] |  | defaults to undefined|


### Return type

**RunsIdGet200Response**

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

# **runsIdPatch**
> RunsIdGet200Response runsIdPatch()


### Example

```typescript
import {
    RunsApi,
    Configuration,
    RunsIdPatchRequest
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new RunsApi(configuration);

let id: string; // (default to undefined)
let runsIdPatchRequest: RunsIdPatchRequest; // (optional)

const { status, data } = await apiInstance.runsIdPatch(
    id,
    runsIdPatchRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **runsIdPatchRequest** | **RunsIdPatchRequest**|  | |
| **id** | [**string**] |  | defaults to undefined|


### Return type

**RunsIdGet200Response**

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

# **runsTriggerPlanIdPost**
> RunsIdGet200Response runsTriggerPlanIdPost(runsTriggerPlanIdPostRequest)


### Example

```typescript
import {
    RunsApi,
    Configuration,
    RunsTriggerPlanIdPostRequest
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new RunsApi(configuration);

let planId: string; // (default to undefined)
let runsTriggerPlanIdPostRequest: RunsTriggerPlanIdPostRequest; //

const { status, data } = await apiInstance.runsTriggerPlanIdPost(
    planId,
    runsTriggerPlanIdPostRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **runsTriggerPlanIdPostRequest** | **RunsTriggerPlanIdPostRequest**|  | |
| **planId** | [**string**] |  | defaults to undefined|


### Return type

**RunsIdGet200Response**

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

