# Endpoint


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**type** | **string** |  | [default to undefined]
**method** | [**HttpMethod**](HttpMethod.md) |  | [default to undefined]
**path** | **string** |  | [default to undefined]
**base** | [**EndpointBase**](EndpointBase.md) |  | [default to undefined]
**headers** | [**{ [key: string]: EndpointHeadersValue; }**](EndpointHeadersValue.md) |  | [optional] [default to undefined]
**body** | **any** |  | [optional] [default to undefined]
**response_format** | [**ResponseFormat**](ResponseFormat.md) |  | [default to undefined]

## Example

```typescript
import { Endpoint } from 'griffin-hub-sdk';

const instance: Endpoint = {
    id,
    type,
    method,
    path,
    base,
    headers,
    body,
    response_format,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
