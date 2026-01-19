# AgentsApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**agentsGet**](#agentsget) | **GET** /agents/ | |
|[**agentsIdDelete**](#agentsiddelete) | **DELETE** /agents/{id} | |
|[**agentsIdHeartbeatPost**](#agentsidheartbeatpost) | **POST** /agents/{id}/heartbeat | |
|[**agentsLocationsGet**](#agentslocationsget) | **GET** /agents/locations | |
|[**agentsRegisterPost**](#agentsregisterpost) | **POST** /agents/register | |

# **agentsGet**
> AgentsGet200Response agentsGet()

List all agents with optional filtering

### Example

```typescript
import {
    AgentsApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new AgentsApi(configuration);

let location: string; //Filter by location (optional) (default to undefined)
let status: 'online' | 'offline'; //Filter by status (optional) (default to undefined)

const { status, data } = await apiInstance.agentsGet(
    location,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **location** | [**string**] | Filter by location | (optional) defaults to undefined|
| **status** | [**&#39;online&#39; | &#39;offline&#39;**]**Array<&#39;online&#39; &#124; &#39;offline&#39;>** | Filter by status | (optional) defaults to undefined|


### Return type

**AgentsGet200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **agentsIdDelete**
> AgentsIdHeartbeatPost200Response agentsIdDelete()

Deregister an agent

### Example

```typescript
import {
    AgentsApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new AgentsApi(configuration);

let id: string; //Agent ID (default to undefined)

const { status, data } = await apiInstance.agentsIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Agent ID | defaults to undefined|


### Return type

**AgentsIdHeartbeatPost200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **agentsIdHeartbeatPost**
> AgentsIdHeartbeatPost200Response agentsIdHeartbeatPost()

Record a heartbeat from an agent

### Example

```typescript
import {
    AgentsApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new AgentsApi(configuration);

let id: string; //Agent ID (default to undefined)

const { status, data } = await apiInstance.agentsIdHeartbeatPost(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**string**] | Agent ID | defaults to undefined|


### Return type

**AgentsIdHeartbeatPost200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Default Response |  -  |
|**404** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **agentsLocationsGet**
> AgentsLocationsGet200Response agentsLocationsGet()

Get all registered locations (with at least one online agent)

### Example

```typescript
import {
    AgentsApi,
    Configuration
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new AgentsApi(configuration);

const { status, data } = await apiInstance.agentsLocationsGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**AgentsLocationsGet200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **agentsRegisterPost**
> AgentsRegisterPost200Response agentsRegisterPost(agentsRegisterPostRequest)

Register a new agent with the hub

### Example

```typescript
import {
    AgentsApi,
    Configuration,
    AgentsRegisterPostRequest
} from 'griffin-hub-sdk';

const configuration = new Configuration();
const apiInstance = new AgentsApi(configuration);

let agentsRegisterPostRequest: AgentsRegisterPostRequest; //

const { status, data } = await apiInstance.agentsRegisterPost(
    agentsRegisterPostRequest
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **agentsRegisterPostRequest** | **AgentsRegisterPostRequest**|  | |


### Return type

**AgentsRegisterPost200Response**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Default Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

