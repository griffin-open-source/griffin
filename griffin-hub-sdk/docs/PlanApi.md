# PlanApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**planGet**](#planget) | **GET** /plan/ | |
|[**planPost**](#planpost) | **POST** /plan/ | |

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
let limit: number; // (optional) (default to undefined)
let offset: number; // (optional) (default to undefined)

const { status, data } = await apiInstance.planGet(
    projectId,
    limit,
    offset
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **projectId** | [**string**] |  | (optional) defaults to undefined|
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

# **planPost**
> PlanPost201Response planPost()


### Example

```typescript
import {
    PlanApi,
    Configuration,
    TestPlanV1
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new PlanApi(configuration);

let testPlanV1: TestPlanV1; // (optional)

const { status, data } = await apiInstance.planPost(
    testPlanV1
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **testPlanV1** | **TestPlanV1**|  | |


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

