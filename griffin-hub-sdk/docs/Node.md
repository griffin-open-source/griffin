# Node


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**type** | **string** |  | [default to undefined]
**method** | **string** |  | [default to undefined]
**path** | **string** |  | [default to undefined]
**base** | [**Endpoint1Base**](Endpoint1Base.md) |  | [default to undefined]
**headers** | [**{ [key: string]: Endpoint1HeadersValue; }**](Endpoint1HeadersValue.md) |  | [optional] [default to undefined]
**body** | **any** |  | [optional] [default to undefined]
**response_format** | **string** |  | [default to undefined]
**duration_ms** | **number** |  | [default to undefined]
**assertions** | [**Array&lt;Assertion1&gt;**](Assertion1.md) |  | [default to undefined]

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
