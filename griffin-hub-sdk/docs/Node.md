# Node


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**type** | **string** |  | [default to undefined]
**method** | **string** |  | [default to undefined]
**path** | [**EndpointPath**](EndpointPath.md) |  | [default to undefined]
**base** | [**EndpointPath**](EndpointPath.md) |  | [default to undefined]
**headers** | [**{ [key: string]: EndpointHeadersValue; }**](EndpointHeadersValue.md) |  | [optional] [default to undefined]
**body** | **any** |  | [optional] [default to undefined]
**response_format** | **string** |  | [default to undefined]
**duration_ms** | **number** |  | [default to undefined]
**assertions** | [**Array&lt;AssertionsAssertionsInner&gt;**](AssertionsAssertionsInner.md) |  | [default to undefined]

## Example

```typescript
import { Node } from 'griffin-hub-sdk';

const instance: Node = {
    id,
    type,
    method,
    path,
    base,
    headers,
    body,
    response_format,
    duration_ms,
    assertions,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
