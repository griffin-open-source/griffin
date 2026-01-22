# Endpoint


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**type** | **string** |  | [default to undefined]
**method** | **string** |  | [default to undefined]
**path** | [**PlanPostRequestNodesInnerAnyOfPath**](PlanPostRequestNodesInnerAnyOfPath.md) |  | [default to undefined]
**base** | [**PlanPostRequestNodesInnerAnyOfPath**](PlanPostRequestNodesInnerAnyOfPath.md) |  | [default to undefined]
**headers** | [**{ [key: string]: PlanPostRequestNodesInnerAnyOfHeadersValue; }**](PlanPostRequestNodesInnerAnyOfHeadersValue.md) |  | [optional] [default to undefined]
**body** | **any** |  | [optional] [default to undefined]
**response_format** | **string** |  | [default to undefined]

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
